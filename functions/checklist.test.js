import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftLevel, toggleItem, insertAfter, removeItem, normalize, linesToItems, itemsToLines } from '../src/checklist.js';

const list = () => [
  { id: 'a', title: 'profile', level: 0 }, { id: 'b', title: 'shows clients', level: 1 }, { id: 'c', title: 'links', level: 1 },
  { id: 'd', title: 'client dashboard', level: 0 }, { id: 'e', title: 'progress', level: 1 },
];
const levels = items => items.map(x => x.id + (x.level || 0)).join(' ');

test('Tab indents under the item above, never deeper than one level past it', () => {
  assert.equal(levels(shiftLevel(list(), 'a', 1)), 'a0 b1 c1 d0 e1', 'the first item cannot be indented');
  assert.equal(levels(shiftLevel(list(), 'c', 1)), 'a0 b1 c2 d0 e1');
  assert.equal(levels(shiftLevel(shiftLevel(list(), 'c', 1), 'c', 1)), 'a0 b1 c2 d0 e1', 'only one level past the item above');
});

test('indenting or outdenting a parent moves its sub-items with it', () => {
  assert.equal(levels(shiftLevel(list(), 'd', 1)), 'a0 b1 c1 d1 e2');
  assert.equal(levels(shiftLevel(shiftLevel(list(), 'd', 1), 'd', -1)), 'a0 b1 c1 d0 e1');
});

test('ticking a parent ticks its sub-items; items stay in place', () => {
  const ticked = toggleItem(list(), 'a');
  assert.deepEqual(ticked.map(x => !!x.done), [true, true, true, false, false]);
  assert.deepEqual(ticked.map(x => x.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(toggleItem(ticked, 'b').map(x => !!x.done), [true, false, true, false, false]);
});

test('new items keep the level of the line they follow; removing keeps the outline valid', () => {
  assert.equal(levels(insertAfter(list(), 'b', { id: 'n', title: '' })), 'a0 b1 n1 c1 d0 e1');
  assert.equal(levels(removeItem(list(), 'd')), 'a0 b1 c1 e1');
  assert.equal(levels(normalize([{ id: 'x', level: 2 }, { id: 'y', level: 4 }])), 'x0 y1');
});

test('text and checklists convert both ways and keep indentation', () => {
  let n = 0;
  const items = linesToItems('SoloDesk\n  profile\n    links\n- approval\n\n', () => 'i' + n++);
  assert.deepEqual(items.map(x => [x.title, x.level]), [['SoloDesk', 0], ['profile', 1], ['links', 2], ['approval', 0]]);
  assert.equal(itemsToLines(items), 'SoloDesk\n  profile\n    links\napproval');
});
