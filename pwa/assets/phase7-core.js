(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TarlaPusulaSecurityCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  const FORMAT='tarlapusula-secure-v1';
  const BACKUP_FORMAT='tarlapusula-encrypted-backup-v1';
  const PBKDF2_ITERATIONS=310000;
  const encoder=new TextEncoder();
  const decoder=new TextDecoder();

  function webCrypto(){
    if(root&&root.crypto&&root.crypto.subtle)return root.crypto;
    if(typeof require==='function')return require('node:crypto').webcrypto;
    throw new Error('web_crypto_unavailable');
  }

  function validPin(pin){return /^\d{4,6}$/.test(String(pin||''));}
  function bytesToBase64(bytes){
    if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64');
    let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);
  }
  function base64ToBytes(value){
    if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(String(value),'base64'));
    const s=atob(String(value));const out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;
  }
  function randomBytes(length){const out=new Uint8Array(length);webCrypto().getRandomValues(out);return out;}

  async function deriveKey(pin,salt,iterations){
    if(!validPin(pin))throw new Error('invalid_pin');
    const rounds=Number(iterations||PBKDF2_ITERATIONS);
    if(!Number.isInteger(rounds)||rounds<1000)throw new Error('invalid_iterations');
    const c=webCrypto();
    const material=await c.subtle.importKey('raw',encoder.encode(String(pin)),'PBKDF2',false,['deriveKey']);
    return c.subtle.deriveKey({name:'PBKDF2',salt,iterations:rounds,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }

  async function encryptWithKey(value,key,salt,format){
    const c=webCrypto();
    const iv=randomBytes(12);
    const plain=encoder.encode(JSON.stringify(value));
    const ciphertext=new Uint8Array(await c.subtle.encrypt({name:'AES-GCM',iv},key,plain));
    return {
      format:format||FORMAT,
      v:1,
      kdf:{name:'PBKDF2',hash:'SHA-256',iterations:PBKDF2_ITERATIONS,salt:bytesToBase64(salt)},
      cipher:{name:'AES-GCM',iv:bytesToBase64(iv)},
      ciphertext:bytesToBase64(ciphertext)
    };
  }

  async function decryptWithKey(envelope,key){
    if(!isEncryptedEnvelope(envelope))throw new Error('invalid_envelope');
    const c=webCrypto();
    try{
      const plain=await c.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(envelope.cipher.iv)},key,base64ToBytes(envelope.ciphertext));
      return JSON.parse(decoder.decode(plain));
    }catch{throw new Error('decrypt_failed');}
  }

  async function encryptWithPin(value,pin,options){
    const opts=options||{};
    const salt=opts.salt?new Uint8Array(opts.salt):randomBytes(16);
    const iterations=opts.iterations||PBKDF2_ITERATIONS;
    const key=await deriveKey(pin,salt,iterations);
    const c=webCrypto();
    const iv=randomBytes(12);
    const plain=encoder.encode(JSON.stringify(value));
    const ciphertext=new Uint8Array(await c.subtle.encrypt({name:'AES-GCM',iv},key,plain));
    return {
      format:opts.format||FORMAT,
      v:1,
      kdf:{name:'PBKDF2',hash:'SHA-256',iterations,salt:bytesToBase64(salt)},
      cipher:{name:'AES-GCM',iv:bytesToBase64(iv)},
      ciphertext:bytesToBase64(ciphertext)
    };
  }

  async function decryptWithPin(envelope,pin){
    if(!isEncryptedEnvelope(envelope))throw new Error('invalid_envelope');
    const salt=base64ToBytes(envelope.kdf.salt);
    const key=await deriveKey(pin,salt,envelope.kdf.iterations);
    return decryptWithKey(envelope,key);
  }

  function isEncryptedEnvelope(value){
    return !!value&&typeof value==='object'&&
      (value.format===FORMAT||value.format===BACKUP_FORMAT)&&
      value.kdf&&value.kdf.name==='PBKDF2'&&value.kdf.hash==='SHA-256'&&
      Number.isInteger(Number(value.kdf.iterations))&&typeof value.kdf.salt==='string'&&
      value.cipher&&value.cipher.name==='AES-GCM'&&typeof value.cipher.iv==='string'&&
      typeof value.ciphertext==='string';
  }

  function activeTransactions(transactions){return (Array.isArray(transactions)?transactions:[]).filter(t=>t&&!t.deletedAt);}
  function markDeleted(transactions,id,now){
    const row=(Array.isArray(transactions)?transactions:[]).find(t=>t&&t.id===id);
    if(!row)return false;
    row.deletedAt=Number.isFinite(Number(now))?Number(now):Date.now();
    return true;
  }
  function undoDeleted(transactions,id){
    const row=(Array.isArray(transactions)?transactions:[]).find(t=>t&&t.id===id);
    if(!row)return false;
    delete row.deletedAt;
    return true;
  }

  return {FORMAT,BACKUP_FORMAT,PBKDF2_ITERATIONS,validPin,bytesToBase64,base64ToBytes,randomBytes,deriveKey,encryptWithKey,decryptWithKey,encryptWithPin,decryptWithPin,isEncryptedEnvelope,activeTransactions,markDeleted,undoDeleted};
});