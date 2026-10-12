import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises'
import path from 'node:path'
import {_electron as electron} from 'playwright'
import {PerspectiveCamera,Matrix4} from 'three'
import {selectClearView} from '../src/imagery/view.ts'
import {surfacePoint,tileKey,ancestors} from '../src/imagery/tiles.ts'
import {prepareControls,setSimulationRate,collapseControls} from './ui-controls.mjs'
const out=path.resolve(process.env.EARTH_TEST_OUTPUT_ROOT?path.join(process.env.EARTH_TEST_OUTPUT_ROOT,'corrupt-target-repair'):'test-results/v03-corrupt-target-repair'),profile=path.join(out,'profile-'+Date.now()),dataset='eox-s2cloudless-2024-WGS84',library=path.resolve('test-results/v03-ux-library/imagery',dataset)
const camera=new PerspectiveCamera(45,1.6,.1,100);camera.position.set(...surfacePoint(116,37)).multiplyScalar(1.5);camera.lookAt(0,0,0)
const budget=Math.floor((512*1048576-4096*2048*4*4/3)*.85/(256*256*4*4/3)),view=selectClearView(camera,new Matrix4(),2700,1687.5,'eox',true,budget),targets=new Set(view.tiles.map(tileKey))
await mkdir(out,{recursive:true});for(const id of view.tiles.filter(id=>id.z>3)){const dir=path.join(profile,'imagery',dataset,String(id.z),String(id.row));await mkdir(dir,{recursive:true});for(const ext of ['tile','json'])await copyFile(path.join(library,String(id.z),String(id.row),id.col+'.'+ext),path.join(dir,id.col+'.'+ext))}
const damaged=view.tiles.find(id=>id.z>4),badPath=path.join(profile,'imagery',dataset,String(damaged.z),String(damaged.row),damaged.col+'.tile'),original=await readFile(badPath),bad=original.subarray(0,220);await writeFile(badPath,bad);await writeFile(badPath.replace('.tile','.json'),JSON.stringify({bytes:bad.length,sha256:createHash('sha256').update(bad).digest('hex'),source:'eox',version:dataset}));
assert.ok(view.tiles.some(id=>id.z>4));assert.ok(view.tiles.every(id=>ancestors(id,'eox').slice(1).every(a=>!targets.has(tileKey(a)))))
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL;const rows=[]
for(let round=0;round<2;round++){
 const args=['--mute-audio','--user-data-dir='+profile],exe=process.argv[2];const app=await electron.launch(exe?{executablePath:path.resolve(exe),args,env}:{args:['.',...args],env}),requests=[];try{const page=await app.firstWindow();await page.route('https://tiles.maps.eox.at/**',async r=>{requests.push(r.request().url());const m=r.request().url().match(/WGS84\/(\d+\/\d+\/\d+)\.jpg/);if(m&&m[1]===tileKey(damaged)&&round===0)await r.fulfill({status:200,contentType:'image/jpeg',body:original});else await r.abort('internetdisconnected')});await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setContentSize(1440,900)});await prepareControls(page);await setSimulationRate(page,0);await page.getByRole('button',{name:'区域预览',exact:true}).click();await collapseControls(page)
 const start=performance.now();await page.waitForFunction(()=>document.querySelector('[data-testid="imagery-state"]').dataset.phase==='ready',null,{timeout:60000});const state=await page.getByTestId('imagery-state').evaluate(e=>({...e.dataset}));const required=requests.filter(u=>{const m=u.match(/WGS84\/(\d+\/\d+\/\d+)\.jpg/);return m&&targets.has(m[1])});assert.equal(required.length,round===0?1:0);const runtime=JSON.parse(state.runtime);assert.ok(runtime.diskHits>=view.tiles.filter(id=>id.z>3).length)
 rows.push({version:await app.evaluate(({app})=>app.getVersion()),round,readyMs:performance.now()-start,state,requiredDownloads:required.length,prefetchRequests:requests.length});const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));await writeFile(path.join(out,'round-'+round+'.png'),Buffer.from(png,'base64'))
 }finally{await app.close()}
}
await writeFile(path.join(out,'result.json'),JSON.stringify({targets:[...targets],rows,sourceMetadata:JSON.parse(await readFile(path.join(library,'5','0','0.json'),'utf8').catch(()=>'{"format":"existing tile/json"}'))},null,2));console.log('Corrupt exact target repaired once; restart reused repair offline')
