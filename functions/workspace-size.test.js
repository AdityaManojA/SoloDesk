import test from 'node:test';
import assert from 'node:assert/strict';
import {assertWorkspaceSize,MAX_WORKSPACE_BYTES} from '../src/workspace-size.js';
import {createWorkspaceSaves} from '../src/workspace-saves.js';

test('workspace size uses UTF-8 bytes including non-ASCII content',()=>{
  const workspace={notes:'₹'.repeat(100)};
  assert.equal(assertWorkspaceSize(workspace),new TextEncoder().encode(JSON.stringify(workspace)).byteLength);
  assert.throws(()=>assertWorkspaceSize({notes:'₹'.repeat(MAX_WORKSPACE_BYTES/2)}),{code:'workspace-too-large'});
});

test('oversized saves do not reach Firestore; a smaller retry succeeds',async()=>{
  let writes=0;const states=[];
  const saves=createWorkspaceSaves(async(owner,value)=>{assertWorkspaceSize(value);writes++;},(state,error)=>states.push([state,error?.code]));
  saves.begin('owner');assert.equal(await saves.save({notes:'x'.repeat(MAX_WORKSPACE_BYTES)}),false);
  assert.equal(writes,0);assert.deepEqual(states.at(-1),['error','workspace-too-large']);
  assert.equal(await saves.save({notes:'trimmed'}),true);assert.equal(writes,1);
});
