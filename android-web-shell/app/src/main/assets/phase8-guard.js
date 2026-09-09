(function(){
'use strict';
if(window.__EKINCEP_PHASE8_GUARD__)return;
window.__EKINCEP_PHASE8_GUARD__=true;
const NativeMutationObserver=window.MutationObserver;
if(typeof NativeMutationObserver==='function'){
  class GuardedMutationObserver{
    constructor(callback){this.callback=callback;this.targets=[];this.native=new NativeMutationObserver((records)=>{this.native.disconnect();try{this.callback(records,this);}finally{for(const item of this.targets)this.native.observe(item.target,item.options);}});}
    observe(target,options){const existing=this.targets.find(item=>item.target===target);if(existing)existing.options=options;else this.targets.push({target,options});this.native.observe(target,options);}
    disconnect(){this.targets=[];this.native.disconnect();}
    takeRecords(){return this.native.takeRecords();}
  }
  window.MutationObserver=GuardedMutationObserver;
  queueMicrotask(()=>{if(window.MutationObserver===GuardedMutationObserver)window.MutationObserver=NativeMutationObserver;});
}
if(location.protocol==='file:'&&!window.__EKINCEP_PHASE11_BOOTSTRAP__){
  window.__EKINCEP_PHASE11_BOOTSTRAP__=true;
  setTimeout(()=>{
    if(window.__EKINCEP_PHASE11_HOME__)return;
    const home=document.createElement('script');home.src='phase11-home.js';
    home.onload=()=>{if(window.__EKINCEP_PHASE11_SATELLITE__)return;const sat=document.createElement('script');sat.src='phase11-satellite.js';sat.onerror=()=>console.error('phase11_satellite_load_failed');document.head.appendChild(sat);};
    home.onerror=()=>console.error('phase11_home_load_failed');
    document.head.appendChild(home);
  },0);
}
})();
