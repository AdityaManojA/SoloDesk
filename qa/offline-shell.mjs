import {readFile,access} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const listeners=new Map(),stored=new Map();
const cache={async addAll(requests){for(const request of requests){const path=request.url==='/'?'index.html':request.url.slice(1);await access('dist/'+path);stored.set(request.url,await readFile('dist/'+path,'utf8'));}},async match(path){return stored.get(path);}};
runInNewContext(await readFile('dist/sw.js','utf8'),{URL,Request:class{constructor(url){this.url=url;}},self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>listeners.set(name,fn)},caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},fetch:async()=>{throw Error('Offline');}});
let install;listeners.get('install')({waitUntil:promise=>install=promise});await install;
assert.ok([...stored.keys()].some(path=>path.includes('firebase-auth')));assert.ok([...stored.keys()].some(path=>path.endsWith('.css')));
let navigation;listeners.get('fetch')({request:{url:'https://example.test/',method:'GET',mode:'navigate'},respondWith:p=>navigation=p});assert.ok((await navigation).includes('<div id="root">'));
for(const url of ['https://example.test/api/v1/workspace','https://example.test/__/auth/handler','https://firestore.googleapis.com/private','https://identitytoolkit.googleapis.com/account']){let intercepted=false;listeners.get('fetch')({request:{url,method:'GET',mode:'cors'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);}
console.log('Offline shell: all precached build files exist; offline navigation falls back to app HTML; API/auth/Firestore responses are not intercepted.');
