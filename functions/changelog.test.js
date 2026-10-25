import test from 'node:test';
import assert from 'node:assert/strict';
import {changelog,currentVersion,shouldShowUpdate} from '../src/changelog.js';

test('release notes are newest first, uniquely versioned and dated once released',()=>{
  const versions=changelog.map(e=>Number(e.version));
  assert.deepEqual(versions,[...versions].sort((a,b)=>b-a));
  assert.equal(new Set(versions).size,versions.length);
  for(const entry of changelog){
    assert.match(entry.version,/^\d+\.\d{2}$/);
    if(entry.released)assert.match(entry.date,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.highlights.length&&entry.highlights.every(([title,text])=>title&&text));
  }
  assert.equal(currentVersion(),'1.02');
  assert.equal(shouldShowUpdate(null,false),false,'first visit: no update note');
  assert.equal(shouldShowUpdate('1.01',true),true);
  assert.equal(shouldShowUpdate('1.02',true),false);
  assert.equal(shouldShowUpdate(null,true),true,'returning from before notes existed');
});
