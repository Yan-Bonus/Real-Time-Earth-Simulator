import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,readdir,rm,mkdir,rmdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {ImageryStore,validatedTile} from '../electron/imagery-store.ts'
import {AdaptiveDownloads,retryDelay,motionDetailLevel} from '../src/imagery/scheduling.ts'
const tile={source:'eox',z:3,row:0,col:0}
test('Persistent imagery survives a new store instance; corruption and full disk retain resources',async()=>{
 const root=await mkdtemp(join(tmpdir(),'earth-store-')),bytes=await readFile('scripts/fixtures/eox-level3-0-0.jpg');let free=10n**12n
 try{const store=new ImageryStore(root,async()=>free);assert.equal(await store.save(tile,bytes),true);assert.deepEqual(await new ImageryStore(root).read(tile),new Uint8Array(bytes));free=0n;assert.equal(await store.save({...tile,col:1},bytes),false);assert.deepEqual(await store.read(tile),new Uint8Array(bytes));assert.equal(await store.read({...tile,col:1}),null);assert.match(store.warning,/空间不足/);const info=await store.info();assert.equal(info.tiles,1);assert.equal(info.bytes,bytes.length)
 const dir=join(root,'eox-s2cloudless-2024-WGS84','3','0');assert.equal((await readdir(dir)).some(n=>n.endsWith('.part')),false)
 await writeFile(join(dir,'0.tile'),Buffer.from('corrupt'));assert.equal(await store.read(tile),null);free=10n**12n;assert.equal(await store.save(tile,bytes),true);assert.deepEqual(await store.read(tile),new Uint8Array(bytes));await assert.rejects(store.save(tile,Buffer.from('invalid')))
 }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\'));await rm(root,{recursive:true,force:true})}
})
test('Unwritable library cannot prevent browsing; request coordinates cannot traverse paths',async()=>{
 const root=await mkdtemp(join(tmpdir(),'earth-unwritable-'));try{await writeFile(join(root,'file'),'x');const store=new ImageryStore(join(root,'file','child'));const bytes=await readFile('scripts/fixtures/eox-level3-0-0.jpg');assert.equal(await store.save(tile,bytes),false);assert.equal(await store.read(tile),null);assert.match(store.warning,/暂不可用/);for(const input of [{...tile,row:-1},{...tile,col:'../x'},{...tile,source:'x'},{...tile,z:14},{...tile,col:16}])assert.throws(()=>validatedTile(input))}finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\'));await rm(root,{recursive:true,force:true})}
})
test('Concurrent writes commit complete checksum pairs without partial files',async()=>{const root=await mkdtemp(join(tmpdir(),'earth-parallel-'));try{const store=new ImageryStore(root),bytes=await readFile('scripts/fixtures/eox-level3-0-0.jpg');await Promise.all(Array.from({length:8},(_,col)=>store.save({...tile,col},bytes)));assert.equal((await store.info()).tiles,8);for(let col=0;col<8;col++)assert.deepEqual(await store.read({...tile,col}),new Uint8Array(bytes))}finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\'));await rm(root,{recursive:true,force:true})}})
test('Adaptive downloads measure 4/6/8 throughput and retreat on failures',()=>{const a=new AdaptiveDownloads();let now=100;for(let phase=0;phase<3;phase++)for(let i=0;i<24;i++)a.success(1000,now+=phase===1?10:20);assert.equal(a.limit,6);a.failure(now,5000);assert.equal(a.limit,4);assert.equal(a.pauseUntil,now+5000);assert.equal(retryDelay(1,'30',0),30000);assert.equal(retryDelay(2,null,0),4000)})

test('Catalog detects full child coverage without claiming missing quarters',async()=>{const root=await mkdtemp(join(tmpdir(),'earth-catalog-'));try{const store=new ImageryStore(root),bytes=await readFile('scripts/fixtures/eox-level3-0-0.jpg'),parent={source:'eox',z:4,row:5,col:26};assert.equal(await store.canAssemble(parent),false);for(const row of [10,11])for(const col of [52,53])await store.save({source:'eox',z:5,row,col},bytes);assert.equal(await store.canAssemble(parent),true);assert.equal(await new ImageryStore(root).canAssemble(parent),true);assert.equal(await store.read(parent),null);assert.equal(await store.canAssemble({...parent,col:27}),false)}finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\'));await rm(root,{recursive:true,force:true})}})

test('Motion detail gates new requests without changing the static highest level',()=>{
 assert.equal(motionDetailLevel(180,13,.3,350,false),13)
 assert.equal(motionDetailLevel(180,13,.0044,350,true),13)
 assert.ok(motionDetailLevel(180,13,.26,350,true)<13)
 assert.equal(motionDetailLevel(180,13,5,1500,true),4)
 assert.ok(motionDetailLevel(180,13,.26,1500,true)<=motionDetailLevel(180,13,.26,150,true))
})

test('An identical saved image needs no new disk write even when space is low',async()=>{
 const root=await mkdtemp(join(tmpdir(),'earth-identical-'));let free=10n**12n
 try{const store=new ImageryStore(root,async()=>free),bytes=await readFile('scripts/fixtures/eox-level3-0-0.jpg');assert.equal(await store.save(tile,bytes),true);free=0n;assert.equal(await store.save({...tile,col:1},bytes),false);assert.equal(await store.save(tile,bytes),true);assert.match(store.warning,/空间不足/);assert.equal((await store.info()).tiles,1);assert.deepEqual(await store.read(tile),new Uint8Array(bytes))}
 finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\'));await rm(root,{recursive:true,force:true})}
})


test('A metadata commit failure preserves a complete new image across restart and subsequent saves',async()=>{
 const root=await mkdtemp(join(tmpdir(),'earth-recovery-'));
 try{const bytes=await readFile('scripts/fixtures/eox-level3-0-0.jpg');const changed=Buffer.concat([bytes,Buffer.from('updated valid image')]);
 const first=new ImageryStore(root);assert.equal(await first.save(tile,bytes),true);
 const broken=new ImageryStore(root,undefined,async()=>{throw Error('Injected metadata rename failure')});
 assert.equal(await broken.save(tile,changed),false);
 assert.deepEqual(await new ImageryStore(root).read(tile),new Uint8Array(changed));
 const recovered=new ImageryStore(root);assert.equal(await recovered.save(tile,bytes),true);
 assert.deepEqual(await new ImageryStore(root).read(tile),new Uint8Array(bytes));
 assert.equal((await readdir(join(root,'eox-s2cloudless-2024-WGS84','3','0'))).some(n=>n.endsWith('.pending')||n.endsWith('.part')),false);
 }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\'));await rm(root,{recursive:true,force:true})}
})

test('Abrupt exit after tile replacement leaves a readable journal and disk recovery clears warning',async()=>{
 const root=await mkdtemp(join(tmpdir(),'earth-abrupt-'));try{
 const bytes=await readFile('scripts/fixtures/eox-level3-0-0.jpg');const store=new ImageryStore(root);await store.save(tile,bytes);
 const child=spawnSync(process.execPath,['--input-type=module','-e',`import {ImageryStore} from ${JSON.stringify(pathToFileURL(resolve('electron/imagery-store.ts')).href)};import {readFile} from 'node:fs/promises';const b=Buffer.concat([await readFile('scripts/fixtures/eox-level3-0-0.jpg'),Buffer.from('new')]);await new ImageryStore(${JSON.stringify(root)},undefined,async()=>process.exit(71)).save(${JSON.stringify(tile)},b)`],{encoding:'utf8'});assert.equal(child.status,71,child.stderr);
 assert.deepEqual(await new ImageryStore(root).read(tile),new Uint8Array(Buffer.concat([bytes,Buffer.from('new')])));
 let free=0n;const disk=new ImageryStore(root,async()=>free);assert.equal(await disk.save({...tile,col:1},bytes),false);assert.match((await disk.info()).warning,/空间不足/);free=10n**12n;assert.equal((await disk.info()).warning,'');
 }finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\'));await rm(root,{recursive:true,force:true})}
})

test('Metadata staging write failure preserves the valid image and drains a blocked save queue',async()=>{
 const root=await mkdtemp(join(tmpdir(),'earth-write-fault-'));try{const bytes=await readFile('scripts/fixtures/eox-level3-0-0.jpg'),changed=Buffer.concat([bytes,Buffer.from('new valid image')]),store=new ImageryStore(root);await store.save(tile,bytes);const pending=join(root,'eox-s2cloudless-2024-WGS84','3','0','0.json.pending');await mkdir(pending);const tasks=Array.from({length:24},()=>store.save(tile,changed));assert.equal(store.activity.pending,24);assert.ok(store.activity.peakPendingBytes>=changed.length*24);assert.ok((await Promise.all(tasks)).every(v=>!v));await store.flush();assert.equal(store.activity.pending,0);assert.equal(store.activity.pendingBytes,0);assert.deepEqual(await new ImageryStore(root).read(tile),new Uint8Array(bytes));await rmdir(pending);assert.equal(await store.save(tile,changed),true);assert.equal(store.warning,'');assert.deepEqual(await new ImageryStore(root).read(tile),new Uint8Array(changed))}finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\'));await rm(root,{recursive:true,force:true})}
})
