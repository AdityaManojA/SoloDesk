// Run on your server: node examples/pull-calendar.mjs [from] [to] [output.json]
// SOLODESK_API_URL=https://YOUR_HOST/api/v1
// SOLODESK_API_KEY=<calendar-only key from SoloDesk>
import { writeFile } from 'node:fs/promises';

const base = process.env.SOLODESK_API_URL?.replace(/\/$/, '');
const key = process.env.SOLODESK_API_KEY;
if (!base || !key) throw new Error('Set SOLODESK_API_URL and SOLODESK_API_KEY on your server.');
const endpoint = new URL(base + '/calendar');
if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(endpoint.hostname)) throw new Error('Use HTTPS for your deployed API.');
const [from, to, output = 'solodesk-calendar.json'] = process.argv.slice(2);
if (from) endpoint.searchParams.set('from', from);
if (to) endpoint.searchParams.set('to', to);
endpoint.searchParams.set('limit', '500');
const events = []; let offset = 0;
do {
  endpoint.searchParams.set('offset', String(offset));
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000), redirect: 'error' });
  if (!response.ok) throw new Error(`SoloDesk returned HTTP ${response.status}. No output was written.`);
  const body = await response.json();
  if (!Array.isArray(body.data) || !body.meta || body.meta.schemaVersion !== 1) throw new Error('Unexpected API response.');
  events.push(...body.data);
  const next = body.meta.nextOffset;
  if (next !== null && (!Number.isSafeInteger(next) || next <= offset)) throw new Error('Invalid pagination cursor.');
  offset = next;
} while (offset !== null);
await writeFile(output, JSON.stringify({ source: 'solodesk', schemaVersion: 1, exportedAt: new Date().toISOString(), events }, null, 2), { encoding: 'utf8', mode: 0o600 });
console.log(`Saved ${events.length} calendar events to ${output}.`);
