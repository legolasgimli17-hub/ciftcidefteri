'use strict';

const ASSET_ROOT='/assets/';
const SCRIPTS=[
  'phase3-core.js','phase3.js',
  'phase4-core.js','phase4.js','phase4-compat.js',
  'phase5-core.js','phase5.js','phase6-polish.js',
  'phase7-core.js','phase7-security.js',
  'phase8-guard.js','phase8-redesign.js',
  'phase9-field-ui.js',
  'phase10-core.js','phase10-command.js',
  'phase11-home.js','phase11-satellite.js'
];
const LAST_WEATHER='ekincep-last-weather-v1';

function installWebBridge(target){
  target.AndroidBridge={
    saveBackup(content,requestedName){
      try{
        const name=String(requestedName||'ekincep-yedek.json').replace(/tarlapusula/gi,'ekincep').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,96);
        const blob=new Blob([String(content||'')],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
        anchor.href=url;anchor.download=name.endsWith('.json')?name:`${name}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1400);target.onNativeBackupSaved?.(true,anchor.download);
      }catch{target.onNativeBackupSaved?.(false,'yedek oluşturulamadı');}
    },
    async fetchWeather(requestedLocation){
      const location=String(requestedLocation||'').trim();
      try{
        if(location.length<2||location.length>80)throw new Error('invalid_location');
        const geoResponse=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=tr&countryCode=TR&format=json`);if(!geoResponse.ok)throw new Error('geocoding_unavailable');
        const geocoding=await geoResponse.json(),place=geocoding.results?.[0];if(!place)throw new Error('location_not_found');
        const params=new URLSearchParams({latitude:String(place.latitude),longitude:String(place.longitude),current:'temperature_2m,weather_code',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max',timezone:'auto',forecast_days:'3'});
        const forecastResponse=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);if(!forecastResponse.ok)throw new Error('forecast_unavailable');
        const forecast=await forecastResponse.json(),payload=JSON.stringify({name:place.name||location,admin1:place.admin1||'',latitude:place.latitude,longitude:place.longitude,forecast});localStorage.setItem(LAST_WEATHER,payload);target.onNativeWeather?.(true,payload);
      }catch{const cached=localStorage.getItem(LAST_WEATHER);target.onNativeWeather?.(Boolean(cached),cached||'weather_unavailable');}
    }
  };
}
function showBootError(message){const skeleton=document.getElementById('skeleton'),error=document.getElementById('error'),retry=document.getElementById('retry');if(skeleton)skeleton.style.display='none';if(error){error.textContent=message;error.style.display='block';}if(retry)retry.style.display='block';}
function loadScript(doc,name){return new Promise((resolve,reject)=>{const script=doc.createElement('script');script.src=ASSET_ROOT+name;script.async=false;script.onload=()=>resolve();script.onerror=()=>reject(new Error(`asset_unavailable:${name}`));(doc.head||doc.documentElement).appendChild(script);});}
async function loadRuntime(target){const doc=target.document;await loadScript(doc,SCRIPTS[0]);target.effective=target.eff;target.renderAll=target.render;await loadScript(doc,SCRIPTS[1]);if(target.renderAll)target.render=target.renderAll;for(let i=2;i<SCRIPTS.length;i++)await loadScript(doc,SCRIPTS[i]);}
async function boot(){const frame=document.getElementById('app'),error=document.getElementById('error'),retry=document.getElementById('retry');if(error)error.style.display='none';if(retry)retry.style.display='none';frame.onload=async()=>{try{const target=frame.contentWindow;installWebBridge(target);await loadRuntime(target);if(target.__TARLAPUSULA_SECURITY_READY__!==true)throw new Error('security_not_ready');frame.style.visibility='visible';document.getElementById('boot')?.remove();}catch(runtimeError){console.error(runtimeError);showBootError('Güvenli uygulama katmanı açılamadı. Kayıtların silinmedi; tekrar deneyebilirsin.');}};frame.src=ASSET_ROOT+'index.html';}
document.getElementById('retry')?.addEventListener('click',()=>location.reload());void boot();if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.error));
