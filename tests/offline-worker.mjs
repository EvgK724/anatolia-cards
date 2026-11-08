import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
const fileList = JSON.parse(code.match(/const FILES = (.*);/)[1]);
const root = 'https://example.test/anatolia-cards/';
const memory = new Map();
const cacheStorage = {
  async open(name) { if (!memory.has(name)) memory.set(name,new Map());const data=memory.get(name);return {
    async match(key) {return data.get(String(key))?.clone();},
    async put(key,response) {data.set(String(key),response.clone());},
    async delete(key) {return data.delete(String(key));}
  };},
  async keys(){return [...memory.keys()];}, async delete(name){return memory.delete(name);}
};
const previous = 'anatolia:'+root+':previous';memory.set(previous,new Map([['retained',new Response('old')]]));
const unrelated = 'another-app';memory.set(unrelated,new Map());
let tamper = false, network = true, skipped = 0, claimed = 0;
async function fetchAsset(request) {
  if (!network) throw new TypeError('Network unavailable in unit test');
  const name=new URL(request.url??request).pathname.replace('/anatolia-cards/','');
  const bytes=await readFile(new URL('../dist/'+name,import.meta.url));
  return new Response(tamper && name==='app.js' ? 'authentication page' : bytes);
}
function worker(source=code){const handlers={};const self={location:{href:root+'sw.js'},clients:{async claim(){claimed++;}},async skipWaiting(){skipped++;},addEventListener(type,fn){handlers[type]=fn;}};vm.runInNewContext(source,{self,caches:cacheStorage,fetch:fetchAsset,Request,Response,URL,crypto:webcrypto,Uint8Array,Set,Promise,Error});return handlers;}
async function lifetime(handler,event={}) {let pending;handler({...event,waitUntil(p){pending=p;}});await pending;}
const one=worker();await lifetime(one.install);assert.equal(skipped,0,'update must not auto activate');assert.equal(memory.size,3);const release=(await cacheStorage.keys()).find(k=>k!==previous&&k!==unrelated);assert.equal(memory.get(release).size,fileList.length+1);
const bad=worker(code.replace(/const VERSION = '[^']+';/,"const VERSION = 'failed-candidate';"));tamper=true;await assert.rejects(lifetime(bad.install),/integrity/);assert(memory.has(release));assert(memory.has(previous));assert(!memory.has('anatolia:'+root+':failed-candidate'));tamper=false;
await lifetime(one.activate);assert.equal(claimed,1);assert(!memory.has(previous));assert(memory.has(unrelated));
network=false;let response;one.fetch({request:{url:root+'?saved=true',method:'GET',mode:'navigate'},respondWith(p){response=p;}});assert.match(await (await response).text(),/Малая Азия/);
for(const file of fileList){let result;one.fetch({request:{url:root+file.path,method:'GET',mode:'same-origin'},respondWith(p){result=p;}});assert(result,'precache asset must be intercepted');assert((await result).ok);}
let intercepted=false;one.fetch({request:{url:'https://source.example/paper',method:'GET',mode:'navigate'},respondWith(){intercepted=true;}});assert(!intercepted);one.fetch({request:{url:root+'missing.js',method:'GET',mode:'same-origin'},respondWith(){intercepted=true;}});assert(!intercepted);
let status;await lifetime(one.message,{data:{type:'OFFLINE_STATUS'},ports:[{postMessage(value){status=value;}}]});assert(status.ready);assert.equal(status.assets,fileList.length);
const missing=root+'style.css';memory.get(release).delete(missing);await lifetime(one.message,{data:{type:'OFFLINE_STATUS'},ports:[{postMessage(value){status=value;}}]});assert(!status.ready);
const preserved=memory.get(release).size;await lifetime(one.message,{data:{type:'REPAIR_OFFLINE'},ports:[{postMessage(value){status=value;}}]});assert(!status.ready);assert.equal(memory.get(release).size,preserved,'failed repair preserves cache');
network=true;await lifetime(one.message,{data:{type:'REPAIR_OFFLINE'},ports:[{postMessage(value){status=value;}}]});assert(status.ready);assert(memory.get(release).has(missing));
await lifetime(one.message,{data:{type:'APPLY_UPDATE'}});assert.equal(skipped,1);
console.log(JSON.stringify({tests:'PASS',assets:fileList.length,scope:'project subdirectory',checks:['complete precache','integrity rejection','old cache survives failed update','explicit activation','scope isolation','all cached assets','navigation fallback','external and missing requests untouched'],kind:'unit tests with in-memory Cache/Fetch, not a real browser offline run'}));
