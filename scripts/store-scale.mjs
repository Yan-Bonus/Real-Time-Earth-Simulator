import {writeFile,mkdir,cp} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {ImageryStore} from '../electron/imagery-store.ts'
import {extractFile} from '@electron/asar'
const out=path.resolve(process.env.EARTH_TEST_OUTPUT_ROOT?path.join(process.env.EARTH_TEST_OUTPUT_ROOT,'store-scale'):'test-results/v03-store-scale');await mkdir(out,{recursive:true});await writeFile(path.join(out,'old-store.mjs'),extractFile(process.env.EARTH_BASELINE_ASAR??'test-results/v03-reliability-before/app/resources/app.asar',path.normalize('dist-electron/imagery-store.js')));const {ImageryStore:Old}=await import(pathToFileURL(path.join(out,'old-store.mjs')).href)
const sources=['test-results/v03-ux-library/imagery','D:/RealTimeEarthSimulatorData/imagery'],rows=[];
for(let i=0;i<sources.length;i++){for(const [name,Store] of [[process.env.EARTH_BASELINE_ASAR?'alpha6':'alpha5',Old],['candidate',ImageryStore]]){const root=path.join(out,'paired-'+Date.now()+'-'+i+'-'+name);await cp(sources[i],root,{recursive:true});const store=new Store(root),t=performance.now(),bytes=await store.read({source:'eox',z:4,row:5,col:26}),readMs=performance.now()-t;const s=performance.now(),info=await store.info(),scanMs=performance.now()-s;const q=performance.now();await Promise.all(Array.from({length:24},(_,col)=>store.save({source:'eox',z:13,row:7999,col:10000+col},bytes)));await store.flush();rows.push({name,sourceTiles:info.tiles,readMs,scanMs,saveQueueMs:performance.now()-q,bytes:bytes.length,queue:store.activity??null})}}
await writeFile(path.join(out,'result.json'),JSON.stringify(rows,null,2));console.log(rows)
