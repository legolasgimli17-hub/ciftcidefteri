'use strict';

const VERSION='ekincep-pwa-v4';
const STATIC=`${VERSION}-static`;
const RUNTIME=`${VERSION}-runtime`;
const DATA=`${VERSION}-data`;
const WEATHER=`${VERSION}-weather`;
const SATELLITE=`${VERSION}-satellite`;
const PHOTOS=`${VERSION}-photos`;
const SHELL=['/','/index.html','/app-loader.js','/manifest.webmanifest','/icon.svg','/og.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(STATIC).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>!key.startsWith(VERSION)).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

function isAppAsset(url){
  return (url.hostname==='raw.githubusercontent.com'&&url.pathname.includes('/legolasgimli17-hub/ciftcidefteri/'))||
    (url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('/legolasgimli17-hub/ciftcidefteri@'));
}
function isWeather(url){return url.hostname==='api.open-meteo.com'||url.hostname==='geocoding-api.open-meteo.com';}
function isSatellite(url){return url.hostname==='server.arcgisonline.com'&&url.pathname.includes('/World_Imagery/MapServer/tile/');}
function isFarmPhoto(url){return url.hostname==='commons.wikimedia.org'||url.hostname==='upload.wikimedia.org';}
function isLiveData(url){return url.origin===self.location.origin&&(url.pathname==='/api/market'||url.pathname==='/api/fuel');}

async function trim(name,max){
  const cache=await caches.open(name);
  const keys=await cache.keys();
  if(keys.length<=max)return;
  await Promise.all(keys.slice(0,keys.length-max).map(key=>cache.delete(key)));
}

async function cacheFirst(request,name,maxEntries){
  const cache=await caches.open(name);
  const hit=await cache.match(request);
  if(hit)return hit;
  const response=await fetch(request);
  if(response&&(response.ok||response.type==='opaque')){await cache.put(request,response.clone());if(maxEntries)void trim(name,maxEntries);}
  return response;
}

async function networkFirst(request,name){
  const cache=await caches.open(name);
  try{
    const response=await fetch(request);
    if(response?.ok)await cache.put(request,response.clone());
    return response;
  }catch{
    const hit=await cache.match(request);
    if(hit)return hit;
    throw new Error('offline_miss');
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(isLiveData(url)){event.respondWith(networkFirst(event.request,DATA));return;}
  if(isSatellite(url)){event.respondWith(cacheFirst(event.request,SATELLITE,160));return;}
  if(isFarmPhoto(url)){event.respondWith(cacheFirst(event.request,PHOTOS,24));return;}
  if(isWeather(url)){event.respondWith(networkFirst(event.request,WEATHER));return;}
  if(isAppAsset(url)){event.respondWith(cacheFirst(event.request,RUNTIME,96));return;}
  if(url.origin===self.location.origin){
    event.respondWith(networkFirst(event.request,STATIC).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('/'))));
  }
});
