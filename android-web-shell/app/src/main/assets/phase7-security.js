(function(){
'use strict';
if(window.__TARLAPUSULA_SECURITY__)return;
window.__TARLAPUSULA_SECURITY__=true;
const Core=window.TarlaPusulaSecurityCore;
if(!Core)throw new Error('phase7_core_missing');

let secureKey=null,secureSalt=null,transactionBacking=null,lastDeletedId=null,undoTimer=null;
const style=document.createElement('style');
style.textContent=`
.secure-locked .wrap,.secure-locked .bottom,.secure-locked .toast{visibility:hidden!important}
.tp-lock{position:fixed;inset:0;z-index:10000;background:linear-gradient(180deg,#f8faf7,#edf4ef);display:grid;place-items:center;padding:20px;color:#142119;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
.tp-lockCard{width:min(430px,100%);background:#fff;border:1px solid #dbe5de;border-radius:26px;padding:24px;box-shadow:0 22px 60px rgba(20,65,39,.14)}
.tp-lockLogo{width:52px;height:52px;border-radius:17px;background:linear-gradient(145deg,#1f7c53,#0f4e33);display:grid;place-items:center;color:#fff;font-size:26px;font-weight:950;margin-bottom:14px}
.tp-lock h1{font-size:24px;margin:0 0 6px}.tp-lock p{color:#66726a;font-size:13px;line-height:1.5;margin:0 0 14px}.tp-lockWarn{background:#fff7e6;border:1px solid #ecd8aa;color:#76500e;border-radius:13px;padding:11px;font-size:12px;line-height:1.45;margin:12px 0}
.tp-lock input{width:100%;min-height:54px;border:1.5px solid #cfdad2;border-radius:15px;padding:11px 13px;font-size:20px;letter-spacing:.22em;text-align:center;box-sizing:border-box;background:#fff}.tp-lock input:focus{outline:none;border-color:#74ad8c;box-shadow:0 0 0 4px rgba(23,103,68,.09)}
.tp-pinInput{-webkit-text-security:disc;text-security:disc;font-variant-numeric:tabular-nums}
.tp-lockBtn{width:100%;min-height:54px;border:0;border-radius:15px;background:linear-gradient(145deg,#1f7751,#176744);color:#fff;font-weight:900;font-size:16px;margin-top:12px}.tp-lockError{min-height:20px;color:#a43d3d;font-size:13px;font-weight:800;margin-top:9px;text-align:center}
.tp-modal{position:fixed;inset:0;z-index:9000;background:rgba(12,25,17,.45);display:grid;place-items:center;padding:18px}.tp-modalCard{width:min(410px,100%);background:#fff;border-radius:22px;padding:20px;box-shadow:0 24px 60px rgba(0,0,0,.22)}.tp-modalCard h3{margin:0 0 7px;font-size:19px}.tp-modalCard p{margin:0;color:#66726a;font-size:13px;line-height:1.5}.tp-modalActions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:17px}.tp-modalActions button{min-height:48px;border-radius:14px;font-weight:900}.tp-cancel{border:1px solid #dce5df;background:#fff;color:#142119}.tp-confirm{border:0;background:#a94444;color:#fff}
.tp-undo{position:fixed;left:50%;bottom:100px;transform:translateX(-50%);z-index:8500;width:min(430px,calc(100% - 24px));background:#142119;color:#fff;border-radius:16px;padding:12px 13px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 16px 40px rgba(0,0,0,.23);font-size:13px;font-weight:800}.tp-undo button{border:0;background:#e7f3eb;color:#176744;border-radius:11px;padding:9px 12px;font-weight:950}.tp-delete{border:1px solid #e7caca;color:#a43d3d;background:#fff7f7;border-radius:11px;padding:8px 10px;font-weight:900;margin-left:6px}
.tp-backupPin{letter-spacing:.18em!important;text-align:center!important}
`;
document.head.appendChild(style);

document.body.classList.add('secure-locked');
const lock=document.createElement('div');lock.id='tpLock';lock.className='tp-lock';lock.innerHTML='<div class="tp-lockCard"><div class="tp-lockLogo">⌁</div><h1>TarlaPusula kilitli</h1><p>Verilerin cihazında PIN ile şifreli tutulur.</p><div id="tpLockBody"></div></div>';
document.body.appendChild(lock);
window.__TARLAPUSULA_SECURITY_READY__=true;

function allTransactions(){
  const list=app&&app.transactions;
  return list&&list.__tpAllTransactions?list.__tpAllTransactions:(Array.isArray(list)?list:[]);
}
function activeTransactions(){return Core.activeTransactions(allTransactions());}
window.activeTransactions=activeTransactions;

function installTransactionView(){
  if(!app||typeof app!=='object')return;
  const current=app.transactions;
  if(current&&current.__tpTransactionsProxy){transactionBacking=current.__tpAllTransactions;return;}
  const target=Array.isArray(current)?current:[];
  transactionBacking=target;
  const active=()=>Core.activeTransactions(target);
  const activeMethods=new Set(['filter','map','reduce','reduceRight','forEach','some','every','find','findIndex','slice','includes','indexOf','at']);
  app.transactions=new Proxy(target,{
    get(t,p,r){
      if(p==='__tpTransactionsProxy')return true;
      if(p==='__tpAllTransactions')return t;
      if(p==='toJSON')return()=>t;
      if(p===Symbol.iterator)return function*(){for(const row of active())yield row;};
      if(p==='length')return active().length;
      if(activeMethods.has(p))return(...args)=>Array.prototype[p].apply(active(),args);
      if(p==='push')return(...args)=>t.push(...args);
      if(p==='unshift')return(...args)=>t.unshift(...args);
      if(p==='pop')return()=>{const a=active();const row=a[a.length-1];if(!row)return undefined;const i=t.indexOf(row);return i>=0?t.splice(i,1)[0]:undefined;};
      if(p==='shift')return()=>{const row=active()[0];if(!row)return undefined;const i=t.indexOf(row);return i>=0?t.splice(i,1)[0]:undefined;};
      if(typeof p==='string'&&/^\d+$/.test(p))return active()[Number(p)];
      return Reflect.get(t,p,r);
    },
    set(t,p,value,r){
      if(typeof p==='string'&&/^\d+$/.test(p)){const row=active()[Number(p)];const i=t.indexOf(row);if(i>=0){t[i]=value;return true;}}
      return Reflect.set(t,p,value,r);
    }
  });
}

async function readRaw(){
  let idbValue;
  try{
    if(!db)db=await openDb();
    idbValue=await new Promise((res,rej)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  }catch{}
  if(idbValue!==undefined&&idbValue!==null)return idbValue;
  try{const raw=localStorage.getItem(LS);return raw?JSON.parse(raw):null;}catch{return null;}
}

async function writeEnvelope(envelope){
  let idbOk=false,localOk=false;
  try{
    if(!db)db=await openDb();
    await new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(envelope,KEY);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});
    idbOk=true;
  }catch{}
  try{localStorage.setItem(LS,JSON.stringify(envelope));localOk=true;}catch{}
  if(!idbOk&&!localOk)throw new Error('secure_storage_write_failed');
  const s=document.getElementById('storageStatus');if(s)s.textContent='PIN ile korumalı';
}

async function secureSave(){
  if(!secureKey||!secureSalt)throw new Error('secure_key_missing');
  norm();installTransactionView();
  const envelope=await Core.encryptWithKey(app,secureKey,secureSalt,Core.FORMAT);
  await writeEnvelope(envelope);
}

function installSaveOverride(){
  window.save=secureSave;try{save=secureSave;}catch{}
}

function bindPinInputs(root=document){
  root.querySelectorAll('.tp-pinInput').forEach(input=>{
    const canMask='webkitTextSecurity' in input.style;
    input.type=canMask?'text':'password';
    if(canMask)input.style.webkitTextSecurity='disc';
    input.setAttribute('inputmode','numeric');
    input.setAttribute('pattern','[0-9]*');
    input.setAttribute('autocomplete','one-time-code');
    input.setAttribute('autocorrect','off');
    input.setAttribute('autocapitalize','none');
    input.setAttribute('spellcheck','false');
    input.addEventListener('input',()=>{
      const cleaned=input.value.replace(/\D/g,'').slice(0,6);
      if(input.value!==cleaned)input.value=cleaned;
    });
  });
}

function showSetup(legacy){
  const body=document.getElementById('tpLockBody');
  body.innerHTML='<p>İlk kullanım için 4–6 haneli bir PIN belirle.</p><div class="tp-lockWarn"><b>Önemli:</b> Bu PIN’i unutursan verilerine kimse ulaşamaz; biz de sıfırlayamayız.</div><input id="tpPin1" class="tp-pinInput" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="6" type="text" autocomplete="one-time-code" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="next" placeholder="PIN"><input id="tpPin2" class="tp-pinInput" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="6" type="text" autocomplete="one-time-code" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" placeholder="PIN tekrar" style="margin-top:9px"><button id="tpSetupBtn" class="tp-lockBtn" type="button">PIN’i oluştur</button><div id="tpLockError" class="tp-lockError"></div>';
  bindPinInputs(body);
  const first=document.getElementById('tpPin1'),second=document.getElementById('tpPin2');
  first.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();second.focus();}});
  second.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('tpSetupBtn').click();}});
  document.getElementById('tpSetupBtn').onclick=async()=>{
    const p1=first.value,p2=second.value,err=document.getElementById('tpLockError');
    if(!Core.validPin(p1)){err.textContent='PIN 4–6 rakam olmalı.';return;}
    if(p1!==p2){err.textContent='PIN’ler aynı değil.';return;}
    err.textContent='Şifreleme hazırlanıyor…';
    try{
      if(legacy&&typeof legacy==='object'&&!Core.isEncryptedEnvelope(legacy))app=legacy;
      norm();installTransactionView();
      secureSalt=Core.randomBytes(16);secureKey=await Core.deriveKey(p1,secureSalt,Core.PBKDF2_ITERATIONS);
      installSaveOverride();await secureSave();unlockUi();
    }catch(e){console.error(e);err.textContent='Güvenli kayıt oluşturulamadı.';}
  };
}

function showUnlock(envelope){
  const body=document.getElementById('tpLockBody');
  body.innerHTML='<p>Defterini açmak için PIN’ini gir.</p><input id="tpUnlockPin" class="tp-pinInput" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="6" type="text" autocomplete="one-time-code" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" placeholder="PIN"><button id="tpUnlockBtn" class="tp-lockBtn" type="button">Kilidi aç</button><div id="tpLockError" class="tp-lockError"></div>';
  bindPinInputs(body);
  const submit=async()=>{
    const pin=document.getElementById('tpUnlockPin').value,err=document.getElementById('tpLockError');
    if(!Core.validPin(pin)){err.textContent='PIN 4–6 rakam olmalı.';return;}
    err.textContent='Açılıyor…';
    try{
      const salt=Core.base64ToBytes(envelope.kdf.salt);const key=await Core.deriveKey(pin,salt,envelope.kdf.iterations);const data=await Core.decryptWithKey(envelope,key);
      app=data;norm();secureSalt=salt;secureKey=key;installTransactionView();installSaveOverride();unlockUi();
    }catch{err.textContent='PIN yanlış, tekrar dene.';document.getElementById('tpUnlockPin').select();}
  };
  document.getElementById('tpUnlockBtn').onclick=submit;document.getElementById('tpUnlockPin').addEventListener('keydown',e=>{if(e.key==='Enter')submit();});
}

function unlockUi(){
  installRuntimeOverrides();
  try{render();}catch(e){console.error(e);}
  document.body.classList.remove('secure-locked');document.getElementById('tpLock')?.remove();
  injectDeleteButtons();
}

function showDeleteModal(id){
  document.getElementById('tpDeleteModal')?.remove();
  const row=allTransactions().find(t=>t&&t.id===id&&!t.deletedAt);if(!row)return;
  const modal=document.createElement('div');modal.id='tpDeleteModal';modal.className='tp-modal';
  modal.innerHTML='<div class="tp-modalCard"><h3>Bu kayıt silinsin mi?</h3><p>Kayıt toplamlarından çıkarılacak. Silme işleminden sonra 6 saniye boyunca geri alabilirsin.</p><div class="tp-modalActions"><button class="tp-cancel" type="button">Vazgeç</button><button class="tp-confirm" type="button">Sil</button></div></div>';
  document.body.appendChild(modal);
  modal.querySelector('.tp-cancel').onclick=()=>modal.remove();
  modal.querySelector('.tp-confirm').onclick=async()=>{modal.remove();if(!Core.markDeleted(allTransactions(),id,Date.now()))return;await secureSave();try{render();}catch{}showUndo(id);};
}

function showUndo(id){
  clearTimeout(undoTimer);document.getElementById('tpUndo')?.remove();lastDeletedId=id;
  const bar=document.createElement('div');bar.id='tpUndo';bar.className='tp-undo';bar.innerHTML='<span>Kayıt silindi</span><button type="button">Geri al</button>';document.body.appendChild(bar);
  bar.querySelector('button').onclick=async()=>{if(lastDeletedId&&Core.undoDeleted(allTransactions(),lastDeletedId)){await secureSave();try{render();}catch{}}lastDeletedId=null;bar.remove();clearTimeout(undoTimer);};
  undoTimer=setTimeout(()=>{lastDeletedId=null;bar.remove();},6000);
}

function injectDeleteButtons(){
  document.querySelectorAll('.p5-record').forEach(record=>{
    const edit=record.querySelector('.p5-edit[data-id]');if(!edit||record.querySelector('.tp-delete'))return;
    const b=document.createElement('button');b.type='button';b.className='tp-delete';b.textContent='Sil';b.dataset.id=edit.dataset.id;b.onclick=()=>showDeleteModal(b.dataset.id);edit.insertAdjacentElement('afterend',b);
  });
}

function wrapRenderFunctions(){
  const oldRender=window.render;
  if(typeof oldRender==='function'&&!oldRender.__tpSecureWrapped){
    const wrapped=function(){installTransactionView();const out=oldRender.apply(this,arguments);injectDeleteButtons();return out;};wrapped.__tpSecureWrapped=true;window.render=wrapped;try{render=wrapped;}catch{}
  }
  const oldAll=window.renderAll;
  if(typeof oldAll==='function'&&!oldAll.__tpSecureWrapped){
    const wrappedAll=function(){installTransactionView();const out=oldAll.apply(this,arguments);injectDeleteButtons();return out;};wrappedAll.__tpSecureWrapped=true;window.renderAll=wrappedAll;try{renderAll=wrappedAll;}catch{}
  }
}

function secureBackupHint(){
  const card=document.querySelector('#subContent .card');if(!card)return;const hint=card.querySelector('.hint');
  if(hint)hint.textContent='Bu yedek PIN’inle korunuyor. Başka telefonda açarken yedeğin PIN’ini gireceksin.';
}

async function secureExportBackup(){
  if(!secureKey||!secureSalt){toast('Önce kilidi aç.');return;}
  try{
    const envelope=await Core.encryptWithKey({exportedAt:new Date().toISOString(),data:app},secureKey,secureSalt,Core.BACKUP_FORMAT);
    const payload=JSON.stringify(envelope);const name='tarlapusula-yedek-'+today()+'.json';
    if(window.AndroidBridge&&typeof AndroidBridge.saveBackup==='function'){AndroidBridge.saveBackup(payload,name);return;}
    const blob=new Blob([payload],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200);
  }catch(e){console.error(e);toast('Şifreli yedek oluşturulamadı.');}
}

function askBackupPin(){
  return new Promise(resolve=>{
    const modal=document.createElement('div');modal.className='tp-modal';modal.innerHTML='<div class="tp-modalCard"><h3>Yedek PIN’i</h3><p>Bu yedeği oluştururken kullandığın 4–6 haneli PIN’i gir.</p><input id="tpBackupPin" class="tp-backupPin tp-pinInput" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="6" type="text" autocomplete="one-time-code" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" style="width:100%;min-height:50px;margin-top:12px;border:1.5px solid #cfdad2;border-radius:14px;padding:10px"><div class="tp-modalActions"><button class="tp-cancel" type="button">Vazgeç</button><button class="tp-confirm" type="button" style="background:#176744">Aç</button></div></div>';document.body.appendChild(modal);
    bindPinInputs(modal);
    const pinInput=modal.querySelector('#tpBackupPin');
    pinInput.focus();
    pinInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();modal.querySelector('.tp-confirm').click();}});
    modal.querySelector('.tp-cancel').onclick=()=>{modal.remove();resolve(null);};modal.querySelector('.tp-confirm').onclick=()=>{const pin=pinInput.value;modal.remove();resolve(pin);};
  });
}

async function secureImportBackup(e){
  const f=e.target.files?.[0];if(!f)return;
  try{
    const envelope=JSON.parse(await f.text());if(!Core.isEncryptedEnvelope(envelope)||envelope.format!==Core.BACKUP_FORMAT)throw new Error('bad_backup');
    const pin=await askBackupPin();if(pin===null)return;if(!Core.validPin(pin)){toast('PIN 4–6 rakam olmalı.');return;}
    const decoded=await Core.decryptWithPin(envelope,pin);if(!decoded||!decoded.data)throw new Error('bad_backup');
    app=decoded.data;norm();installTransactionView();await secureSave();try{render();}catch{}toast('Şifreli yedek yüklendi.');
  }catch(e){console.error(e);toast('Yedek açılamadı. PIN veya dosya hatalı.');}
  e.target.value='';
}

function installRuntimeOverrides(){
  installTransactionView();installSaveOverride();
  window.delTx=showDeleteModal;try{delTx=showDeleteModal;}catch{}
  window.exportBackup=secureExportBackup;try{exportBackup=secureExportBackup;}catch{}
  window.importBackup=secureImportBackup;try{importBackup=secureImportBackup;}catch{}
  const oldShowSub=window.showSub;
  if(typeof oldShowSub==='function'&&!oldShowSub.__tpSecureWrapped){const wrapped=function(k){const out=oldShowSub.apply(this,arguments);if(k==='backup')secureBackupHint();injectDeleteButtons();return out;};wrapped.__tpSecureWrapped=true;window.showSub=wrapped;try{showSub=wrapped;}catch{}}
  wrapRenderFunctions();
  const observer=new MutationObserver(()=>injectDeleteButtons());observer.observe(document.body,{subtree:true,childList:true});
}

(async function startSecurity(){
  try{
    const raw=await readRaw();
    if(Core.isEncryptedEnvelope(raw)&&raw.format===Core.FORMAT)showUnlock(raw);
    else showSetup(raw&&typeof raw==='object'?raw:app);
  }catch(e){console.error(e);document.getElementById('tpLockBody').innerHTML='<div class="tp-lockWarn">Güvenli depolama başlatılamadı. Veriler gösterilmedi.</div>';}
})();
})();