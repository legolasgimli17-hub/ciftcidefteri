'use strict';

const VERSION='ekincep-pwa-v5';
const STATIC=`${VERSION}-static`;
const DATA=`${VERSION}-data`;
const WEATHER=`${VERSION}-weather`;
const SATELLITE=`${VERSION}-satellite`;
const PHOTOS=`${VERSION}-photos`;
const SHELL=[
  '/','/index.html','/app-loader.js','/manifest.webmanifest','/icon.svg','/og.svg',
  '/assets/index.html',
  '/assets/phase3-core.js','/assets/phase3.js',
  '/assets/phase4-core.js','/assets/phase4.js','/assets/phase4-compat.js',
  '/assets/phase5-core.js','/assets/phase5.js','/assets/phase6-polish.js',
  '/assets/phase7-core.js','/assets/phase7-security.js',
  '/assets/phase8-guard.js','/assets/phase8-redesign.js',
  '/assets/phase9-field-ui.js',
  '/assets/phase10-core.js','/assets/phase10-command.js','/assets/phase11-premium-home.js',
  '/assets/phase11-home.js','/assets/phase11-home-polish.js','/assets/phase11-satellite.js'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(STATIC).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>!key.startsWith(VERSION)).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
function isWeather(url){return url.hostname==='api.open-meteo.com'||url.hostname==='geocoding-api.open-meteo.com';}
function isSatellite(url){return url.hostname==='server.arcgisonline.com'&&url.pathname.includes('/World_Imagery/MapServer/tile/');}
function isFarmPhoto(url){return url.hostname==='commons.wikimedia.org'||url.hostname==='upload.wikimedia.org';}
function isLiveData(url){return url.origin===self.location.origin&&(/^\/api\/(market|fuel)$/.test(url.pathname));}
function isLocalAsset(url){return url.origin===self.location.origin&&url.pathname.startsWith('/assets/');}
async function trim(name,max){const cache=await caches.open(name),keys=await cache.keys();if(keys.length<=max)return;await Promise.all(keys.slice(0,keys.length-max).map(key=>cache.delete(key)));}
async function cacheFirst(request,name,maxEntries){const cache=await caches.open(name),hit=await cache.match(request);if(hit)return hit;const response=await fetch(request);if(response&&(response.ok||response.type==='opaque')){await cache.put(request,response.clone());if(maxEntries)void trim(name,maxEntries);}return response;}
async function networkFirst(request,name){const cache=await caches.open(name);try{const response=await fetch(request);if(response?.ok)await cache.put(request,response.clone());return response;}catch{const hit=await cache.match(request);if(hit)return hit;throw new Error('offline_miss');}}
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(isLiveData(url)){event.respondWith(networkFirst(event.request,DATA));return;}if(isSatellite(url)){event.respondWith(cacheFirst(event.request,SATELLITE,160));return;}if(isFarmPhoto(url)){event.respondWith(cacheFirst(event.request,PHOTOS,24));return;}if(isWeather(url)){event.respondWith(networkFirst(event.request,WEATHER));return;}if(isLocalAsset(url)){event.respondWith(cacheFirst(event.request,STATIC));return;}if(url.origin===self.location.origin)event.respondWith(networkFirst(event.request,STATIC).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('/'))));});
