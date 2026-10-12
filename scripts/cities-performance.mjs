import {prepareControls,collapseControls,setSimulationRate} from './ui-controls.mjs'
import assert from 'node:assert/strict'
import path from 'node:path'
import {mkdir,writeFile,access} from 'node:fs/promises'
import {_electron as electron} from 'playwright'
import {earthRotationAngle} from '../src/engine/astronomy/rotation.ts'
const stage=process.argv[2]??'after',exe=process.argv[3]
const output=path.resolve('test-results/v04/performance-'+stage);await mkdir(output,{recursive:true})
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
const profile=path.resolve(process.argv[4]??'test-results/persistent-real-1790863173295');await access(path.join(profile,'imagery/eox-s2cloudless-2024-WGS84'));
const args=['--disable-features=CalculateNativeWinOcclusion','--mute-audio','--user-data-dir='+path.resolve(process.argv[4]??'test-results/persistent-real-1790863173295')]
const app=await electron.launch(exe?{executablePath:path.resolve(exe),args,env}:{args:['.',...args],env})
try{
 const page=await app.firstWindow(),errors=[],requests=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE|GL_INVALID/i.test(m.text()))errors.push(m.text())})
 for(const host of ['tiles.maps.eox.at','gibs.earthdata.nasa.gov'])await page.route('https://'+host+'/**',async r=>{requests.push({time:performance.now(),url:r.request().url()});await r.abort('internetdisconnected')})
 await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await prepareControls(page,false)
 await page.addInitScript(epoch=>{const NativeDate=Date;class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[epoch]))}static now(){return epoch}};globalThis.Date=FixedDate},Date.parse('2026-10-01T00:00:00Z'));await page.reload();await prepareControls(page,false)
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setContentSize(1440,900);w.setAlwaysOnTop(true)})
 await page.waitForFunction(()=>document.querySelector('[data-testid="imagery-state"]')?.dataset.hasView==='true')
 await page.getByRole('button',{name:'暂停时间',exact:true}).click()
 for(const name of ['太阳直射点','太阳方向','晨昏线'])await page.getByRole('checkbox',{name,exact:true}).uncheck()
 if(stage!=='before')for(const name of ['星空','星云','流星'])await page.getByRole('checkbox',{name,exact:true}).uncheck()
 await collapseControls(page);await page.waitForTimeout(1800)
 await page.evaluate(()=>{
  const canvas=document.querySelector('canvas'),key=Object.keys(canvas).find(k=>k.startsWith('__reactFiber'));let fiber=canvas[key],state
  for(let n=0;fiber&&n<40;n++,fiber=fiber.return){let hook=fiber.memoizedState
   for(let i=0;hook&&i<80;i++,hook=hook.next){const value=hook.memoizedState?.current;if(value?.camera&&value?.gl&&value?.invalidate){state=value;break}}
   if(state)break
  }
  if(!state)throw Error('Canvas state not found')
  window.__review=state;window.__samples=[];window.__sampling=false
  const renderer=state.gl,render=renderer.render.bind(renderer)
  const first=state.internal.subscribers[0].ref;let original=first.current
  Object.defineProperty(first,'current',{configurable:true,get:()=> (...args)=>{window.__frameStart=performance.now();return original(...args)},set:value=>{original=value}})
  renderer.render=(...args)=>{const start=performance.now(),result=render(...args)
   if(window.__sampling)window.__samples.push({cpu:performance.now()-start,frameCpu:performance.now()-(window.__frameStart??start),time:start})
   return result
  }
 })
 const view=async distance=>{
  const epoch=Number(await page.getByTestId('clock-panel').getAttribute('data-epoch')),angle=earthRotationAngle(epoch)
  await page.evaluate(({distance,angle})=>{const s=window.__review,lat=(distance===1.5?37:0)*Math.PI/180,lon=(distance===1.5?116:105)*Math.PI/180+angle
   s.camera.position.set(Math.cos(lat)*Math.cos(lon)*distance,Math.sin(lat)*distance,-Math.cos(lat)*Math.sin(lon)*distance);s.camera.lookAt(0,0,0);s.invalidate()
  },{distance,angle});await page.waitForTimeout(1400)
 }
 const start=()=>page.evaluate(()=>{window.__samples=[];window.__sampling=true})
 const end=async()=>{await page.evaluate(()=>{window.__sampling=false});return page.evaluate(()=>{
  const stat=v=>{v=v.filter(Number.isFinite).sort((a,b)=>a-b);return {samples:v.length,median:v[Math.floor(v.length*.5)]??null,p95:v[Math.floor(v.length*.95)]??null,max:v.at(-1)??null,over50ms:v.filter(x=>x>50).length}}
  const samples=window.__samples;return {frameCpuMs:stat(samples.map(s=>s.frameCpu)),cpuSubmitMs:stat(samples.map(s=>s.cpu)),renderIntervalMs:stat(samples.slice(1).map((s,i)=>s.time-samples[i].time)),canvas:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height},dpr:window.__review.gl.getPixelRatio(),drawCalls:window.__review.gl.info.render.calls,textures:window.__review.gl.info.memory.textures}
 })}
 const foreground=async()=>{await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.show();w.focus()});await page.bringToFront();assert.equal(await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return w.isVisible()&&!w.isMinimized()}),true)}
 const results=[]
 for(const cities of (process.argv[5]==='on'?[true]:[false,true]))for(const rate of [60,-60,3600,-3600])for(const mode of ['overview','nearest','drag','near-drag']){
  await foreground();await prepareControls(page);await page.getByRole('checkbox',{name:'城市节点',exact:true}).setChecked(cities);await collapseControls(page);await setSimulationRate(page,'0');await view(mode.includes('near')?1.5:3.8)
  await setSimulationRate(page,String(rate));await page.waitForTimeout(400);const n=requests.length;await start()
  if(mode.includes('drag')){await page.mouse.move(720,450);await page.mouse.down()
   for(let i=1;i<=45;i++){await page.mouse.move(720+Math.sin(i*Math.PI/22.5)*120,450+Math.sin(i*Math.PI/11.25)*30);await page.waitForTimeout(22)}
   results.push({cities,rate,mode,networkMisses:requests.length-n,...await end()});await page.mouse.up()
  }else {await page.waitForTimeout(2000);results.push({cities,rate,mode,networkMisses:requests.length-n,...await end()})}
 }
 await setSimulationRate(page,'0');await view(3.8);await page.waitForTimeout(3000);await start();await page.waitForTimeout(1200)
 const paused=await end();assert.ok(stage==='before'||paused.frameCpuMs.samples<8,'Paused idle should not redraw continuously')
 await setSimulationRate(page,'3600');await page.waitForTimeout(250);await start()
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].hide());await page.waitForTimeout(1500)
 const hidden=await end(),isHidden=await page.evaluate(()=>document.hidden)
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());await page.waitForTimeout(500)
 await page.getByRole('button',{name:'返回当前时间',exact:true}).click();await page.waitForTimeout(300)
 const resetErrorMs=Math.abs(Number(await page.getByTestId('clock-panel').getAttribute('data-epoch'))-await page.evaluate(()=>Date.now()));assert.ok(resetErrorMs<1000)
 await page.getByRole('button',{name:'暂停时间',exact:true}).click()
 await page.screenshot({path:path.join(output,'overview.png')});await view(1.5);await page.screenshot({path:path.join(output,'nearest.png')})
 assert.deepEqual(errors,[])
 const libraryInfo=await page.evaluate(()=>window.desktop.imagery.info());assert.ok(libraryInfo.tiles>0,'Real library must exist in the actual profile/imagery directory');assert.ok(results.some(r=>r.textures>32),'Benchmark must exercise regional real textures, not only the bundled atlas');
 const report={stage,libraryInfo,profile,version:await app.evaluate(({app})=>app.getVersion()),imagery:'Same real saved EOX library; fixed UTC reference; network misses aborted; native performance clock; atmosphere ON; cosmic OFF; test window foreground always-on-top with native occlusion detection disabled (production behavior unchanged)',results,paused,hidden,isHidden,resetErrorMs,errors}
 await writeFile(path.join(output,'performance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await app.close()}
