import { Behaviour } from '@three-studio/runtime';

const CHANNEL = 'xunchang-v1';
const TAU = Math.PI * 2;
const STATUS = {
  far:'距離太遠，請走到門牌 01 前',
  near:'已到門前，按 E 開門',
  opening:'門扇開啟中，請在門前稍候',
  open:'門已開啟，向前走到設備 02',
  inspect:'已到設備 02，按 E 查看設備',
  observed:'P-02｜指示燈不亮，請記錄讀值',
  error:'無法載入開門場景，請重新開始',
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo,n));

/** Coordinates are relative to Inspector-bound scene objects, not baked into key handlers. */
export default class InspectionWalkthrough extends Behaviour {
  static properties = {
    player: { type:'entity', label:'巡檢人員' },
    gateZone: { type:'entity', label:'01 互動區中心' },
    gateHinge: { type:'entity', label:'01 門鉸鏈' },
    equipmentZone: { type:'entity', label:'02 互動區中心' },
    openScene: { type:'string', label:'開門場景 ID' },
    gateIsOpen: { type:'boolean', label:'此場景已開門', default:false },
    gateHalfWidth: { type:'number', label:'01 區域半寬（m）', default:1.15, min:0.1, max:8 },
    gateHalfDepth: { type:'number', label:'01 區域半深（m）', default:1.05, min:0.1, max:8 },
    equipmentHalfWidth: { type:'number', label:'02 區域半寬（m）', default:1.6, min:0.1, max:8 },
    equipmentHalfDepth: { type:'number', label:'02 區域半深（m）', default:1.05, min:0.1, max:8 },
  };

  player = '';
  gateZone = '';
  gateHinge = '';
  equipmentZone = '';
  openScene = '';
  gateIsOpen = false;
  gateHalfWidth = 1.15;
  gateHalfDepth = 1.05;
  equipmentHalfWidth = 1.6;
  equipmentHalfDepth = 1.05;
  private observed = false;
  private heldE = true;
  private insideGate = false;
  private insideEquipment = false;
  private opening = false;
  private elapsed = 0;
  private switched = false;
  private title?: HTMLDivElement;
  private action?: HTMLButtonElement;
  private container?: HTMLDivElement;
  private marker?: HTMLSpanElement;
  private prefersReduced = false;
  private origin = window.location.origin;
  private qa = new URLSearchParams(window.location.search).get('qa') === '1';
  private previousStatus = '';
  private cover?: HTMLElement|null;
  private playButton?: HTMLElement|null;
  private webPlay = () => {this.wait(() => this.announce(), 100);};
  private attempts = 0;
  private rejected = 0;
  private preload?: ReturnType<NonNullable<Behaviour['scenes']>['load']>;
  private parentMessage = (event: MessageEvent): void => {
    if (window.parent === window || event.source !== window.parent || event.origin !== this.origin || this.origin === 'null') return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object' || msg.channel !== CHANNEL) return;
    if (msg.type === 'hello') this.announce();
    else if (msg.type === 'gate-action' && !this.gateIsOpen) this.interact();
    else if (msg.type === 'inspect-equipment' && this.gateIsOpen) this.interact();
  };

  onStart(): void {
    this.prefersReduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.container = document.createElement('div');
    this.container.className = 'inspection-runtime-hud';
    Object.assign(this.container.style, {
      position:'absolute', zIndex:'99', left:'16px', right:'16px', bottom:document.querySelector('[data-viewport-stage]')?'33px':'18px', display:'flex',
      alignItems:'center', justifyContent:'space-between', gap:'12px', font:'650 15px system-ui,sans-serif',
      pointerEvents:'none',
    });
    this.title = document.createElement('div');
    this.title.setAttribute('role','status');
    Object.assign(this.title.style,{display:'inline-block',background:'#171a1d',color:'#fff',padding:'10px 13px',border:'1px solid #656c74',borderRadius:'5px'});
    this.action = document.createElement('button');
    this.action.type = 'button';
    this.action.addEventListener('click', () => this.interact());
    this.action.textContent = this.gateIsOpen ? '查看設備' : '開啟巡檢門';
    Object.assign(this.action.style,{background:'#ffc400',color:'#171a1d',padding:'10px 12px',border:'2px solid #171a1d',borderRadius:'5px',font:'inherit',minHeight:'48px',pointerEvents:'auto'});
    this.container.append(this.title, this.action);
    const editorViewport = document.querySelector('[data-viewport-stage]');
    const mount = document.querySelector('#view')?.parentElement ?? editorViewport ?? document.body;
    this.cover = document.querySelector('#overlay');
    this.playButton = document.querySelector('#start');
    this.playButton?.addEventListener('click', this.webPlay);
    if (mount !== document.body && getComputedStyle(mount).position === 'static') mount.style.position = 'relative';
    mount.append(this.container);
    this.marker = document.createElement('span');
    this.marker.setAttribute('aria-hidden','true');
    this.marker.textContent = '+';
    Object.assign(this.marker.style,{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:'20',pointerEvents:'none',font:'600 22px system-ui',color:'#fff',textShadow:'1px 1px #171a1d'});
    mount.append(this.marker);
    const readyType = this.gateIsOpen ? 'gate-open' : 'ready';
    if (!this.gateIsOpen) {
      this.refresh(STATUS.far);
      if (this.scenes && this.openScene) {
        this.preload = this.scenes.load(this.openScene);
        void this.preload.ready.catch(() => { this.preload = undefined; });
      }
    } else {
      this.refresh(STATUS.open);
    }
    window.addEventListener('message', this.parentMessage);
    // The scene is not live until after Engine.create finishes; announce next tick.
    this.wait(() => {
      this.announce();
      if (readyType === 'gate-open') {
        this.send('gate-open');
        this.log('[巡場] GATE_OPEN_SCENE_LIVE');
      } else this.log('[巡場] CLOSED_SCENE_LIVE');
    }, 45);
  }

  private send(type: string, detail: Record<string, boolean> = {}): void {
    if ((!this.cover || this.cover.hidden) && window.parent !== window && this.origin !== 'null') window.parent.postMessage({channel:CHANNEL,type,...detail},this.origin);
  }

  private announce(): void {
    this.send('ready');
    this.send('gate-range',{inRange:this.insideGate});
    this.send('equipment-range',{inRange:this.insideEquipment});
    if (this.gateIsOpen) this.send('gate-open');
    if (this.observed) this.send('equipment-observed');
  }

  private refresh(label: string): void {
    if (!this.title || label === this.previousStatus) return;
    this.previousStatus = label;
    this.title.textContent = label;
  }

  private inZone(x:number,z:number, center:{x:number,z:number}|undefined, w:number,d:number): boolean {
    return center !== undefined && Math.abs(x-center.x) <= w && Math.abs(z-center.z) <= d;
  }

  private interact(): void {
    if (this.gateIsOpen) {
      if (!this.insideEquipment) { this.send('equipment-denied'); return; }
      if (this.observed) return;
      this.observed = true;
      this.refresh(STATUS.observed);
      this.send('equipment-observed');
      this.log('[巡場] EQUIPMENT_OBSERVED P-02');
    } else {
      if (this.opening) return;
      this.attempts++;
      if (!this.insideGate) {
        this.rejected++;
        this.send('gate-denied');
        this.refresh(STATUS.far);
        this.log('[巡場] GATE_ACTION_REJECTED_OUTSIDE_ZONE');
        return;
      }
      if (!this.scenes || !this.openScene) {
        this.refresh(STATUS.error);
        return;
      }
      this.opening = true;
      this.elapsed = 0;
      this.refresh(STATUS.opening);
      this.log('[巡場] GATE_ACTION_ACCEPTED');
    }
  }

  onUpdate(delta: number): void {
    const player = this.resolve(this.player)?.object.position;
    if (!player) return;
    if(this.container) this.container.style.visibility = this.cover && !this.cover.hidden ? 'hidden' : 'visible';
    if(this.marker) this.marker.style.visibility = this.cover && !this.cover.hidden ? 'hidden' : 'visible';
    const inGate = !this.gateIsOpen && this.inZone(player.x,player.z,this.resolve(this.gateZone)?.object.position,this.gateHalfWidth,this.gateHalfDepth);
    const inEquipment = this.gateIsOpen && this.inZone(player.x,player.z,this.resolve(this.equipmentZone)?.object.position,this.equipmentHalfWidth,this.equipmentHalfDepth);
    if (inGate !== this.insideGate) {
      this.insideGate = inGate;
      this.send('gate-range',{inRange:inGate});
    }
    if (inEquipment !== this.insideEquipment) {
      this.insideEquipment = inEquipment;
      this.send('equipment-range',{inRange:inEquipment});
    }
    if (this.action) this.action.disabled = this.gateIsOpen ? this.observed || !inEquipment : this.opening || !inGate;
    if (!this.opening) this.refresh(this.gateIsOpen ? this.observed ? STATUS.observed : inEquipment ? STATUS.inspect : STATUS.open : inGate ? STATUS.near : STATUS.far);
    const key = (!this.cover || this.cover.hidden) && this.input.isDown('KeyE');
    if (key && !this.heldE) this.interact();
    this.heldE = key;

    if (this.opening && !this.switched) {
      this.elapsed += delta;
      const duration = this.prefersReduced ? 0.02 : 0.78;
      const t = clamp(this.elapsed/duration,0,1);
      const hinge = this.resolve(this.gateHinge)?.object;
      if (hinge) hinge.rotation.y = TAU/4*(1 - Math.pow(1-t,3));
      if (t >= 1) {
        this.switched = true;
        const transition = this.preload?.activate() ?? this.scenes?.go(this.openScene);
        void transition?.catch(() => {this.refresh(STATUS.error); this.log('[巡場] GATE_OPEN_SCENE_FAILED');});
      }
    }
    if (this.qa && this.container) {
      Object.assign(this.container.dataset,{ playerX:player.x.toFixed(3),playerZ:player.z.toFixed(3),gateOpen:String(this.gateIsOpen),gateRange:String(this.insideGate),equipmentRange:String(this.insideEquipment),attempts:String(this.attempts),rejected:String(this.rejected),opening:String(this.opening),observed:String(this.observed) });
    }
  }

  onDestroy(): void {
    this.playButton?.removeEventListener('click',this.webPlay);
    this.container?.remove();
    this.marker?.remove();
    window.removeEventListener('message',this.parentMessage);
  }
}
