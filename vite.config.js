import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react(),{
    name:'solodesk-offline-shell',
    generateBundle(options,bundle){
      const files=['/','/manifest.webmanifest','/brand/terracove-favicon.svg','/brand/terracove-32.png','/brand/terracove-180.png','/brand/terracove-192.png','/brand/terracove-512.png','/brand/terracove-maskable-512.png',...Object.keys(bundle).filter(name=>/\.(js|css)$/.test(name)).map(name=>'/'+name)];
      const version=files.join('|');
      const worker=`const FILES=${JSON.stringify(files)},CACHE='solodesk-shell-'+${JSON.stringify(version)}.split('').reduce((a,c)=>((a*31+c.charCodeAt(0))>>>0),0);self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(url=>new Request(url,{cache:'reload'}))))));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('solodesk-shell-')&&key!==CACHE).map(key=>caches.delete(key))))));self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/__/')||url.pathname.startsWith('/api/'))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/'))));}else if(FILES.includes(url.pathname)){event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));}});`;
      this.emitFile({type:'asset',fileName:'sw.js',source:worker});
    }
  }],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase-auth', test: /node_modules[\\/]@firebase[\\/]auth[\\/]/, priority: 30 },
            { name: 'firebase-firestore', test: /node_modules[\\/]@firebase[\\/]firestore[\\/]/, priority: 30 },
            { name: 'firebase-core', test: /node_modules[\\/](@firebase|firebase)[\\/]/, priority: 20 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
