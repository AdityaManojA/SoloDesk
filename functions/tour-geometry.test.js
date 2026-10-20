import test from 'node:test';
import assert from 'node:assert/strict';
import {tourHighlight,placeTourCard} from '../src/tour-geometry.js';

test('spotlight follows the target radius and clips every edge to the visible viewport',()=>{
  const viewport={left:0,top:0,width:390,height:844};
  const rect=tourHighlight({left:-10,top:100,right:400,bottom:150,width:410,height:50},'12px',viewport);
  assert.deepEqual(rect,{left:2,top:95,width:386,height:60,borderRadius:17});
  const circle=tourHighlight({left:150,top:700,right:226,bottom:776,width:76,height:76},'50%',viewport);
  assert.equal(circle.borderRadius,43);
  assert.equal(tourHighlight({left:0,top:900,right:100,bottom:950,width:100,height:50},'0px',viewport),null);
});

test('callout sits beside a control rather than at a distant screen corner',()=>{
  const rect={left:1000,top:110,width:180,height:48};
  const card=placeTourCard(rect,{width:420,height:450},{left:0,top:0,width:1280,height:720});
  assert.equal(card.side,'left');assert.equal(card.left+420,rect.left-16);
  assert.ok(card.top>=12&&card.top+450<=708);
});

test('phone callouts fit below a target and constrain scrolling instead of covering it',()=>{
  const rect={left:12,top:90,width:140,height:150};
  const card=placeTourCard(rect,{width:296,height:470},{left:0,top:0,width:320,height:568});
  assert.equal(card.side,'below');assert.equal(card.top,256);assert.equal(card.maxHeight,300);
  assert.ok(card.left>=12&&card.left+296<=308);
});

test('visual viewport pan offsets are removed from local callout positioning',()=>{
  const card=placeTourCard({left:112,top:190,width:140,height:150},{width:296,height:470},{left:100,top:100,width:320,height:568});
  assert.equal(card.top,256);assert.equal(card.left,12);
});
