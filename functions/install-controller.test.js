import test from 'node:test';
import assert from 'node:assert/strict';
import {createInstallController,installPlatform} from '../src/install-controller.js';
import {readFileSync} from 'node:fs';

function browser(standalone=false){
  const win=new EventTarget(),mode=new EventTarget();mode.matches=standalone;
  win.matchMedia=()=>mode;win.navigator={standalone:false};return {win,mode};
}
function offer(win,outcome='dismissed',fail=false){
  let count=0;const event=new Event('beforeinstallprompt',{cancelable:true});
  event.prompt=async()=>{count++;if(fail)throw new Error('Unavailable');};
  event.userChoice=Promise.resolve({outcome});win.dispatchEvent(event);
  return {event,count:()=>count};
}
test('install instructions detect iPhone, Android and desktop-class iPad',()=>{
  assert.equal(installPlatform({userAgent:'iPhone Safari'}),'ios');
  assert.equal(installPlatform({userAgent:'Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}),'ios');
  assert.equal(installPlatform({userAgent:'Android Chrome'}),'android');
  assert.equal(installPlatform({userAgent:'Windows Chrome'}),'desktop');
});
test('unsupported browsers retain instructions without claiming installation',async()=>{
  const {win}=browser(),controller=createInstallController(win);
  assert.equal(await controller.prompt(),false);
  assert.equal(controller.getSnapshot().installed,false);
  controller.dispose();
});
test('deferred prompt is captured, user-triggered, single-use and dismissible',async()=>{
  const {win}=browser(),controller=createInstallController(win),prompt=offer(win);
  assert.equal(prompt.event.defaultPrevented,true);assert.equal(controller.getSnapshot().canPrompt,true);
  assert.equal(prompt.count(),0);
  await controller.prompt();await controller.prompt();
  assert.equal(prompt.count(),1);assert.equal(controller.getSnapshot().installed,false);
  assert.match(controller.getSnapshot().message,/cancelled/);
  assert.equal(controller.getSnapshot().busy,false);controller.dispose();
});
test('acceptance does not report installed until appinstalled arrives',async()=>{
  const {win}=browser(),controller=createInstallController(win);offer(win,'accepted');
  await controller.prompt();assert.equal(controller.getSnapshot().installed,false);
  win.dispatchEvent(new Event('appinstalled'));assert.equal(controller.getSnapshot().installed,true);
  assert.equal(controller.getSnapshot().canPrompt,false);controller.dispose();
});
test('prompt failure recovers to manual instructions and standalone is recognized',async()=>{
  const {win,mode}=browser(),controller=createInstallController(win);offer(win,'accepted',true);
  await controller.prompt();assert.match(controller.getSnapshot().message,/could not/);
  assert.equal(controller.getSnapshot().busy,false);
  mode.matches=true;mode.dispatchEvent(new Event('change'));assert.equal(controller.getSnapshot().installed,true);
  mode.matches=false;mode.dispatchEvent(new Event('change'));assert.equal(controller.getSnapshot().installed,false);
  controller.dispose();
  const standalone=browser(true),installed=createInstallController(standalone.win);
  assert.equal(installed.getSnapshot().installed,true);installed.dispose();
});
test('all mounted install cards receive changes; disposal detaches listeners',()=>{
  const {win}=browser(),controller=createInstallController(win);let a=0,b=0;
  const remove=controller.subscribe(()=>a++);controller.subscribe(()=>b++);
  offer(win);assert.equal(a,1);assert.equal(b,1);remove();
  win.dispatchEvent(new Event('appinstalled'));assert.equal(a,1);assert.equal(b,2);
  controller.dispose();offer(win);assert.equal(b,2);
});
test('install manifest references real PNG icons at their declared sizes',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/#/dash');
  assert.equal(manifest.scope,'/');assert.equal(manifest.prefer_related_applications,false);
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512' && icon.purpose==='maskable'));
  for(const icon of [...manifest.icons,{src:'/brand/apple-touch-icon.png',sizes:'180x180'}]){
    const png=readFileSync(new URL('../public'+icon.src,import.meta.url)),[width,height]=icon.sizes.split('x').map(Number);
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
  }
});
