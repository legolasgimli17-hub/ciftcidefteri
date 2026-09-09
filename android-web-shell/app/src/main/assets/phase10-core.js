(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.EkinCepPhase10Core=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const TILE=256;
function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function validLatLon(lat,lon){lat=Number(lat);lon=Number(lon);return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-85.05112878&&lat<=85.05112878&&lon>=-180&&lon<=180;}
function lngToWorldX(lng,z){return ((Number(lng)+180)/360)*TILE*Math.pow(2,z);}
function latToWorldY(lat,z){const s=Math.sin(Number(lat)*Math.PI/180);return (0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*TILE*Math.pow(2,z);}
function worldXToLng(x,z){return x/(TILE*Math.pow(2,z))*360-180;}
function worldYToLat(y,z){const n=Math.PI-2*Math.PI*y/(TILE*Math.pow(2,z));return 180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));}
function panLatLon(lat,lon,zoom,dx,dy){zoom=clamp(Math.round(Number(zoom)||6),2,19);if(!validLatLon(lat,lon))throw new Error('invalid_location');const x=lngToWorldX(lon,zoom)-Number(dx||0),y=latToWorldY(lat,zoom)-Number(dy||0);return {lat:clamp(worldYToLat(y,zoom),-85.05112878,85.05112878),lon:((worldXToLng(x,zoom)+540)%360)-180,zoom};}
function tileLayout(lat,lon,zoom,width,height,pad){zoom=clamp(Math.round(Number(zoom)||6),2,19);if(!validLatLon(lat,lon))throw new Error('invalid_location');width=Math.max(1,Number(width)||320);height=Math.max(1,Number(height)||320);pad=Math.max(0,Number(pad)||1);const cx=lngToWorldX(lon,zoom),cy=latToWorldY(lat,zoom),left=cx-width/2,top=cy-height/2;const minX=Math.floor(left/TILE)-pad,maxX=Math.floor((left+width)/TILE)+pad,minY=Math.max(0,Math.floor(top/TILE)-pad),maxY=Math.min(Math.pow(2,zoom)-1,Math.floor((top+height)/TILE)+pad),count=Math.pow(2,zoom),tiles=[];for(let y=minY;y<=maxY;y++){for(let x=minX;x<=maxX;x++){const wrapped=((x%count)+count)%count;tiles.push({z:zoom,x:wrapped,y,left:x*TILE-left,top:y*TILE-top});}}return tiles;}
function esriTileUrl(tile){return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`;}
function ageHours(iso,now){const t=Date.parse(iso||'');if(!Number.isFinite(t))return Infinity;return Math.max(0,((now||Date.now())-t)/3600000);}
function freshnessLabel(iso,now){const h=ageHours(iso,now);if(!Number.isFinite(h))return 'Güncelleme zamanı bilinmiyor';if(h<1)return 'Son 1 saat içinde';if(h<24)return `${Math.floor(h)} saat önce`;const d=Math.floor(h/24);return `${d} gün önce`;}
function safeLivePayload(value){if(!value||typeof value!=='object')return null;const source=String(value.source||'').slice(0,120),updatedAt=String(value.updatedAt||'');if(!source||!Number.isFinite(Date.parse(updatedAt)))return null;return {...value,source,updatedAt};}
function activeTransactions(list){return (list||[]).filter(t=>t&&!t.deletedAt);}
function parcelNames(list){return [...new Set(activeTransactions(list).map(t=>String(t.parcel||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));}
return {TILE,clamp,validLatLon,lngToWorldX,latToWorldY,worldXToLng,worldYToLat,panLatLon,tileLayout,esriTileUrl,ageHours,freshnessLabel,safeLivePayload,activeTransactions,parcelNames};
});