import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as tick} from 'node:timers/promises';
import {createWorkspaceSaves} from '../src/workspace-saves.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};};

test('writes retain their owner and run in order within one session',async()=>{
  const gate=deferred(),writes=[],states=[];
  const saves=createWorkspaceSaves(async(owner,data)=>{writes.push([owner,data]);if(data===1)await gate.promise;},state=>states.push(state));
  saves.begin('A');const first=saves.save(1),second=saves.save(2);await tick();
  assert.deepEqual(writes,[['A',1]]);gate.resolve();await Promise.all([first,second]);
  assert.deepEqual(writes,[['A',1],['A',2]]);assert.deepEqual(states,['saving','saving','saved']);
});
test('an offline prior account cannot block a new account or overwrite its save status',async()=>{
  const gate=deferred(),writes=[],states=[];
  const saves=createWorkspaceSaves(async(owner,data)=>{writes.push([owner,data]);if(owner==='A')await gate.promise;},state=>states.push(state));
  saves.begin('A');const old=saves.save('old');await tick();
  saves.begin('B');await saves.save('new');assert.deepEqual(writes,[['A','old'],['B','new']]);
  const before=[...states];gate.reject(new Error('Old account disconnected'));await old;
  assert.deepEqual(states,before);assert.equal(states.at(-1),'saved');
});
test('sign-out cancels queued writes that have not started and ignores old completion',async()=>{
  const gate=deferred(),writes=[],states=[];
  const saves=createWorkspaceSaves(async(owner,data)=>{writes.push(data);await gate.promise;},state=>states.push(state));
  saves.begin('A');const first=saves.save(1),second=saves.save(2);await tick();
  saves.begin(null);const before=[...states];gate.resolve();await Promise.all([first,second]);
  assert.deepEqual(writes,[1]);assert.deepEqual(states,before);assert.equal(await saves.save(3),false);
});
test('failed saves report an error and retry can succeed',async()=>{
  const states=[];let calls=0;
  const saves=createWorkspaceSaves(async()=>{if(++calls===1)throw new Error('Offline');},state=>states.push(state));
  saves.begin('A');assert.equal(await saves.save('data'),false);assert.equal(states.at(-1),'error');
  assert.equal(await saves.save('data'),true);assert.equal(states.at(-1),'saved');
});
