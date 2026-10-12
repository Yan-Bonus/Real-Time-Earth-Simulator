import assert from 'node:assert/strict'
import path from 'node:path'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {mkdir,readFile,readdir,writeFile,copyFile,cp} from 'node:fs/promises'
const require=createRequire(import.meta.url),asar=require('@electron/asar')
const stamp=process.argv[2]??new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})
assert.match(stamp,/^\d{4}-\d{2}-\d{2}$/)
const output=path.resolve(process.argv[4]??'test-results/v03-acceptance-'+stamp)
await mkdir(output,{recursive:true})
const performanceStage=path.basename(output).replace(/^v03-/,''),loadingOutput=path.join(output,'loading-test')
const exe=path.resolve(process.argv[3]??'release/win-unpacked/Real-Time Earth Simulator.exe')
const archive=path.join(path.dirname(exe),'resources/app.asar')
const pkg=JSON.parse(await readFile('package.json','utf8'))
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,pkg.version)
const manifest=[]
for(const folder of ['dist/assets','dist-electron'])for(const name of await readdir(folder)){
 if(!/\.(js|css|cjs)$/.test(name))continue
 const file=path.join(folder,name),bytes=await readFile(file)
 assert.ok(bytes.equals(asar.extractFile(archive,file)),'Package must match the current build: '+file)
 manifest.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
}
for(const file of ['dist/imagery/eox-2024-global.png','dist/audio/background-music.mp3']){
 const bytes=await readFile(file);assert.ok(bytes.equals(asar.extractFile(archive,path.normalize(file))))
 manifest.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
}
await writeFile(path.join(output,'build-manifest.json'),JSON.stringify({version:pkg.version,exe,files:manifest},null,2))
const steps=[
 ['unit',['--test',...['simulation','solar','time','rotation','tiles','hd','clear-view','imagery-store','imagery-failures'].map(name=>'scripts/'+name+'.test.mjs')]],
 ['time',['scripts/simulation-smoke.mjs',exe]],['solar',['scripts/solar-smoke.mjs',exe]],
 ['music',['scripts/music-smoke.mjs',exe]],['cosmos',['scripts/cosmic-smoke.mjs',exe]],
 ['v01',['scripts/v01-smoke.mjs',exe]],
 ['performance',['scripts/v03-performance.mjs',performanceStage,exe,...process.argv[5]?[process.argv[5]]:[]]],
 ['loading',['scripts/v03-loading.mjs',exe,loadingOutput,...process.argv[6]?[process.argv[6]]:[]]],
 ['views',['scripts/visual-review.mjs',performanceStage,exe,'--views-only']],
]
const prior=process.argv.includes('--resume')?JSON.parse(await readFile(path.join(output,'summary.json'),'utf8').catch(()=>'{}')):null
const results=[]
if(prior?.version===pkg.version)for(const step of prior.steps??[]){if(step.code!==0)break;results.push(step)}
for(const [name,args]of steps.slice(results.length)){
 console.log('RUN '+name)
 const started=performance.now(),log=[]
 const child=spawn(process.execPath,args,{cwd:process.cwd(),env:process.env,windowsHide:true})
 child.stdout.on('data',chunk=>log.push(chunk));child.stderr.on('data',chunk=>log.push(chunk))
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})
 await writeFile(path.join(output,name+'.log'),Buffer.concat(log))
 results.push({name,code,elapsedMs:Math.round(performance.now()-started),args})
 await writeFile(path.join(output,'summary.json'),JSON.stringify({version:pkg.version,steps:results,technicalAcceptance:code===0&&results.length===steps.length,humanVisualAcceptance:'pending'},null,2))
 console.log((code===0?'PASS ':'FAIL ')+name)
 if(code!==0)throw Error('Acceptance stopped: '+name+'; see '+path.join(output,name+'.log'))
}
for(const file of ['v03-time-controls.png','v03-seasons.png'])await copyFile(path.resolve('test-results',file),path.join(output,file))
await cp('test-results/v03-cosmos',path.join(output,'cosmos'),{recursive:true})
await cp('test-results/v02-review-'+performanceStage,path.join(output,'v02-views'),{recursive:true})
await copyFile(path.join(loadingOutput,'result.json'),path.join(output,'loading.json'))
console.log('V0.3 technical acceptance passed; user visual acceptance pending: '+output)
