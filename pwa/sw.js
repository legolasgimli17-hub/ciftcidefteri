const VERSION='ekincep-pwa-v6';
const STATIC=VERSION+'-static',RUNTIME=VERSION+'-runtime',WEATHER=VERSION+'-weather',MAPS=VERSION+'-maps',SATMETA=VERSION+'-satmeta';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg','./og.svg'];
const MAX_MAP_ENTRIES=120;

self.addEventListener('install',e=>e.waitUntil(
  caches.open(STATIC).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>!k.startsWith(VERSION)).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

const isAppAsset=u=>(u.hostname==='raw.githubusercontent.com'&&u.pathname.includes('/legolasgimli17-hub/ciftcidefteri/'))||(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes('/legolasgimli17-hub/ciftcidefteri@'));
const isWeather=u=>u.hostname==='api.open-meteo.com'||u.hostname==='geocoding-api.open-meteo.com';
const isMapTile=u=>u.hostname==='tile.openstreetmap.org'||u.hostname==='server.arcgisonline.com';
const isSatelliteMeta=u=>u.hostname==='catalogue.dataspace.copernicus.eu';
const cacheable=r=>r&&(r.ok||r.type==='opaque');

async function trimCache(name,maxEntries){
  const c=await caches.open(name),keys=await c.keys();
  if(keys.length<=maxEntries)return;
  await Promise.all(keys.slice(0,keys.length-maxEntries).map(k=>c.delete(k)));
}
async function networkFirst(req,name){
  const c=await caches.open(name);
  try{
    const r=await fetch(req);
    if(cacheable(r))c.put(req,r.clone());
    return r;
  }catch{
    const hit=await c.match(req);
    if(hit)return hit;
    throw new Error('offline_miss');
  }
}
async function staleWhileRevalidate(req,name,maxEntries){
  const c=await caches.open(name),hit=await c.match(req);
  const fresh=fetch(req).then(async r=>{
    if(cacheable(r)){
      await c.put(req,r.clone());
      await trimCache(name,maxEntries);
    }
    return r;
  }).catch(()=>null);
  if(hit){fresh.catch(()=>{});return hit;}
  const r=await fresh;
  if(r)return r;
  throw new Error('offline_miss');
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin===self.location.origin){e.respondWith(networkFirst(e.request,STATIC).catch(()=>caches.match('./')));return;}
  if(isAppAsset(u)){e.respondWith(networkFirst(e.request,RUNTIME));return;}
  if(isWeather(u)){e.respondWith(networkFirst(e.request,WEATHER));return;}
  if(isSatelliteMeta(u)){e.respondWith(networkFirst(e.request,SATMETA));return;}
  if(isMapTile(u))e.respondWith(staleWhileRevalidate(e.request,MAPS,MAX_MAP_ENTRIES));
});
