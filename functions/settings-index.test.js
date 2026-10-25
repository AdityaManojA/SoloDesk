import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSettings } from '../src/settings-index.js';
import { actionColour } from '../src/appearance.js';

test('search finds settings by the words people use', () => {
  assert.equal(searchSettings('bank')[0].title, 'Bank details');
  assert.equal(searchSettings('ifsc')[0].path, '#/settings/invoices');
  assert.equal(searchSettings('dark mode')[0].title, 'Light or dark mode');
  assert.equal(searchSettings('gst')[0].title, 'Tax ID (GSTIN, VAT)');
  assert.ok(searchSettings('backup').some(x => x.path === '#/backups'));
  assert.deepEqual(searchSettings(''), []);
});

test('custom colours are no longer applied', () => {
  assert.equal(actionColour('#101010').id, 'terracotta');
  assert.equal(actionColour('teal').id, 'teal');
});
