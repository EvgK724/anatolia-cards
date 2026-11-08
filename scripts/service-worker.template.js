'use strict';
const VERSION = '__RELEASE_VERSION__';
const FILES = __RELEASE_FILES__;
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
