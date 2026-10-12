import {prepareControls,collapseControls,setSimulationRate} from './ui-controls.mjs'
import assert from 'node:assert/strict'
import path from 'node:path'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {_electron as electron} from 'playwright'
const exe=process.argv[2],env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
const output=path.resolve(process.argv[3]??'test-results/v03-loading');await mkdir(output,{recursive:true})
const library=path.resolve(process.argv[4]??'test-results/persistent-real-1790863173295/imagery/eox-s2cloudless-2024-WGS84')
const profile=path.join(output,'profile-'+Date.now()),args=['--disable-features=CalculateNativeWinOcclusion','--mute-audio','--user-data-dir='+profile]
const app=await electron.launch(exe?{executablePath:path.resolve(exe),args,env}:{args:['.',...args],env})
try{
 const page=await app.firstWindow(),errors=[];let delay=120,offline=false,requests=0,delivered=0,canceled=0
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(r.failure()?.errorText==='net::ERR_ABORTED')canceled++})
 await page.route('https://tiles.maps.eox.at/**',async route=>{
  requests++;const m=route.request().url().match(/WGS84\/(\d+)\/(\d+)\/(\d+)\.jpg/)
  const bytes=m?await readFile(path.join(library,m[1],m[2],m[3]+'.tile')).catch(()=>null):null
  await new Promise(r=>setTimeout(r,delay))
  try{if(offline||!bytes)await route.abort('internetdisconnected');else{await route.fulfill({status:200,contentType:'image/jpeg',body:bytes});delivered++}}catch{}
 })
 await page.route('https://gibs.earthdata.nasa.gov/**',r=>r.abort())
 await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await prepareControls(page,false)
 await page.addInitScript(epoch=>{const NativeDate=Date;class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[epoch]))}static now(){return epoch}};globalThis.Date=FixedDate},Date.parse('2026-10-01T00:00:00Z'));await page.reload();await prepareControls(page,false)
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setContentSize(1440,900);w.setAlwaysOnTop(true)})
 await page.waitForFunction(()=>document.querySelector('[data-testid="imagery-state"]')?.dataset.hasView==='true')
 await page.getByRole('checkbox',{name:'星空',exact:true}).uncheck()
 await page.getByRole('button',{name:'暂停时间',exact:true}).click();await collapseControls(page)
 await page.evaluate(()=>{
  const canvas=document.querySelector('canvas'),key=Object.keys(canvas).find(k=>k.startsWith('__reactFiber'));let fiber=canvas[key],state
  for(let n=0;fiber&&n<40;n++,fiber=fiber.return){let hook=fiber.memoizedState
   for(let i=0;hook&&i<80;i++,hook=hook.next){const v=hook.memoizedState?.current;if(v?.gl&&v?.camera&&v?.invalidate){state=v;break}}if(state)break
  }
  window.__review=state;window.__sampling=false;window.__samples=[]
  const first=state.internal.subscribers[0].ref;let original=first.current
  Object.defineProperty(first,'current',{configurable:true,get:()=> (...args)=>{window.__start=performance.now();return original(...args)},set:v=>{original=v}})
  const render=state.gl.render.bind(state.gl)
  state.gl.render=(...args)=>{const t=performance.now(),r=render(...args);if(window.__sampling)window.__samples.push({cpu:performance.now()-window.__start,time:t});return r}
 })
 const foreground=async()=>{await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.show();w.focus()});await page.bringToFront();assert.equal(await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return w.isVisible()&&!w.isMinimized()}),true)}
 const results=[]
 for(const rate of [60,-60,3600,-3600])for(const near of [false,true]){
  await foreground();await setSimulationRate(page,'0')
  await page.getByRole('button',{name:near?'区域预览':'重置视角',exact:true}).click()
  await setSimulationRate(page,String(rate))
  await page.evaluate(()=>{window.__samples=[];window.__sampling=true})
  const before={requests,delivered,canceled};await page.mouse.move(720,450);await page.mouse.down()
  for(let i=1;i<=40;i++){await page.mouse.move(720+Math.sin(i*Math.PI/20)*90,450+Math.sin(i*Math.PI/10)*20);await page.waitForTimeout(24)}
  const stats=await page.evaluate(()=>{window.__sampling=false;const s=window.__samples
   const stat=v=>{v=v.sort((a,b)=>a-b);return{samples:v.length,p95:v[Math.floor(v.length*.95)]??null,max:v.at(-1)??null,over50ms:v.filter(x=>x>50).length}}
   return{cpuMs:stat(s.map(x=>x.cpu)),renderIntervalMs:stat(s.slice(1).map((x,i)=>x.time-s[i].time)),cameraDistance:window.__review.camera.position.length(),canvas:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height}}
  });await page.mouse.up();results.push({rate,near,delayMs:delay,newRequests:requests-before.requests,delivered:delivered-before.delivered,canceled:canceled-before.canceled,...stats})
 }
 delay=1500;await setSimulationRate(page,'3600')
 const weakBefore=await page.evaluate(()=>window.__review.camera.quaternion.toArray())
 await page.mouse.move(720,450);await page.mouse.down();for(let i=1;i<=25;i++){await page.mouse.move(720+i*5,450);await page.waitForTimeout(25)}await page.mouse.up()
 const weakAfter=await page.evaluate(()=>window.__review.camera.quaternion.toArray());assert.notDeepEqual(weakBefore,weakAfter)
 offline=true;const offBefore=await page.evaluate(()=>window.__review.camera.quaternion.toArray())
 await page.mouse.move(720,450);await page.mouse.down();for(let i=1;i<=25;i++){await page.mouse.move(720-i*5,450);await page.waitForTimeout(25)}await page.mouse.up()
 assert.notDeepEqual(offBefore,await page.evaluate(()=>window.__review.camera.quaternion.toArray()))
 await page.getByRole('button',{name:'区域预览',exact:true}).click();await page.waitForTimeout(250)
 assert.ok(Math.abs(await page.evaluate(()=>window.__review.camera.position.length())-1.5)<.001)
 const visibility=[]
 for(const action of ['hide','minimize']){
  await app.evaluate(({BrowserWindow},action)=>BrowserWindow.getAllWindows()[0][action](),action);await page.waitForTimeout(300)
  const old=await page.getByTestId('clock-panel').getAttribute('data-epoch'),count=requests
  await page.evaluate(()=>window.__review.invalidate())
  await page.waitForTimeout(1200);assert.equal(await page.getByTestId('clock-panel').getAttribute('data-epoch'),old)
  assert.equal(requests,count,'Inactive window must not start downloads')
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.show();w.focus()});await page.waitForTimeout(400)
  assert.ok(Number(await page.getByTestId('clock-panel').getAttribute('data-epoch'))>Number(old)+3000000)
  const resumed=Number(await page.getByTestId('clock-panel').getAttribute('data-epoch'));await page.waitForTimeout(500);assert.ok(Number(await page.getByTestId('clock-panel').getAttribute('data-epoch'))>resumed+1000000,'Playback must keep advancing after restore')
  visibility.push({action,noNewRequests:true,timePublicationStopped:true,restoredCatchUp:true,restoredContinuousPlayback:true})
 }
 await page.getByRole('button',{name:'暂停时间',exact:true}).click()
 await page.getByRole('button',{name:'返回当前时间',exact:true}).click();await page.waitForTimeout(300)
 assert.ok(Math.abs(Number(await page.getByTestId('clock-panel').getAttribute('data-epoch'))-await page.evaluate(()=>Date.now()))<1000)
 const saved=await page.evaluate(()=>window.desktop.imagery.info());assert.ok(saved.tiles>0,'Background downloads must be permanently saved')
 assert.ok(canceled>0,'Stale tasks should be canceled');assert.deepEqual(errors,[])
 const report={packaged:!!exe,profile,network:'Replayed coordinate-matching real EOX tiles from prior saved library; 120ms then 1500ms delays; missing or offline requests aborted',results,weakNetworkDrag:true,offlineDrag:true,offlineZoom:true,visibility,canceled,saved,errors}
 await writeFile(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await app.close()}
