import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSession, transition, release, found} from './session.mjs';

const step = (s,type,fields={}) => transition(s,{type,...fields});

test('guided mode refuses opening at a distance, opens once near',()=>{
  const first=makeSession('guide');
  const rejected=step(first,'gate');
  assert.equal(rejected.gateOpen,false);
  assert.equal(rejected.tone,'warning');
  assert.equal(step(first,'next'),first);
  const near=step(rejected,'approach');
  assert.equal(near.gateNear,true);
  const opened=step(near,'gate');
  assert.equal(opened.gateOpen,true);
  assert.equal(step(opened,'gate'),opened);
  assert.equal(step(opened,'next').step,2);
});

test('report requires both earlier stations and correct anomaly type',()=>{
  const initial=makeSession('guide');
  assert.equal(step(initial,'submit',{category:'indicator'}),initial);
  let curr = step(step(step(initial,'approach'),'gate'),'next');
  assert.equal(step(curr,'next'),curr);
  curr=step(step(curr,'inspect'),'next');
  for(const category of ['', 'reading', 'constructor']){
    const rejected=step(curr,'submit',{category});
    assert.equal(rejected.report,null);
    assert.equal(rejected.tone,'warning');
  }
  const completed=step(curr,'submit',{category:'indicator',notes:'  測試資料  '});
  assert.equal(completed.report.simulated,true);
  assert.equal(completed.report.mode,'guided');
  assert.equal(completed.report.scenarioVersion,release);
  assert.deepEqual(completed.report.stations.map(x=>x.id),['01','02','03']);
  assert.equal(completed.report.stations[1].result,found);
  assert.equal(completed.report.stations[2].notes,'測試資料');
  assert.equal(step(completed,'submit',{category:'other'}),completed);
  assert.equal(makeSession('guide').report,null);
});

test('3D state uses player events, not the fallback simulator',()=>{
  let s=makeSession('studio');
  assert.equal(step(s,'approach'),s);
  assert.equal(step(s,'gate'),s);
  assert.equal(step(s,'studio-equipment'),s);
  s=step(s,'gate-near');
  s=step(s,'gate-out');
  assert.equal(s.gateNear,false);
  s=step(step(s,'studio-gate'),'next');
  assert.equal(step(s,'inspect'),s);
  s=step(s,'equipment-range',{inRange:true});
  assert.equal(s.equipmentNear,true);
  s=step(step(s,'studio-equipment'),'next');
  s=step(s,'submit',{category:'indicator',notes:'~'.repeat(240)});
  assert.equal(s.report.mode,'three-studio');
  assert.equal(s.report.stations[2].notes.length,200);
  assert.equal(makeSession('studio').gateOpen,false);
});

test('guided and Three Studio sessions do not overwrite each other',()=>{
  const g=step(step(makeSession('guide'),'approach'),'gate');
  const three=makeSession('studio');
  assert.equal(g.gateOpen,true);
  assert.equal(three.gateOpen,false);
  assert.throws(()=>makeSession('demo'),TypeError);
});
