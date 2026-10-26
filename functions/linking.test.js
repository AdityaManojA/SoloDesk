import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from '../src/lib.js';
import { linkProject, linkableProjects } from '../src/linking.js';
import { validateWorkspace } from '../src/workspace-upgrades.js';

const base = () => ({ ...fresh(),
  clients: [{ id: 'a', name: 'Ava' }, { id: 'b', name: 'Bo' }],
  projects: [{ id: 'p1', name: 'Site', client: '', status: 'Active' }, { id: 'p2', name: 'App', client: 'b', status: 'Active' }],
  tasks: [{ id: 't1', title: 'Hero', project: 'p1', status: 'Todo' }, { id: 't2', title: 'Logo', project: 'p2', client: 'b', status: 'Todo' }, { id: 't3', title: 'Other', project: 'p2', client: 'a', status: 'Todo' }] });

test('linking a project brings its unassigned tasks along', () => {
  const w = base();
  linkProject(w, 'p1', 'a');
  assert.equal(w.projects[0].client, 'a'); assert.equal(w.tasks[0].client, 'a');
  assert.doesNotThrow(() => validateWorkspace(w));
});

test('moving a project moves tasks that followed the old client, not ones set elsewhere', () => {
  const w = base();
  assert.equal(linkProject(w, 'p2', 'a'), 'b');
  assert.equal(w.tasks[1].client, 'a'); assert.equal(w.tasks[2].client, 'a');
  linkProject(w, 'p2', '');
  assert.equal(w.projects[1].client, ''); assert.equal(w.tasks[1].client, '');
  assert.throws(() => linkProject(w, 'p2', 'nobody'), /client could not be found/);
});

test('the picker offers unassigned projects first, then other clients’ projects', () => {
  const { unassigned, others } = linkableProjects(base(), 'a');
  assert.deepEqual(unassigned.map(p => p.id), ['p1']); assert.deepEqual(others.map(p => p.id), ['p2']);
});
