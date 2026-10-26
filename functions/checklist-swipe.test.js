import test from 'node:test';
import assert from 'node:assert/strict';
import { checklistSwipe } from '../src/checklist-swipe.js';
import { shiftLevel } from '../src/checklist.js';
const start = { pointerId: 7, x: 100, y: 100, time: 1000 };
const end = (x, y = 102, time = 1250, pointerId = 7) => ({ pointerId, clientX: x, clientY: y, timeStamp: time });
test('right swipe nests an item and its children, left swipe restores the hierarchy', () => {
  const items = [{ id:'a',level:0 },{ id:'b',level:0 },{ id:'c',level:1 }];
  const nested = shiftLevel(items, 'b', checklistSwipe(start, end(160)));
  assert.deepEqual(nested.map(x => x.level), [0,1,2]);
  assert.deepEqual(shiftLevel(nested, 'b', checklistSwipe(start, end(40))), items);
  assert.deepEqual(shiftLevel(items, 'a', checklistSwipe(start, end(160))), items);
});
test('scrolling, small movements and long-press selection never change indentation', () => {
  for (const point of [end(120),end(160,160),end(160,102,2000)]) assert.equal(checklistSwipe(start, point),0);
});
test('cancelled and unrelated pointers cannot complete a swipe', () => {
  assert.equal(checklistSwipe(null, end(160)),0);
  assert.equal(checklistSwipe(start, end(160,102,1250,8)),0);
});
