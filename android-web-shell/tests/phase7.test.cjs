const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../app/src/main/assets/phase7-core.js');
const security=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/phase7-security.js'),'utf8');

(async()=>{
  assert.equal(Core.validPin('1234'),true);
  assert.equal(Core.validPin('123456'),true);
  assert.equal(Core.validPin('123'),false);
  assert.equal(Core.validPin('12a4'),false);

  // iOS/Safari must treat EkinCep PINs as numeric security codes, not account passwords.
  assert.match(security,/\.tp-pinInput\{-webkit-text-security:disc/);
  assert.match(security,/function bindPinInputs\(/);
  assert.match(security,/webkitTextSecurity/);
  assert.match(security,/autocomplete=\\"one-time-code\\"/);
  assert.match(security,/pattern=\\"\[0-9\]\*\\"/);
  assert.match(security,/id=\\"tpPin1\\" class=\\"tp-pinInput\\"[^\n]*type=\\"text\\"/);
  assert.match(security,/id=\\"tpPin2\\" class=\\"tp-pinInput\\"[^\n]*type=\\"text\\"/);
  assert.match(security,/id=\\"tpUnlockPin\\" class=\\"tp-pinInput\\"[^\n]*type=\\"text\\"/);
  assert.match(security,/id=\\"tpBackupPin\\" class=\\"tp-backupPin tp-pinInput\\"[^\n]*type=\\"text\\"/);
  assert.match(security,/replace\(\/\\D\/g,''\)\.slice\(0,6\)/);
  assert.doesNotMatch(security,/id=\\"tpPin[12]\\"[^\n]*type=\\"password\\"/);
  assert.doesNotMatch(security,/id=\\"tpUnlockPin\\"[^\n]*type=\\"password\\"/);
  assert.doesNotMatch(security,/id=\\"tpBackupPin\\"[^\n]*type=\\"password\\"/);

  const sample={transactions:[{id:'a',category:'Mazot',amount:125000,note:'gizli-not'}],debts:[]};
  const envelope=await Core.encryptWithPin(sample,'4826',{iterations:1500});
  assert.equal(Core.isEncryptedEnvelope(envelope),true);
  const raw=JSON.stringify(envelope);
  assert.equal(raw.includes('gizli-not'),false);
  assert.equal(raw.includes('Mazot'),false);
  assert.equal(raw.includes('125000'),false);

  const opened=await Core.decryptWithPin(envelope,'4826');
  assert.deepEqual(opened,sample);
  await assert.rejects(()=>Core.decryptWithPin(envelope,'4827'),/decrypt_failed/);

  const txs=[
    {id:'1',type:'expense',amount:1000},
    {id:'2',type:'expense',amount:2000},
    {id:'3',type:'income',amount:5000}
  ];
  assert.equal(Core.markDeleted(txs,'2',1700000000000),true);
  assert.equal(txs.find(x=>x.id==='2').deletedAt,1700000000000);
  assert.deepEqual(Core.activeTransactions(txs).map(x=>x.id),['1','3']);
  const activeExpense=Core.activeTransactions(txs).filter(x=>x.type==='expense').reduce((s,x)=>s+x.amount,0);
  assert.equal(activeExpense,1000);
  assert.equal(Core.undoDeleted(txs,'2'),true);
  assert.equal('deletedAt' in txs.find(x=>x.id==='2'),false);
  assert.deepEqual(Core.activeTransactions(txs).map(x=>x.id),['1','2','3']);

  const backup=await Core.encryptWithPin({data:sample},'4826',{iterations:1500,format:Core.BACKUP_FORMAT});
  assert.equal(backup.format,Core.BACKUP_FORMAT);
  assert.equal(JSON.stringify(backup).includes('gizli-not'),false);
  assert.deepEqual((await Core.decryptWithPin(backup,'4826')).data,sample);

  console.log('Phase 7: PIN/encryption + iOS PIN input + soft-delete assertions passed');
})().catch(error=>{console.error(error);process.exit(1);});