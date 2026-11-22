import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import * as s from './packages/core/src/index.ts';

const dest = process.argv[2];
const id = p => 'inspection-' + p;
const colors = { floor:'#48545a',panel:'#505b64',dark:'#232c32',lighter:'#929a9b',grating:'#66727c',white:'#e9ece1',ochre:'#febd1f',stripe:'#d99b11',rail:'#20292f',blue:'#567b99',turquoise:'#46666c',mint:'#58c6aa',warm:'#fff1c3' };
const files = ['pump-skid.glb','reservoir.glb','control-cabinet.glb','InspectionWalkthrough.ts'];
const A = {};
for (const file of files) {
 const kind = file.endsWith('glb') ? 'model' : 'script';
 const path = join(dest,'assets',kind==='model'?'models':'scripts',file);
 const bytes=await readFile(path);
 A[file]=id(file.split('.')[0]);
 await writeFile(path+'.meta.json',JSON.stringify({version:s.ASSET_META_VERSION,id:A[file],kind,importedAt:0,hash:createHash('sha256').update(bytes).digest('hex'),settings:s.defaultSettings(kind,file)},null,2)+'\n');
}

function make(open) {
 const scene=s.createEmptyScene(open?'02 / 設備室開啟':'01 / 巡檢入口');
 scene.id=id(open?'equipment':'entry');
 scene.environment.background='#2e3d44';
 const put = (key,name,pos,components=[],parent=null,rot=null) => {
  const entry=s.createEntity(name,components);
  entry.entity.id = id(key);
  entry.entity.transform.position=pos;
  if (rot) entry.entity.transform.rotation=rot;
  entry.components.forEach((c,i)=>c.id = id(key+'-'+c.type+'-'+i));
  if (!s.insertEntity(scene,entry,parent)) throw new Error('Cannot insert '+key);
  return entry.entity.id;
 };
 const collider = size => ({...s.createComponent('collider'),size:size.map(v=>v/2),friction:0.8});
 const box=(key,name,pos,dim,color,opts={})=>{
  const m=s.createMeshComponent('box');
  Object.assign(m.geometry,{width:dim[0],height:dim[1],depth:dim[2]});
  Object.assign(m.material,{color,roughness:0.76,metalness:0.04});
  if (opts.light) Object.assign(m.material,{emissive:color,emissiveIntensity:0.55});
  m.castShadow=opts.shadow??true;
  return put(key,name,pos,[m,...(opts.solid?[collider(dim)]:[])],opts.parent??null,opts.rot??null);
 };
 const light = (key,name,type,pos,rotation,tweaks) => {
  const l=s.createComponent('light');
  Object.assign(l,{kind:type},tweaks);
  return put(key,name,pos,[l],null,rotation);
 };
 const prop=(key,name,pos,file,rot=0) => {
  const c=s.createComponent('model');
  c.assetId=A[file];
  return put(key,name,pos,[c],null,[0,rot,0]);
 };
 const floor=box('floor','樓板・固定碰撞面',[0,-0.26,-3.9],[10.4,.52,21.2],colors.floor,{solid:true});
 for(let i=0;i<6;i++) box('floor-seam-'+i,'混凝土地縫',[0,0.001,4-i*2.7],[9.7,0.009,.018],colors.dark,{shadow:false});
 // Walls have real colliders for the walk-through test.
 for(const side of [-1,1]){
   const p=side===1?'east':'west';
   box(p+'-wall','側牆・固定碰撞',[side*5.15,1.65,-3.9],[.26,3.3,21],colors.panel,{solid:true});
   box(p+'-foot','側牆護板',[side*4.98,.22,-3.9],[.15,.40,20.8],colors.dark);
   box(p+'-guide','側牆警示帶',[side*5.00,.96,-3.9],[.018,.12,20.8],colors.ochre);
   for(let i=0;i<6;i++) box(p+'-rib-'+i,'立柱',[side*4.92,1.63,4.2-i*3.34],[.36,3.25,.16],colors.dark);
 }
 box('back-wall','巡檢入口外牆',[0,1.65,6.55],[10.3,3.3,.28],colors.panel,{solid:true});
 box('rear-wall','設備室端牆',[0,1.65,-14.2],[10.3,3.3,.24],colors.panel,{solid:true});
 box('ceiling','頂部機電格柵',[0,3.5,-3.9],[10.4,.24,20.8],colors.dark);
 for(let i=0;i<7;i++) box('ceiling-beam-'+i,'鋼梁',[0,3.26,4.2-i*2.9],[10,.16,.28],colors.rail);
 for(let i=0;i<5;i++){
   const z=3.1-i*3.75;
   box('luminaire-fixture-'+i,'頂部燈具',[0,3.17,z],[2.3,.13,.25],colors.dark);
   box('luminaire-'+i,'頂部發光面',[0,3.09,z],[2.05,.03,.17],colors.warm,{light:true,shadow:false});
   light('ceiling-light-'+i,'巡檢區照明','point',[0,2.85,z],null,{color:i>1?'#d2edff':'#fff0d7',intensity:22,distance:9,castShadow:false});
 }
 light('sky','環境補光','hemisphere',[0,3,0],null,{color:'#d7eafa',groundColor:'#69727b',intensity:1.8,castShadow:false});
 light('gate-key','門牌補光','spot',[1.2,2.8,2.3],[-.40,.24,0],{color:'#ffeecc',intensity:35,distance:6,penumbra:.6,castShadow:false});
 // Partition exact opening width 2.6m and exact real blockers.
 for(const side of [-1,1]){
   const p=side===1?'r':'l';
   box('partition-'+p,'門廊隔牆・固定碰撞面',[side*3.24,1.6,0],[3.86,3.2,.28],colors.turquoise,{solid:true});
   box('jamb-'+p,'黑鋼門框',[side*1.29,1.36,.02],[.11,2.74,.40],colors.dark);
   box('jamb-yellow-'+p,'門框工安黃飾帶',[side*1.27,1.36,.24],[.075,2.58,.018],colors.ochre);
   box('sill-mark-'+p,'入口黃線',[side*1.10,.012,1.52],[.04,.025,2.22],colors.stripe,{shadow:false});
   box('tall-panel-'+p,'牆面設備格柵',[side*3.26,1.18,-3.14],[.12,2.15,1.9],colors.dark);
 }
 box('lintel','上橫梁',[0,2.84,.02],[2.74,.29,.36],colors.dark);
 box('threshold','地面導引門檻',[0,.017,.38],[2.38,.032,.12],colors.ochre,{shadow:false});
 box('sign-plaque','01 門牌底板',[0,2.90,.24],[.66,.36,.065],colors.ochre);
 box('sign-track','門牌延伸帶',[0,2.63,.21],[2.53,.055,.047],colors.ochre);
 const digits=[['a','b','c','d','e','f'],['b','c']];
 const seg={a:[0,.106,.095,.027], b:[.059,.059,.026,.075], c:[.059,-.059,.026,.075],d:[0,-.106,.095,.027],e:[-.059,-.059,.026,.075],f:[-.059,.059,.026,.075]};
 for(let d=0;d<2;d++){
  for(const l of digits[d]){
   const [x,y,w,h]=seg[l];
   box('01-'+d+l,'門牌 01',[x+(d-.5)*.147,2.90+y,.282],[w,h,.022],colors.dark,{shadow:false});
  }
 }
 const hinge=put('gate-hinge','01 鉸鏈・可視門扇',[-1.25,0,0],[],null,[0,open?Math.PI/2:0,0]);
 const gateVisual=box('gate-leaf','01 複合鋼板門',[1.24,1.31,0],[2.48,2.62,.13],colors.blue,{solid:open,parent:hinge});
 box('gate-border','門扇面板',[1.24,1.31,.080],[2.30,2.41,.036],colors.turquoise,{parent:hinge});
 box('gate-rim','耐撞工安帶',[1.24,.6,.111],[2.31,.29,.023],colors.ochre,{parent:hinge});
 box('gate-handle','門扣',[2.23,1.13,.143],[.20,.085,.12],colors.dark,{parent:hinge});
 for(let i=0;i<5;i++){
   box('gate-grille-'+i,'門扇散熱細節',[1.24,1.64+i*.084,.109],[.94,.034,.024],colors.dark,{parent:hinge});
   box('gate-tread-'+i,'地面防滑帶',[0,.019,.9+i*.19],[1.76,.027,.017],colors.grating,{shadow:false});
 }
 if(!open) put('gate-blocker','01 關門實體碰撞體',[0,1.31,0],[collider([2.52,2.62,.13])]);
 const gateZone=put('gate-zone','01 互動區中心・非阻擋',[0,0,1.23]);
 const equipZone=put('equipment-zone','02 讀值互動區中心・非阻擋',[0,0,-3.0]);
 // Equipment occupies the end of the path and cannot be confused with a live device.
 prop('pump','02 P-02｜模擬泵組',[0,0,-5.18],'pump-skid.glb');
 prop('reservoir','模擬儲槽',[-2.95,0,-7.3],'reservoir.glb');
 prop('cabinet','模擬控制箱',[2.87,0,-6.35],'control-cabinet.glb');
 put('pump-collider','模擬泵組防穿越',[0,0.67,-5.18],[collider([1.73,1.34,.90])]);
 put('reservoir-collider','儲槽防穿越',[-2.95,0.70,-7.3],[collider([1.7,1.4,1.7])]);
 put('cabinet-collider','箱體防穿越',[2.87,0.70,-6.35],[collider([1.1,1.4,.7])]);
 box('pump-pad','P-02 基座',[0,.045,-5.16],[2.65,.09,1.5],colors.dark);
 box('pump-guide','P-02 地面停等線',[0,.013,-3.78],[2.64,.026,.095],colors.ochre,{shadow:false});
 box('p02-post','02 指示牌立柱',[1.28,.69,-4.6],[.09,1.38,.09],colors.dark);
 box('p02-plaque','02 讀值點銘牌',[1.28,1.47,-4.55],[.55,.34,.08],colors.ochre);
 for(const [d,ids] of [['zero',['a','b','c','d','e','f']],['two',['a','b','d','e']]]) {
   for(const l of ids){
    const [x,y,w,h]=seg[l];
    box('02-'+d+l,'銘牌 02',[1.28+x+(d==='zero'?-.078:.078),1.47+y,-4.498],[w,h,.021],colors.dark,{shadow:false});
   }
 }
 box('02-two-g','銘牌 02',[1.358,1.47,-4.497],[.095,.027,.021],colors.dark,{shadow:false});
 const playerController={...s.createComponent('playerController'),moveSpeed:2.6,sprintMultiplier:1.35,jumpHeight:0,fov:66,touchControls:'never'};
 const playerCollider={...s.createComponent('collider'),shape:'capsule',radius:.31,halfHeight:.54,friction:0};
 const playerBody={...s.createComponent('rigidbody'),bodyType:'kinematicPosition',ccd:true};
 const player=put('player','巡檢人員・第一人稱',[0,.86,open?.46:4.25],[playerController,playerCollider,playerBody]);
 const previewCamera=s.createComponent('camera');
 Object.assign(previewCamera,{isMain:true,fov:63,far:65});
 put('reference-camera','預覽鏡頭・入口',[2.25,2.08,5.65],[previewCamera],null,[-.115,.345,0]);
 const script={...s.createComponent('script'),assetId:A['InspectionWalkthrough.ts'],props:{
   player, gateZone, gateHinge:hinge, equipmentZone:equipZone, openScene:id('equipment'),gateIsOpen:open,
   gateHalfWidth:1.15,gateHalfDepth:1.05,equipmentHalfWidth:1.56,equipmentHalfDepth:1.55,
 }};
 put('director','演練任務腳本・Inspector 操作區',[-2.2,0,0],[script]);
 return scene;
}

const closed=make(false), open=make(true);
const title='巡場｜3D 設施巡檢演練';
const build=s.createBuildProfiles(title);
build.profiles.web.scenes=[closed.id,open.id];
const project={version:s.PROJECT_FORMAT_VERSION,name:title,engineVersion:s.ENGINE_VERSION,startScene:closed.id,settings:{
  loadingScene:null,rendering:{...s.createRenderingSettings(),maxPixelRatio:1.25,shadowMapSize:1024,shadows:false},physics:s.createPhysicsSettings(),build,
}};
await mkdir(join(dest,'scenes'),{recursive:true});
await writeFile(join(dest,'project.json'),JSON.stringify(project,null,2)+'\n');
await writeFile(join(dest,'scenes','01-entrance.scene.json'),s.serializeScene(closed));
await writeFile(join(dest,'scenes','02-equipment.scene.json'),s.serializeScene(open));
console.log(closed.name,Object.keys(closed.entities).length,open.name,Object.keys(open.entities).length,Object.keys(A));
