const VERSION='ekincep-pwa-v3';
const STATIC=VERSION+'-static',RUNTIME=VERSION+'-runtime',WEATHER=VERSION+'-weather';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg','/og.svg','/field-hero.webp'];

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
async function cacheFirst(req,name){
  const c=await caches.open(name),hit=await c.match(req);
  if(hit)return hit;
  const r=await fetch(req);
  if(r&&r.ok)c.put(req,r.clone());
  return r;
}
async function networkFirst(req,name){
  const c=await caches.open(name);
  try{
    const r=await fetch(req);
    if(r&&r.ok)c.put(req,r.clone());
    return r;
  }catch{
    const hit=await c.match(req);
    if(hit)return hit;
    throw new Error('offline_miss');
  }
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin===self.location.origin){e.respondWith(networkFirst(e.request,STATIC).catch(()=>caches.match('/')));return;}
  if(isAppAsset(u)){e.respondWith(cacheFirst(e.request,RUNTIME));return;}
  if(isWeather(u))e.respondWith(networkFirst(e.request,WEATHER));
});
