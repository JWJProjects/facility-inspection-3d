import {makeSession, transition, release, categories, found} from './session.mjs';

const $ = (id) => document.getElementById(id);
const task = $('task-content');
const studio = $('studio-view');
const buttons = [...$('mode-select').querySelectorAll('[data-mode]')];
const stationTitles = ['入口門','設備銘牌','異常回報'];
const diagrams = ['diagram-gate','diagram-unit','diagram-report'].map($);
const sessions = {guide:makeSession('guide'),studio:makeSession('studio')};
const drafts = {guide:{category:'',notes:''},studio:{category:'',notes:''}};
const isHTTP = /^https?:$/.test(location.protocol);
let mode = 'guide';
let studioStatus = 'idle';
let studioFrame = null;
let bootTimer = null;
let bootSequence = 0;
let openURL = null;
let gatePending = false, equipmentPending = false;

const current = () => sessions[mode];
const invokeStudio = (type) => {
  if (studioStatus==='ready' && studioFrame?.contentWindow) studioFrame.contentWindow.postMessage({channel:'xunchang-v1',type},location.origin);
};
const modes = {guide:'逐點導覽',studio:'3D 巡檢'};
const content = [
  ['先前往巡檢門。站在門前的互動區內，才能開門。','操作 3D 場景走到門牌 01。可在互動區按 E，或使用右方按鈕。'],
  ['先讀取設備 P-02 的銘牌和觀察結果，再前往回報台。','前往設備 P-02 並核對銘牌，可在現場按 E 或使用按鈕。'],
  ['依設備觀察選擇異常類別，再建立本次演練摘要。','依設備觀察選擇異常類別，再建立本次演練摘要。']
];
function el(tag,attrs={},value='') {
  const e=document.createElement(tag);
  for (const [key,v] of Object.entries(attrs)) if(v!==undefined && v!==null && v!==false) e.setAttribute(key,v===true?'':v);
  if(value) e.textContent=value;
  return e;
}
function replace(node,...children) {
  while(node.firstChild) node.removeChild(node.firstChild);
  node.append(...children);
}
const primary=(action,label)=>el('button',{class:'button primary',type:'button','data-action':action},label);
const quiet=(action,label)=>el('button',{class:'button quiet',type:'button','data-action':action},label);
function setFeedback(text,tone='') {
  const f=$('interaction-status');
  if(!f) return;
  f.textContent=text;
  f.dataset.tone=tone;
}
function renderTask({focus=false}={}) {
  const s=current();
  const p=s.step;
  const available=mode==='guide'||studioStatus==='ready';
  const quietGate=p===1 && !s.gateNear && mode==='guide';
  $('step-count').textContent='0'+p+' / 03';
  replace(task,
    el('span',{class:'task-kicker'},'巡檢點 0'+p),
    el('h2',{id:'task-title',tabindex:'-1'},stationTitles[p-1]),
    el('p',{},content[p-1][mode==='guide'?0:1]),
    el('div',{class:'feedback',id:'interaction-status',role:'status','aria-live':'polite'}),
  );
  const actions=el('div',{class:'actions'});
  if(!available && p<3 && !(p===2&&s.equipmentSeen)) {
    setFeedback(studioStatus==='awaiting-play'?'請在 3D 場景內按開始。也可改用逐點導覽。':'3D 巡檢尚未連線。可改用逐點導覽。');
    actions.append(primary('use-guide','切換到逐點導覽'));
  } else if(p===1) {
    setFeedback(s.alert || (s.gateOpen ? '巡檢門已開啟，可以進入設備區。' : s.gateNear ? '已抵達門前互動區。現在可以開門。' : '未進入門前互動區，門維持關閉。'),s.tone);
    if(s.gateOpen) actions.append(primary('next','前往設備區 →'));
    else {
      const gate=quietGate ? quiet('gate','開啟巡檢門') : primary('gate','開啟巡檢門');
      gate.dataset.testid='gate-action';
      if(quietGate) actions.append(primary('approach','前往巡檢門 →'));
      actions.append(gate);
    }
  } else if(p===2) {
    setFeedback(s.alert || (s.equipmentSeen?'已核對設備。': mode==='studio' && s.equipmentNear ? '已靠近 P-02。現在可以讀取設備銘牌。':'尚未核對設備 P-02。'),s.tone);
    if(s.equipmentSeen) {
      const readout=el('div',{class:'readout'});
      readout.append(el('strong',{},'P-02'),el('span',{},found));
      task.append(readout);
      actions.append(primary('next','前往回報台 →'));
    }
    else actions.append(primary('inspect','讀取設備銘牌'));
  } else if (s.report) {
    setFeedback(s.alert||'三個巡檢點均已完成。可以下載摘要。','complete');
    actions.append(primary('summary','查看演練摘要 ↓'));
  } else {
    setFeedback(s.alert || '設備 P-02：'+found+'。',s.tone);
    const form=el('form',{id:'incident-form','aria-label':'異常回報',novalidate:true});
    const field=el('label',{class:'field'});
    field.append(el('span',{},'異常類別（必填）'));
    const select=el('select',{name:'category',id:'incident-category',required:true,'aria-describedby':'interaction-status'});
    select.append(el('option',{value:''},'請選擇'));
    for (const [key,label] of Object.entries(categories)) select.append(el('option',{value:key},label));
    select.value=drafts[mode].category;
    field.append(select);
    const note=el('label',{class:'field'});
    note.append(el('span',{},'補充備註（選填）'));
    const input=el('textarea',{name:'notes',maxlength:'200',rows:'2',placeholder:'最多 200 字。請勿輸入個人資料。'});
    input.value=drafts[mode].notes;
    note.append(input);
    const save=el('button',{class:'button primary',type:'submit'},'完成演練並檢視摘要');
    actions.classList.add('form-actions');
    actions.append(save);
    form.append(field,note,actions);
    task.append(form);
    if(focus) $('task-title').focus({preventScroll:true});
    return;
  }
  task.append(actions);
  if(focus) $('task-title').focus({preventScroll:true});
}
function renderProgress() {
  const s=current();
  const completed=[s.gateOpen,s.equipmentSeen,Boolean(s.report)];
  $('route-total').textContent='完成 '+completed.filter(Boolean).length+'／3';
  for (const [i,li] of [...$('task-list').children].entries()) {
    const done=completed[i], active=s.step===i+1&&!done;
    li.classList.toggle('is-done',done);
    diagrams[i].classList.toggle('is-active',active);
    diagrams[i].classList.toggle('is-done',done);
    if(active) li.setAttribute('aria-current','step'); else li.removeAttribute('aria-current');
    li.querySelector('small').textContent=done?'✓ 已完成':active?'進行中':'待檢';
  }
}
function renderSummary() {
  if(openURL) { URL.revokeObjectURL(openURL); openURL=null; }
  const summary=$('report-content'), report=current().report;
  summary.hidden=!report;
  $('report-empty').hidden=Boolean(report);
  replace(summary);
  if(!report) return;
  const list=el('dl',{class:'report-grid'});
  const fields=[
    ['01 入口門','開啟完成'],['02 '+report.stations[1].inspection,report.stations[1].result],['03 異常類別',report.stations[2].categoryLabel],
    ['巡檢模式',modes[mode]],['情境版號',release],['補充備註',report.stations[2].notes||'未填寫']
  ];
  for(const [key,value] of fields) {
    const item=el('div'); item.append(el('dt',{},key),el('dd',{},value)); list.append(item);
  }
  const foot=el('div',{class:'report-foot'});
  foot.append(el('small',{},'此檔為模擬訓練紀錄，未上傳。'));
  openURL=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
  foot.append(el('a',{class:'button primary',href:openURL,download:'xunchang-pump-room.json','data-testid':'export-report'},'下載摘要 JSON ↓'));
  summary.append(list,foot);
}
function renderAll(options) { renderTask(options);renderProgress();renderSummary(); }
function apply(action,{focus=false}={}) {
  const old=current();
  const next=transition(old,action);
  if(next!==old){sessions[mode]=next;renderAll({focus});}
}
function updateQuickNav(target=location.hash||'#current-task') {
  for(const link of document.querySelectorAll('.mobile-nav a')) {
    if(link.getAttribute('href')===target) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
}
function showReport() {
  updateQuickNav('#report-summary');
  const target=$('report-summary');
  target.focus({preventScroll:true});
  target.scrollIntoView({block:'start'});
}
function setStage(status,text,desc) {
  studioStatus=status;
  $('studio-title').textContent=text;
  $('studio-message').textContent=desc;
  $('studio-placeholder').hidden=['ready','loading-frame','awaiting-play'].includes(status);
  $('stage-caption').textContent=mode==='guide'
    ? '三個巡檢點依序是入口門、P-02 設備與回報台。此圖為訓練情境示意。'
    : (status==='ready' ? 'Three Studio 原生網頁匯出。開始後，以 WASD 移動，按 E 互動；按 Esc 解除滑鼠鎖定。' : '逐點導覽可完成同一訓練，但不包含 3D 走位與碰撞。');
}
function showStudioError(text,desc) {
  clearTimeout(bootTimer);
  studioFrame?.remove(); studioFrame=null;
  setStage('unavailable',text,desc);
  if(mode==='studio') renderTask();
}
async function bootStudio({reload=false}={}) {
  if(!reload && studioStatus!=='idle') return;
  if(!isHTTP) {showStudioError('3D 場景需使用 HTTP','請以靜態 HTTP 伺服器開啟此頁，或使用逐點導覽。');return;}
  const request = ++bootSequence;
  setStage('checking','正在確認 3D 匯出…','如果瀏覽器不支援，仍可使用逐點導覽。');
  try {
    const resource = new URL('./runtime/inspection-build.json',location.href);
    const response = await fetch(resource,{cache:'no-cache'});
    if(!response.ok) throw new Error('missing export');
    const marker=await response.json();
    if(request!==bootSequence) return;
    if(marker.schema!==1 || marker.entry!=='./runtime/index.html') throw new Error('invalid export marker');
    const url=new URL(marker.entry,location.href);
    studioFrame?.remove();
    const frame=el('iframe',{id:'three-stage-frame',title:'Three Studio 3D 巡檢場景',src:url.href,allow:'fullscreen'});
    studioFrame=frame;
    const waitForPlayer=() => {
      clearTimeout(bootTimer);
      bootTimer=setTimeout(()=>{
        if(request===bootSequence && studioFrame===frame && studioStatus!=='ready')
          showStudioError('3D 場景無法啟動','此瀏覽器或裝置尚未完成 3D 初始化，請使用逐點導覽。');
      },15000);
    };
    frame.addEventListener('load',()=>{
      if(request!==bootSequence || studioFrame!==frame || studioStatus==='ready') return;
      clearTimeout(bootTimer);
      // The unmodified Three Studio player waits for a Play gesture. Reading
      // its same-origin start control avoids treating a slow reader as failure.
      const start=frame.contentDocument?.getElementById('start');
      if(start) {
        setStage('awaiting-play','請在場景中選擇開始','可隨時切回逐點導覽。');
        if(mode==='studio') renderTask();
        start.addEventListener('click',waitForPlayer,{once:true});
        const msg=frame.contentDocument.getElementById('message');
        if(msg && typeof MutationObserver==='function'){
          const observer=new MutationObserver(()=>{
            if(studioFrame!==frame || studioStatus==='ready') return observer.disconnect();
            if(/error|failed|unsupported|not supported|無法|不支援/i.test(msg.textContent)){
              observer.disconnect();
              showStudioError('3D 場景無法啟動','此瀏覽器或裝置未完成 3D 初始化，請使用逐點導覽。');
            }
          });
          observer.observe(msg,{childList:true,characterData:true,subtree:true});
          if(/error|failed|unsupported|not supported|無法|不支援/i.test(msg.textContent)) {
            observer.disconnect();
            showStudioError('3D 場景無法啟動','此瀏覽器或裝置未完成 3D 初始化，請使用逐點導覽。');
            return;
          }
        }
      } else waitForPlayer();
      frame.contentWindow?.postMessage({channel:'xunchang-v1',type:'hello'},location.origin);
    },{once:true});
    setStage('loading-frame','正在載入 3D 場景…','可切回逐點導覽。');
    waitForPlayer();
    studio.append(frame);
  } catch {
    if(request===bootSequence) showStudioError('尚未附上 3D 網頁匯出','這份預覽可先體驗完整逐點流程。它不包含 3D 走位與碰撞。');
  }
}
function selectMode(newMode,{focus=false}={}) {
  if(newMode===mode) return;
  gatePending=equipmentPending=false;
  mode=newMode;
  for (const b of buttons) b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  $('guide-view').hidden=mode!=='guide';
  studio.hidden=mode!=='studio';
  setStage(studioStatus,$('studio-title').textContent,$('studio-message').textContent);
  renderAll({focus});
  if(mode==='studio') void bootStudio();
}
window.addEventListener('message',(e)=>{
  if(!isHTTP || e.origin!==location.origin || e.source!==studioFrame?.contentWindow || e.data?.channel!=='xunchang-v1') return;
  const s=sessions.studio;
  const t=e.data.type;
  if(t==='ready') {
    if(studioStatus==='ready') return;
    clearTimeout(bootTimer);
    setStage('ready','3D 場景已連線','可使用 3D 巡檢。');
    if(mode==='studio') renderTask();
  } else if(t==='unsupported') {
    showStudioError('瀏覽器未支援 3D 場景','請切換到逐點導覽。');
  } else if(t==='gate-range' && typeof e.data.inRange==='boolean' && !s.gateOpen) {
    if(s.gateNear===e.data.inRange) return;
    sessions.studio=transition(s,{type:e.data.inRange?'gate-near':'gate-out'});
    if(mode==='studio'&&s.step===1) setFeedback(e.data.inRange?'已進入門前互動區。現在可以開門。':'未進入門前互動區，門維持關閉。');
  } else if(t==='gate-denied' && mode==='studio' && s.step===1 && !s.gateOpen) {
    gatePending=false; setFeedback('距離太遠，請先靠近門牌 01。','warning');
  } else if(t==='gate-open') {
    gatePending=false;
    sessions.studio=transition(s,{type:'studio-gate'});
    if(mode==='studio' && sessions.studio!==s){
      const active=task.contains(document.activeElement);
      renderAll({focus:active});
    }
  } else if(t==='equipment-range' && typeof e.data.inRange==='boolean') {
    sessions.studio=transition(s,{type:'equipment-range',inRange:e.data.inRange});
    if(mode==='studio' && s.step===2 && !s.equipmentSeen) {
      setFeedback(e.data.inRange?'已靠近 P-02。現在可以讀取設備銘牌。':'尚未靠近設備 P-02。');
    }
  } else if(t==='equipment-denied' && mode==='studio' && s.step===2 && !s.equipmentSeen) {
    equipmentPending=false; setFeedback('請靠近設備 P-02 後再讀取。','warning');
  } else if(t==='equipment-observed') {
    equipmentPending=false;
    // A 3D action may happen before the outer next button is clicked.
    const available=s.step===1&&s.gateOpen ? transition(s,{type:'next'}) : s;
    sessions.studio=transition(available,{type:'studio-equipment'});
    if(mode==='studio' && sessions.studio!==s){
      const active=task.contains(document.activeElement);
      renderAll({focus:active});
    }
  }
});
for(const b of buttons) b.addEventListener('click',()=>selectMode(b.dataset.mode));
$('studio-fallback').addEventListener('click',()=>selectMode('guide',{focus:true}));
task.addEventListener('click',(e)=>{
  const trigger=e.target.closest('button[data-action]'); if(!trigger||!task.contains(trigger))return;
  const type=trigger.dataset.action, s=current();
  if(type==='summary'){showReport();return;}
  if(type==='use-guide'){selectMode('guide',{focus:true});return;}
  if(type==='gate' && mode==='studio'){
    if(!s.gateNear){setFeedback('距離太遠，請先靠近門牌 01。','warning');return;}
    if(gatePending)return;
    gatePending=true;invokeStudio('gate-action');
    setTimeout(()=>{gatePending=false;},550);
    return;
  }
  if(type==='inspect' && mode==='studio'){
    if(equipmentPending)return;
    equipmentPending=true;invokeStudio('inspect-equipment');
    setTimeout(()=>{equipmentPending=false;if(mode==='studio' && !current().equipmentSeen) setFeedback('尚未核對設備。請靠近 P-02 後再試。','warning');},550);
    return;
  }
  if(type==='gate' && !s.gateNear) {
    const failed=transition(s,{type});
    sessions[mode]=failed;setFeedback(failed.alert,failed.tone);return;
  }
  apply({type},{focus:true});
});
task.addEventListener('input',(e)=>{
  if(e.target.name==='notes') drafts[mode].notes=e.target.value;
  if(e.target.name==='category') {drafts[mode].category=e.target.value;e.target.removeAttribute('aria-invalid');}
});
task.addEventListener('submit',(e)=>{
  if(e.target.id!=='incident-form') return;
  e.preventDefault();
  const values=new FormData(e.target);
  const next=transition(current(),{type:'submit',category:values.get('category'),notes:values.get('notes')});
  sessions[mode]=next;
  if(!next.report){
    setFeedback(next.alert,next.tone);
    const select=$('incident-category');select.setAttribute('aria-invalid','true');select.focus();return;
  }
  renderAll();showReport();
});
$('reset-session').addEventListener('click',()=>{
  if(!window.confirm('重新演練會清除目前模式的巡檢內容，確定重新開始？')) return;
  sessions[mode]=makeSession(mode);
  drafts[mode]={category:'',notes:''};
  gatePending=equipmentPending=false;
  if(mode==='studio'){
    clearTimeout(bootTimer);
    studioFrame?.remove();studioFrame=null;void bootStudio({reload:true});
  }
  renderAll({focus:true});
  updateQuickNav('#current-task');
  $('current-task').scrollIntoView({block:'start'});
});
renderAll();

window.addEventListener('hashchange',()=>updateQuickNav());
updateQuickNav();
