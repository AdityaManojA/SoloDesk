// Replaces the old app's service worker on taskflow-solodesk.web.app so installed copies stop serving the
// cached app: clear its caches, unregister, and send open tabs to terracove.web.app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) {
      const url = new URL(client.url);
      client.navigate('https://terracove.web.app' + url.pathname + url.search + url.hash);
    }
  })());
});
