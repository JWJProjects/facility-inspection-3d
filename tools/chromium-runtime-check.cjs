const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const evidence=path.join(process.env.XUNCHANG_PROJECT || path.resolve(__dirname,'..'),'docs','assets');
const url=process.env.XUNCHANG_URL || 'http://127.0.0.1:4182/runtime/?qa=1';
const origin=new URL(url).origin;
app.commandLine.appendSwitch('use-gl','angle');
app.commandLine.appendSwitch('use-angle','swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const evidenceRows=[];
const fail=(m)=>{throw new Error(m);};
const record=(test, data)=>{evidenceRows.push({test,data});console.log(test,JSON.stringify(data));};
async function until(probe, label, timeout=20_000){
 const begin=Date.now();
 let last;
 while(Date.now()-begin<timeout){last=await probe();if(last)return last;await sleep(120);}
 fail('Timeout '+label+' last='+last);
}
const pageJS=(win,js)=>win.webContents.executeJavaScript(js,true);
const state=(win)=>pageJS(win,`(()=>{const el=document.querySelector('.inspection-runtime-hud');return el?{...el.dataset,status:el.querySelector('[role=status]')?.textContent}:null})()`);
async function capture(win,name){
 const image=await win.webContents.capturePage();
 if(image.isEmpty())fail('blank image '+name);
 fs.writeFileSync(path.join(evidence,name),image.toPNG());
}
async function main(){
 const win=new BrowserWindow({width:1000,height:660,show:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 const events=[];
 win.show(); win.focus();
 win.webContents.on('console-message',({level,message})=>events.push({level,message}));
 win.webContents.session.webRequest.onCompleted((e)=>{
  if(e.url.startsWith(origin+'/'))events.push({status:e.statusCode,path:new URL(e.url).pathname});
 });
 await win.loadURL(url);
 record('engine',{electron:process.versions.electron,chromium:process.versions.chrome,rendering:'ANGLE SwiftShader/WebGL2 software',url});
 await until(()=>pageJS(win,`!document.querySelector('#start').hidden || document.querySelector('#message').textContent.includes('Could not start')`),'initial canvas');
 if(await pageJS(win,`document.querySelector('#message').textContent.includes('Could not start')`)) fail(await pageJS(win,`document.querySelector('#message').textContent`));
 const play=await pageJS(win,`(()=>{const r=document.querySelector('#start').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
 for(const type of ['mouseDown','mouseUp']) win.webContents.sendInputEvent({type,...play,button:'left',clickCount:1});
 await until(()=>pageJS(win,`document.querySelector('#overlay').hidden`),'Play overlay hides');
 await sleep(950);
 const cold=await until(async()=>{const s=await state(win);return s?.playerZ?s:false;},'first live frame');
 record('initial',cold); await capture(win,'studio-browser-01-entry.png');
 const down=keyCode=>win.webContents.sendInputEvent({type:'keyDown',keyCode});
 const up=keyCode=>win.webContents.sendInputEvent({type:'keyUp',keyCode});
 const key=async(code,ms)=>{ down(code); await sleep(ms); up(code); await sleep(450); };
 await key('E',1100);
 const far=await state(win);
 if(far.rejected!=='1'||far.attempts!=='1'||far.gateOpen!=='false'||far.gateRange!=='false')fail('Far or held E check '+JSON.stringify(far));
 record('far E rejected, held E only one attempt',far);
 down('W');
 const settle=await until(async()=>{const s=await state(win); if(s) console.log('closing-approach',s.playerZ,s.gateRange); return s&&+s.playerZ<0.60?s:false;},'walking reaches closed barrier',40000);
 await sleep(1500);
 const blocked=await state(win);
 up('W');
 if(!(blocked.gateRange==='true'&&blocked.gateOpen==='false'&&+blocked.playerZ>0.30&&+blocked.playerZ<0.55))fail('closed body failed '+JSON.stringify(blocked));
 record('closed Rapier collider blocks forward walking',{first:settle,held:blocked});
 await capture(win,'studio-browser-02-collider.png');
 await key('E',1200);
 const opened=await until(async()=>{const s=await state(win);return s?.gateOpen==='true'?s:false;},'open variant',20000);
 if(Number(opened.playerZ)<=0.30)fail('switch passed the doorway automatically '+JSON.stringify(opened));
 record('near E opens; scene still on approach side',opened);
 await capture(win,'studio-browser-03-open.png');
 down('W');
 const inside=await until(async()=>{const s=await state(win);return s?.equipmentRange==='true'&&Number(s.playerZ)<-3.25?s:false;},'walk past doorway to equipment',30000);
 up('W');
 if(Number(inside.playerZ)>=-1.8)fail('Did not walk through gate '+JSON.stringify(inside));
 record('walks through opened doorway',inside);
 await key('E',850);
 const observed=await until(async()=>{const s=await state(win);return s?.observed==='true'?s:false;},'equipment observed',15000);
 record('equipment observed',observed);
 await capture(win,'studio-browser-04-equipment.png');
 const bad=events.filter(e=>e.status>=400);
 if(bad.length)fail('HTTP failure '+JSON.stringify(bad));
 record('request statuses',events);
}
app.whenReady().then(main).then(()=>{fs.writeFileSync(path.join(evidence,'studio-browser-check.json'),JSON.stringify(evidenceRows,null,2));app.exit(0);}).catch(e=>{console.error(e);fs.writeFileSync(path.join(evidence,'studio-browser-error.log'),String(e.stack)+'\n'+JSON.stringify(evidenceRows,null,2));app.exit(1);});
