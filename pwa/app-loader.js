'use strict';

const REF='main';
const ROOT='android-web-shell/app/src/main/assets/';
const BASES=[
  `https://raw.githubusercontent.com/legolasgimli17-hub/ciftcidefteri/${REF}/${ROOT}`,
  `https://cdn.jsdelivr.net/gh/legolasgimli17-hub/ciftcidefteri@${REF}/${ROOT}`
];
const FILES=[
  'index.html',
  'phase3-core.js','phase3.js',
  'phase4-core.js','phase4.js','phase4-compat.js',
  'phase5-core.js','phase5.js','phase6-polish.js',
  'phase7-core.js','phase7-security.js',
  'phase8-guard.js','phase8-redesign.js',
  'phase9-field-ui.js',
  'phase10-core.js','phase10-command.js',
  'phase11-premium-home.js'
];
const CACHE_DB='ekincep-pwa-cache-v3';
const CACHE_STORE='assets';
const LAST_WEATHER='ekincep-last-weather-v1';

function openCacheDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(CACHE_DB,1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(CACHE_STORE))request.result.createObjectStore(CACHE_STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function idbGet(key){
  try{
    const db=await openCacheDb();
    return await new Promise((resolve,reject)=>{
      const request=db.transaction(CACHE_STORE,'readonly').objectStore(CACHE_STORE).get(key);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error);
    });
  }catch{return null;}
}

async function idbPut(key,value){
  try{
    const db=await openCacheDb();
    await new Promise((resolve,reject)=>{
      const request=db.transaction(CACHE_STORE,'readwrite').objectStore(CACHE_STORE).put(value,key);
      request.onsuccess=()=>resolve();
      request.onerror=()=>reject(request.error);
    });
  }catch{}
}

async function getAsset(name){
  for(const base of BASES){
    try{
      const response=await fetch(base+name,{cache:'no-store'});
      if(!response.ok)continue;
      const text=await response.text();
      void idbPut(name,text);
      return text;
    }catch{}
  }
  const cached=await idbGet(name);
  if(cached)return cached;
  throw new Error(`asset_unavailable:${name}`);
}

function installWebBridge(target){
  target.AndroidBridge={
    saveBackup(content,requestedName){
      try{
        const name=String(requestedName||'ekincep-yedek.json')
          .replace(/tarlapusula/gi,'ekincep')
          .replace(/[^a-zA-Z0-9._-]/g,'-')
          .slice(0,96);
        const blob=new Blob([String(content||'')],{type:'application/json'});
        const url=URL.createObjectURL(blob);
        const anchor=document.createElement('a');
        anchor.href=url;
        anchor.download=name.endsWith('.json')?name:`${name}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1400);
        target.onNativeBackupSaved?.(true,anchor.download);
      }catch{
        target.onNativeBackupSaved?.(false,'yedek oluşturulamadı');
      }
    },
    async fetchWeather(requestedLocation){
      const location=String(requestedLocation||'').trim();
      try{
        if(location.length<2||location.length>80)throw new Error('invalid_location');
        const geoResponse=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=tr&countryCode=TR&format=json`);
        if(!geoResponse.ok)throw new Error('geocoding_unavailable');
        const geocoding=await geoResponse.json();
        const place=geocoding.results?.[0];
        if(!place)throw new Error('location_not_found');
        const params=new URLSearchParams({
          latitude:String(place.latitude),longitude:String(place.longitude),
          current:'temperature_2m,weather_code',
          daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max',
          timezone:'auto',forecast_days:'3'
        });
        const forecastResponse=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        if(!forecastResponse.ok)throw new Error('forecast_unavailable');
        const forecast=await forecastResponse.json();
        const payload=JSON.stringify({
          name:place.name||location,admin1:place.admin1||'',
          latitude:place.latitude,longitude:place.longitude,forecast
        });
        localStorage.setItem(LAST_WEATHER,payload);
        target.onNativeWeather?.(true,payload);
      }catch{
        const cached=localStorage.getItem(LAST_WEATHER);
        target.onNativeWeather?.(Boolean(cached),cached||'weather_unavailable');
      }
    }
  };
}

function showBootError(message){
  const skeleton=document.getElementById('skeleton');
  const error=document.getElementById('error');
  const retry=document.getElementById('retry');
  if(skeleton)skeleton.style.display='none';
  if(error){error.textContent=message;error.style.display='block';}
  if(retry)retry.style.display='block';
}

async function boot(){
  const frame=document.getElementById('app');
  const error=document.getElementById('error');
  const retry=document.getElementById('retry');
  if(error)error.style.display='none';
  if(retry)retry.style.display='none';
  try{
    const all=await Promise.all(FILES.map(getAsset));
    const base=all[0];
    const scripts=all.slice(1);
    frame.onload=()=>{
      try{
        const target=frame.contentWindow;
        installWebBridge(target);
        let i=0;
        target.eval(scripts[i++]);
        target.eval('window.effective=window.eff;window.renderAll=window.render;');
        target.eval(scripts[i++]);
        target.eval('if(window.renderAll)window.render=window.renderAll;');
        while(i<scripts.length)target.eval(scripts[i++]);
        if(target.__TARLAPUSULA_SECURITY_READY__!==true)throw new Error('security_not_ready');
        frame.style.visibility='visible';
        document.getElementById('boot')?.remove();
      }catch(error){
        console.error(error);
        showBootError('Güvenli uygulama katmanı açılamadı. Kayıtların silinmedi; tekrar deneyebilirsin.');
      }
    };
    frame.srcdoc=base;
  }catch(error){
    console.error(error);
    showBootError('Uygulama dosyaları açılamadı. İnternet yoksa uygulamanın bu sürümünün daha önce en az bir kez açılmış olması gerekir. Kayıtların silinmedi.');
  }
}

document.getElementById('retry')?.addEventListener('click',()=>location.reload());
void boot();
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.error));
}
