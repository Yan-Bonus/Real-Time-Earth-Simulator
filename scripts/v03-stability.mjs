import assert from 'node:assert/strict'
import path from 'node:path'
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises'
import {_electron as electron} from 'playwright'
import {prepareControls,collapseControls,setSimulationRate} from './ui-controls.mjs'
const exe=process.argv[2],duration=Number(process.argv[3]??600000),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
const output=path.resolve(process.argv[4]??'test-results/v03-ux-stability'),profile=path.join(output,'profile-'+Date.now())
const library=path.resolve('test-results/v03-ux-library/imagery/eox-s2cloudless-2024-WGS84')
await mkdir(profile,{recursive:true});await cp('test-results/v03-ux-library/imagery',path.join(profile,'imagery'),{recursive:true})
const app=await electron.launch({executablePath:path.resolve(exe),args:['--disable-features=CalculateNativeWinOcclusion','--mute-audio','--user-data-dir='+profile],env})
let page;const errors=[],snapshots=[],samples=[],start=performance.now();let offline=false,delay=120,requests=0,delivered=0
try {
 page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE|GL_INVALID/i.test(m.text()))errors.push(m.text())})
 for(const host of ['tiles.maps.eox.at','gibs.earthdata.nasa.gov'])await page.route('https://'+host+'/**',async route=>{
  requests++;const m=route.request().url().match(/WGS84\/(\d+)\/(\d+)\/(\d+)\.jpg/),bytes=m?await readFile(path.join(library,m[1],m[2],m[3]+'.tile')).catch(()=>null):null
  await new Promise(r=>setTimeout(r,delay));try{if(offline||!bytes)await route.abort('internetdisconnected');else{await route.fulfill({status:200,contentType:'image/jpeg',body:bytes});delivered++}}catch{}
 })
 await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await page.waitForLoadState()
 await page.addInitScript(epoch=>{const NativeDate=Date;class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[epoch]))}static now(){return epoch}};globalThis.Date=FixedDate},Date.parse('2026-10-01T00:00:00Z'));await page.reload();await prepareControls(page)
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setContentSize(1440,900);w.setAlwaysOnTop(true);w.show();w.focus()})
 await page.waitForFunction(()=>document.querySelector('[data-testid="imagery-state"]').dataset.hasView==='true')
 for(const label of ['星空','星云','流星','太阳直射点','太阳方向','晨昏线'])await page.getByRole('checkbox',{name:label,exact:true}).uncheck()
 await collapseControls(page)
 // Use the real store in this isolated test process, injecting only reported free space.
 await app.evaluate(async({ipcMain,app},root)=>{
  const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json')
  const {join}=require('node:path'),{statfs}=require('node:fs/promises')
  const {ImageryStore}=require(join(app.getAppPath(),'dist-electron/imagery-store.js'))
  globalThis.__blocked=false;globalThis.__testStore=new ImageryStore(root,async()=>{if(globalThis.__blocked)return 0n;const disk=await statfs(root,{bigint:true});return disk.bavail*disk.bsize})
  for(const name of ['read','save','info','assemble'])ipcMain.removeHandler('imagery:'+name)
  ipcMain.handle('imagery:read',(_,tile)=>globalThis.__testStore.read(tile));ipcMain.handle('imagery:assemble',(_,tile)=>globalThis.__testStore.canAssemble(tile))
  ipcMain.handle('imagery:save',(_,tile,bytes)=>globalThis.__testStore.save(tile,bytes));ipcMain.handle('imagery:info',()=>globalThis.__testStore.info())
 },path.join(profile,'imagery'))
 await page.evaluate(()=>{
  const c=document.querySelector('canvas'),key=Object.keys(c).find(k=>k.startsWith('__reactFiber'));let f=c[key],state
  for(let n=0;f&&n<40;n++,f=f.return){let h=f.memoizedState;for(let i=0;h&&i<80;i++,h=h.next){const v=h.memoizedState?.current;if(v?.gl&&v?.camera&&v?.invalidate){state=v;break}}if(state)break}
  window.__review=state;window.__samples=[];window.__sampling=false;window.__renderCount=0
  const first=state.internal.subscribers[0].ref;let original=first.current
  Object.defineProperty(first,'current',{configurable:true,get:()=> (...args)=>{window.__start=performance.now();return original(...args)},set:v=>{original=v}})
  const render=state.gl.render.bind(state.gl);state.gl.render=(...args)=>{const t=performance.now(),r=render(...args);window.__renderCount++;if(window.__sampling)window.__samples.push({cpu:performance.now()-window.__start,time:t});return r}
 })
 const snapshot=async cycle=>{
  const session=await page.context().newCDPSession(page);await session.send('HeapProfiler.collectGarbage');const metrics=await session.send('Runtime.getHeapUsage');await session.detach()
  const state=await page.evaluate(()=>({runtime:JSON.parse(document.querySelector('[data-testid="imagery-state"]').dataset.runtime),textures:window.__review.gl.info.memory.textures,geometries:window.__review.gl.info.memory.geometries,objects:(()=>{let n=0;window.__review.scene.traverse(()=>n++);return n})(),dom:document.querySelectorAll('*').length,canvas:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height}}))
  const processes=await app.evaluate(({app})=>app.getAppMetrics().map(p=>({type:p.type,pid:p.pid,memory:p.memory})))
  const record={cycle,elapsedMs:Math.round(performance.now()-start),heapUsed:metrics.usedSize,heapTotal:metrics.totalSize,processes,requests,delivered,...state};snapshots.push(record)
  assert.ok(state.runtime.running<=16);assert.ok(state.runtime.decode<=2);assert.ok(state.runtime.reads<=4);assert.ok(state.runtime.uploads<=24);assert.ok(state.runtime.textureBytes<=512*1048576*1.05);assert.ok(state.runtime.failures<=1100)
  await writeFile(path.join(output,'progress.json'),JSON.stringify({durationTargetMs:duration,snapshots,samples,errors},null,2));console.log('cycle '+cycle+' heapMiB='+(record.heapUsed/1048576).toFixed(1)+' textures='+state.textures+' active='+state.runtime.running)
 }
 const capture=async(cycle,rate)=>{
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.show();w.focus()});await page.bringToFront();assert.equal(await page.evaluate(()=>document.hidden),false)
  const captureStart=performance.now()
  await page.evaluate(()=>{window.__samples=[];window.__sampling=true});await page.waitForTimeout(4000)
  const r=await page.evaluate(()=>{window.__sampling=false;const s=window.__samples,stat=a=>{a.sort((a,b)=>a-b);return{samples:a.length,p95:a[Math.floor(a.length*.95)]??null,max:a.at(-1)??null,over50ms:a.filter(v=>v>50).length}};return{cpuMs:stat(s.map(v=>v.cpu)),renderIntervalMs:stat(s.slice(1).map((v,i)=>v.time-s[i].time))}});assert.ok(r.cpuMs.samples>0,'Visible playback must render at rate '+rate);samples.push({cycle,rate,wallMs:performance.now()-captureStart,...r})
 }
 const drag=async()=>{await page.mouse.move(720,450);await page.mouse.down();for(let i=1;i<=30;i++){await page.mouse.move(720+Math.sin(i*Math.PI/15)*115,450+Math.sin(i*Math.PI/7.5)*25);await page.waitForTimeout(20)}await page.mouse.up()}
 await snapshot(0)
 let cycle=0
 while(performance.now()-start<duration){cycle++;const cycleStart=performance.now()
  for(const rate of [60,-60,3600,-3600,1,-1]){
   await setSimulationRate(page,rate);await capture(cycle,rate);await setSimulationRate(page,0);const epoch=await page.getByTestId('clock-panel').getAttribute('data-epoch');await page.waitForTimeout(100);assert.equal(await page.getByTestId('clock-panel').getAttribute('data-epoch'),epoch)
   await page.getByRole('button',{name:'继续播放',exact:true}).click();assert.equal(Number(await page.getByTestId('time-controls').getAttribute('data-rate')),rate)
  }
  await setSimulationRate(page,0)
  for(const label of ['区域预览','重置视角','区域预览','重置视角']){await page.getByRole('button',{name:label,exact:true}).click();await drag();await page.waitForTimeout(300)}
  for(const action of ['hide','minimize']){
   await app.evaluate(({BrowserWindow},action)=>BrowserWindow.getAllWindows()[0][action](),action);await page.waitForTimeout(250);const n=requests,epoch=await page.getByTestId('clock-panel').getAttribute('data-epoch');await page.waitForTimeout(700)
   assert.equal(requests,n);assert.equal(await page.getByTestId('clock-panel').getAttribute('data-epoch'),epoch)
   await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.show();w.focus()});await page.bringToFront();await page.waitForTimeout(300)
  }
  if(cycle===1){
   // Renderer must still browse while the real store refuses new writes.
   await app.evaluate(()=>{globalThis.__blocked=true});const info=await page.evaluate(()=>window.desktop.imagery.info())
   const bytes=await readFile('scripts/fixtures/eox-level3-0-0.jpg')
   const denied=await page.evaluate(async b=>window.desktop.imagery.save({source:'eox',z:13,row:777,col:777},new Uint8Array(b)),[...bytes]);assert.equal(denied,false)
   assert.match((await page.evaluate(()=>window.desktop.imagery.info())).warning,/空间不足/)
   await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('#viewer-settings').getByRole('status').filter({hasText:'磁盘空间不足'}).waitFor();await page.getByRole('button',{name:'关闭设置',exact:true}).click()
   await drag();assert.equal((await page.evaluate(()=>window.desktop.imagery.info())).tiles,info.tiles)
   await app.evaluate(()=>{globalThis.__blocked=false})
  }
  delay=1500;await drag();offline=true;await drag();offline=false;delay=120
  await page.getByRole('button',{name:'返回当前时间',exact:true}).click();await setSimulationRate(page,0);await page.waitForTimeout(4000)
  const idle=await page.evaluate(()=>window.__renderCount);await page.waitForTimeout(1200);const idleDraws=await page.evaluate(()=>window.__renderCount)-idle
  await snapshot(cycle);snapshots.at(-1).idleDraws=idleDraws
  const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));await writeFile(path.join(output,'cycle-'+cycle+'.png'),Buffer.from(png,'base64'))
  const wait=Math.min(60000-(performance.now()-cycleStart),duration-(performance.now()-start));if(wait>0)await page.waitForTimeout(wait)
 }
 await app.evaluate(async()=>globalThis.__testStore.flush())
 const info=await page.evaluate(()=>window.desktop.imagery.info());assert.ok(info.tiles>0);assert.deepEqual(errors,[])
 const result={version:await app.evaluate(({app})=>app.getVersion()),durationMs:Math.round(performance.now()-start),cycles:cycle,network:'Coordinate-matching saved real EOX responses; 120/1500ms delay; missing and offline aborted',measure:'Native performance, per-rate 4s samples; forced GC outside measured phases; process memory and resources each cycle',diskFailure:'Real ImageryStore with free-space injection in isolated test process; existing files retained',snapshots,samples,saved:info,errors,humanAcceptance:'pending'}
 await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log('STABILITY PASSED '+result.durationMs+'ms')
} finally {await app.close()}
