'use strict';
const VERSION = 'df88a9c1fa80ec9f4ba3';
const FILES = [{"path":"index.html","sha256":"f8ecb57e466b30378cde7a343d8b7d15bbf3d452bda18f6bd001990d38e9e2e7"},{"path":"style.css","sha256":"36eaebc4ee93cd522fabb49d4b8f842e992289c5f276a894a9f7630b528843dd"},{"path":"app.js","sha256":"cca0621ac7b3daa86c9c6f0ebe9f8b1536d70fa55a74f1ecd1cee2835ea3f6ad"},{"path":"data.js","sha256":"4e1e7b498d1032ba1475800126a6bad9610734825aeb4703713f483aabd9a0eb"},{"path":"offline.js","sha256":"2f70a51159e8729166568b4014ce66da2646fbaf0e5212290fdd515455a17746"},{"path":"manifest.webmanifest","sha256":"d5a51d36e6c8d665f6665811165fb2bc8c7d6f8add21e843e17f1a50f9a1a3df"},{"path":"icon.svg","sha256":"fede4d15048977136cea5a6f73600f4a5e12b9f33b1fda08c50cadeee6249160"},{"path":"icon-180.png","sha256":"edeb9bb48223a0f9e05f7f34ccacf1dd60bd9d9d9636b902bf74138e291e356d"},{"path":"icon-192.png","sha256":"3f9625bd0f3402016dd7f6f31df6484ae1d7d150992820b7cd74072f8ec886be"},{"path":"icon-512.png","sha256":"d80e3468a1f5583218eb1597125aa992545ef47893599ac3d763c9f23ee2f641"},{"path":"icon-maskable.png","sha256":"d80e3468a1f5583218eb1597125aa992545ef47893599ac3d763c9f23ee2f641"},{"path":"fonts/golos-regular.ttf","sha256":"7c255885e99e7df35f846074e6b780ee166a725e565e3a67f760dd12f4e5b77a"},{"path":"fonts/golos-bold.ttf","sha256":"7a65aef4e473695804f3f52eda88f76c9fe9da271730aa11de8c786aa8bb9bf0"},{"path":"fonts/OFL.txt","sha256":"ff532f9e8789f09a9fdffc3c0954eedfb0a48be77b2e2eb90f5f82e4f347f50c"}];
const ROOT = new URL('./', self.location.href);
const PREFIX = `anatolia:${ROOT.href}:`;
const CACHE = PREFIX + VERSION;
const READY = new URL('__offline_ready__', ROOT).href;
const URLS = FILES.map(file => new URL(file.path, ROOT).href);
const ALLOWED = new Set(URLS);
const hex = buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
async function complete() {
  const cache = await caches.open(CACHE);
  if (!(await cache.match(READY))) return false;
  const entries = await Promise.all(URLS.map(url => cache.match(url)));
  return entries.every(Boolean);
}
async function verifiedResponses() {
  return Promise.all(FILES.map(async file => {
    const url = new URL(file.path, ROOT).href;
    const response = await fetch(new Request(url, {cache:'reload', credentials:'same-origin', redirect:'error'}));
    if (!response.ok || response.redirected || response.type === 'opaque') throw new Error('Incomplete release');
    const digest = hex(await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer()));
    if (digest !== file.sha256) throw new Error('Release integrity mismatch');
    return [url, response];
  }));
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // A changed worker or asset always gets a different candidate cache.
    const cache = await caches.open(CACHE);
    try {
      await cache.delete(READY);
      const responses = await verifiedResponses();
      for (const [url, response] of responses) await cache.put(url, response);
      await cache.put(READY, new Response(VERSION));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (!(await complete())) throw new Error('Offline release is incomplete');
    await self.clients.claim();
    await Promise.all((await caches.keys()).filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'APPLY_UPDATE') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'REPAIR_OFFLINE') event.waitUntil((async () => {
    try {
      const responses = await verifiedResponses();
      const cache = await caches.open(CACHE);
      for (const [url, response] of responses) await cache.put(url, response);
      await cache.put(READY, new Response(VERSION));
      event.ports[0]?.postMessage({ready:await complete()});
    } catch {event.ports[0]?.postMessage({ready:false});}
  })());
  if (event.data?.type === 'OFFLINE_STATUS') event.waitUntil((async () => {
    event.ports[0]?.postMessage({ready:await complete(), version:VERSION, assets:FILES.length});
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== ROOT.origin) return;
  const isHome = request.mode === 'navigate' && (url.pathname === ROOT.pathname || url.pathname === new URL('index.html', ROOT).pathname);
  const key = isHome ? new URL('index.html', ROOT).href : url.href;
  if (!isHome && !ALLOWED.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const response = await cache.match(key);
    if (response) return response;
    return fetch(request);
  })());
});
