export const release = '1.0.0';
export const categories = Object.freeze({
  indicator: '指示燈異常',
  reading: '讀值異常',
  other: '其他異常'
});
export const found = '指示燈不亮';

export function makeSession(mode) {
  if (mode !== 'guide' && mode !== 'studio') throw new TypeError('Unknown mode');
  return {mode, step: 1, gateNear:false, gateOpen:false, equipmentNear:false, equipmentSeen:false, report:null, alert:'', tone:''};
}

export function transition(previous, action) {
  const state = {...previous, alert:'',tone:''};
  switch (action.type) {
    case 'approach':
      if (state.mode !== 'guide' || state.step !== 1 || state.gateOpen) return previous;
      return {...state, gateNear:true, alert:'已抵達門前互動區。現在可以開門。'};
    case 'gate-out': return state.gateOpen ? previous : {...state,gateNear:false};
    case 'gate-near': return state.gateOpen ? previous : {...state,gateNear:true};
    case 'equipment-range': return {...previous,equipmentNear:action.inRange === true};
    case 'gate':
      if (state.mode !== 'guide' || state.step !== 1 || state.gateOpen) return previous;
      if (!state.gateNear) return {...state,alert:'距離太遠，請先靠近門牌 01。',tone:'warning'};
      return {...state,gateOpen:true,alert:'巡檢門已開啟，可以進入設備區。',tone:'complete'};
    case 'studio-gate':
      if (state.mode !== 'studio' || state.step !== 1 || state.gateOpen) return previous;
      return {...state,gateOpen:true,alert:'3D 場景已回報：巡檢門開啟。',tone:'complete'};
    case 'next':
      if (state.step === 1 && state.gateOpen) return {...state,step:2};
      if (state.step === 2 && state.equipmentSeen) return {...state,step:3};
      return previous;
    case 'inspect':
      if (state.mode !== 'guide' || state.step !== 2 || state.equipmentSeen) return previous;
      return {...state,equipmentSeen:true,alert:'已讀取設備銘牌。請在下一步回報異常。',tone:'complete'};
    case 'studio-equipment':
      if (state.mode !== 'studio' || state.step !== 2 || state.equipmentSeen) return previous;
      return {...state,equipmentSeen:true,alert:'3D 場景已回報：已核對 P-02。',tone:'complete'};
    case 'submit': {
      if (state.step !== 3 || state.report || !state.gateOpen || !state.equipmentSeen) return previous;
      const category = action.category;
      if (!Object.prototype.hasOwnProperty.call(categories,category)) return {...state,alert:'還缺異常類別。請選擇與設備觀察相符的項目。',tone:'warning'};
      const notes = typeof action.notes === 'string' ? action.notes.trim().slice(0,200) : '';
      if (category !== 'indicator') return {...state,alert:'所選類別與 P-02 的觀察不符。請重新核對指示燈狀態。',tone:'warning'};
      return {...state,report:{
        scenario:'training-pump-room-01',scenarioVersion:release,mode:state.mode==='studio'?'three-studio':'guided',
        simulated:true,stations:[{id:'01',inspection:'gate',result:'opened'},{id:'02',inspection:'P-02',result:found},{id:'03',inspection:'incident-report',category,categoryLabel:categories[category],notes}],
      },alert:'三個巡檢點均已完成。可以下載摘要。',tone:'complete'};
    }
    default: return previous;
  }
}
