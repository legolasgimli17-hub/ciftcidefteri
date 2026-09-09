const assert=require('node:assert/strict');
const Core=require('../app/src/main/assets/phase7-core.js');

(async()=>{
  assert.equal(Core.validPin('1234'),true);
  assert.equal(Core.validPin('123456'),true);
  assert.equal(Core.validPin('123'),false);
  assert.equal(Core.validPin('12a4'),false);

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

  console.log('Phase 7: PIN/encryption + soft-delete assertions passed');
})().catch(error=>{console.error(error);process.exit(1);});