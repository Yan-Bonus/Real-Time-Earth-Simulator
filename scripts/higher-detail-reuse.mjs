import assert from 'node:assert/strict'
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises'
import path from 'node:path'
import {_electron as electron} from 'playwright'
import {PerspectiveCamera,Matrix4} from 'three'
import {selectClearView} from '../src/imagery/view.ts'
import {surfacePoint,tileKey,ancestors} from '../src/imagery/tiles.ts'
import {prepareControls,setSimulationRate,collapseControls} from './ui-controls.mjs'
const out=path.resolve(process.env.EARTH_TEST_OUTPUT_ROOT?path.join(process.env.EARTH_TEST_OUTPUT_ROOT,'higher-detail-reuse'):'test-results/v03-higher-detail-reuse'),profile=path.join(out,'profile-'+Date.now()),dataset='eox-s2cloudless-2024-WGS84',library=path.resolve('test-results/v03-ux-library/imagery',dataset)
const camera=new PerspectiveCamera(45,1.6,.1,100);camera.position.set(...surfacePoint(116,37)).multiplyScalar(1.5);camera.lookAt(0,0,0)
const budget=Math.floor((512*1048576-4096*2048*4*4/3)*.85/(256*256*4*4/3)),view=selectClearView(camera,new Matrix4(),2700,1687.5,'eox',true,budget),targets=new Set(view.tiles.map(tileKey))
await mkdir(out,{recursive:true});for(const id of view.tiles.filter(id=>id.z>3&&tileKey(id)!=='6/20/98')){const dir=path.join(profile,'imagery',dataset,String(id.z),String(id.row));await mkdir(dir,{recursive:true});for(const ext of ['tile','json'])await copyFile(path.join(library,String(id.z),String(id.row),id.col+'.'+ext),path.join(dir,id.col+'.'+ext))}
for(const row of [40,41])for(const col of [196,197]){const dir=path.join(profile,'imagery',dataset,'7',String(row));await mkdir(dir,{recursive:true});for(const ext of ['tile','json'])await copyFile(path.join('D:/RealTimeEarthSimulatorData/imagery',dataset,'7',String(row),col+'.'+ext),path.join(dir,col+'.'+ext))}
assert.ok(view.tiles.some(id=>id.z>4));assert.ok(view.tiles.every(id=>ancestors(id,'eox').slice(1).every(a=>!targets.has(tileKey(a)))))
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL;const rows=[]
for(let round=0;round<2;round++){
 const args=['--mute-audio','--user-data-dir='+profile],exe=process.argv[2];const app=await electron.launch(exe?{executablePath:path.resolve(exe),args,env}:{args:['.',...args],env}),requests=[];try{const page=await app.firstWindow();await page.route('https://tiles.maps.eox.at/**',async r=>{requests.push(r.request().url());await r.abort('internetdisconnected')});await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setContentSize(1440,900)});await prepareControls(page);await setSimulationRate(page,0);await page.getByRole('button',{name:'区域预览',exact:true}).click();await collapseControls(page)
 const start=performance.now();await page.waitForFunction(()=>document.querySelector('[data-testid="imagery-state"]').dataset.phase==='ready'&&Number(document.querySelector('[data-testid="imagery-state"]').dataset.targetDistance)<1.51,null,{timeout:60000});const state=await page.getByTestId('imagery-state').evaluate(e=>({...e.dataset}));const required=requests.filter(u=>{const m=u.match(/WGS84\/(\d+\/\d+\/\d+)\.jpg/);return m&&targets.has(m[1])});assert.equal(required.length,0);const runtime=JSON.parse(state.runtime);assert.ok(runtime.diskHits>=view.tiles.filter(id=>id.z>3).length)
 rows.push({version:await app.evaluate(({app})=>app.getVersion()),round,readyMs:performance.now()-start,state,requiredDownloads:required.length,prefetchRequests:requests.length});const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));await writeFile(path.join(out,'round-'+round+'.png'),Buffer.from(png,'base64'))
 }finally{await app.close()}
}
await writeFile(path.join(out,'result.json'),JSON.stringify({targets:[...targets],rows,missingParent:'6/20/98',higherChildren:['7/40/196','7/40/197','7/41/196','7/41/197'],sourceMetadata:JSON.parse(await readFile(path.join(library,'5','0','0.json'),'utf8').catch(()=>'{"format":"existing tile/json"}'))},null,2));console.log('Saved exact targets, missing ancestors, offline and restart passed')
