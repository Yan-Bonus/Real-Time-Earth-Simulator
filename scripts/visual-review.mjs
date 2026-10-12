import {prepareControls} from './ui-controls.mjs'
import assert from 'node:assert/strict'
import path from 'node:path'
import {mkdir,writeFile} from 'node:fs/promises'
import {_electron as electron} from 'playwright'
import {earthRotationAngle} from '../src/engine/astronomy/rotation.ts'
const stage=process.argv[2]??'before',exe=process.argv[3],viewsOnly=process.argv.includes('--views-only')
const output=path.resolve('test-results/v02-review-'+stage);await mkdir(output,{recursive:true})
const epoch=Date.parse('2026-10-01T00:00:00Z'),angle=earthRotationAngle(epoch)
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
const args=['--disable-features=CalculateNativeWinOcclusion','--mute-audio','--user-data-dir='+path.resolve('test-results/persistent-real-1790863173295')]
const app=await electron.launch(exe?{executablePath:path.resolve(exe),args,env}:{args:['.',...args],env})
try {
 const page=await app.firstWindow(),errors=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE|GL_INVALID/i.test(m.text()))errors.push(m.text())})
 for(const host of ['tiles.maps.eox.at','gibs.earthdata.nasa.gov'])await page.route('https://'+host+'/**',r=>r.abort('internetdisconnected'))
 await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await prepareControls(page,false)
 await page.addInitScript(epoch=>{
  const NativeDate=Date
  class FixedDate extends NativeDate { constructor(...args){super(...(args.length?args:[epoch]))} static now(){return epoch} }
  globalThis.Date=FixedDate
 },epoch);await page.reload();await prepareControls(page,false)
 await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.unmaximize();win.setContentSize(1440,900);win.setAlwaysOnTop(true);win.show();win.focus()})
 await page.waitForFunction(()=>document.querySelector('[data-testid="imagery-state"]')?.dataset.hasView==='true')
 await page.getByRole('button',{name:'暂停时间',exact:true}).click()
 for(const name of ['太阳直射点','太阳方向','晨昏线'])await page.getByRole('checkbox',{name,exact:true}).uncheck()
 await page.waitForTimeout(2500)
 // Discover the existing Canvas store for test-only deterministic camera placement.
 // No diagnostic API is added to the application or its packaged renderer.
 await page.evaluate(()=>{
  const canvas=document.querySelector('canvas'),key=Object.keys(canvas).find(k=>k.startsWith('__reactFiber'))
  let fiber=canvas[key],state
  for(let n=0;fiber&&n<40;n++,fiber=fiber.return){let hook=fiber.memoizedState
   for(let i=0;hook&&i<80;i++,hook=hook.next){const value=hook.memoizedState?.current;if(value?.camera&&value?.gl&&value?.invalidate){state=value;break}}
   if(state)break
  }
  if(!state)throw Error('Canvas state not found')
  window.__review=state;window.__samples=[];window.__sampling=false;window.__gpu=[]
  const renderer=state.gl,context=renderer.getContext(),ext=context.getExtension('EXT_disjoint_timer_query_webgl2')
  window.__gpuAvailable=!!ext
  const render=renderer.render.bind(renderer),pending=[]
  renderer.render=(...args)=>{
   const query=ext&&window.__sampling?context.createQuery():null
   if(query)context.beginQuery(ext.TIME_ELAPSED_EXT,query)
   const start=performance.now();performance.mark('earth-render-start')
   const result=render(...args);performance.mark('earth-render-end')
   const duration=performance.measure('earth-render','earth-render-start','earth-render-end').duration
   performance.clearMarks('earth-render-start');performance.clearMarks('earth-render-end');performance.clearMeasures('earth-render')
   if(window.__sampling)window.__samples.push({cpu:duration,time:start})
   if(query){context.endQuery(ext.TIME_ELAPSED_EXT);pending.push(query)}
   return result
  }
  window.__collectGpu=()=>{const disjoint=ext&&context.getParameter(ext.GPU_DISJOINT_EXT);for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(context.getQueryParameter(q,context.QUERY_RESULT_AVAILABLE)){
   if(!disjoint)window.__gpu.push(context.getQueryParameter(q,context.QUERY_RESULT)/1e6)
   context.deleteQuery(q);pending.splice(i,1)
  }}}
 })
 const view=async(lon,lat,distance,rotation=angle)=>{
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.show();w.focus()});await page.bringToFront()
  await page.evaluate(({lon,lat,distance,angle})=>{const state=window.__review,a=lon*Math.PI/180+angle,b=lat*Math.PI/180
   state.camera.position.set(Math.cos(b)*Math.cos(a)*distance,Math.sin(b)*distance,-Math.cos(b)*Math.sin(a)*distance)
   state.camera.lookAt(0,0,0);state.camera.updateMatrixWorld();state.scene.updateMatrixWorld(true);state.invalidate()
  },{lon,lat,distance,angle:rotation});await page.waitForTimeout(900)
 }
 const box=await page.locator('canvas').boundingBox()
 const snapshots=[['date-line',179,0,3.8],['overview',105,0,3.8],['nearest',116,37,1.5],['grazing',80,5,1.5],['north-pole',105,85,3.8],['south-pole',105,-85,3.8],['noon',177.4584809,-3.1096671,3.8],['night',-2.5415191,3.1096671,3.8]]
 for(const [name,lon,lat,distance]of snapshots){await view(lon,lat,distance);await page.screenshot({path:path.join(output,name+'.png')})}
 await view(177.4584809,-3.1096671,3.8)
 for(const name of ['太阳直射点','太阳方向'])await page.getByRole('checkbox',{name,exact:true}).check()
 await page.waitForTimeout(300);await page.screenshot({path:path.join(output,'both-markers.png')})
 const markerChecks=[]
 const checkMarkers=async()=>{
  const sizes=await page.evaluate(()=>{
   const state=window.__review;let ring
   state.scene.traverse(o=>{if(o.geometry?.type==='RingGeometry'&&o.geometry.parameters.outerRadius===0.014)ring=o})
   const V=ring.position.constructor,p=ring.getWorldPosition(new V()),direction=state.camera.getWorldDirection(new V())
   const depth=p.sub(state.camera.position).dot(direction),scale=ring.getWorldScale(new V()).x
   return {diameterCssPixels:2*.014*scale*state.gl.domElement.clientHeight/(2*Math.tan(state.camera.fov*Math.PI/360)*depth)}
  })
  const a=await page.getByTestId('subsolar-label').boundingBox(),b=await page.getByTestId('direction-label').boundingBox()
  assert.ok(a&&b&&!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),'Labels must not overlap')
  assert.ok(Math.abs(sizes.diameterCssPixels-10)<.5,'Sun ring should keep its screen diameter: '+JSON.stringify(sizes))
  markerChecks.push({...sizes,labelsOverlap:false})
 }
 if(stage!=='before')await checkMarkers()
 await view(177.4584809,-3.1096671,1.5);if(stage!=='before')await checkMarkers();await page.screenshot({path:path.join(output,'both-markers-nearest.png')})
 await view(-2.5415191,3.1096671,3.8)
 assert.equal(await page.getByTestId('subsolar-label').boundingBox(),null,'Far-side SUN must be occluded by Earth')
 assert.equal(await page.getByTestId('direction-label').boundingBox(),null,'Far-side LIGHT must be occluded by Earth')
 for(const name of ['太阳直射点','太阳方向'])await page.getByRole('checkbox',{name,exact:true}).uncheck()
 const hazePairs=[]
 for(const [name,lon,lat,distance]of [['overview',105,0,3.8],['nearest',116,37,1.5]]){
  await view(lon,lat,distance)
  await page.getByRole('checkbox',{name:'大气辉光',exact:true}).check();await page.waitForTimeout(350)
  await page.screenshot({path:path.join(output,name+'-atmosphere-on.png')})
  await page.getByRole('checkbox',{name:'大气辉光',exact:true}).uncheck();await page.waitForTimeout(350)
  await page.screenshot({path:path.join(output,name+'-atmosphere-off.png')})
  await page.getByRole('checkbox',{name:'大气辉光',exact:true}).check()
  const difference=await app.evaluate(({nativeImage},{output,name})=>{
   const a=nativeImage.createFromPath(output+'/'+name+'-atmosphere-on.png'),b=nativeImage.createFromPath(output+'/'+name+'-atmosphere-off.png')
   const {width:w,height:h}=a.getSize(),x=a.getBitmap(),y=b.getBitmap()
   const mean=(left,right,top,bottom)=>{let sum=0,n=0;for(let r=Math.floor(h*top);r<Math.floor(h*bottom);r++)for(let c=Math.floor(w*left);c<Math.floor(w*right);c++){
    const i=(r*w+c)*4;sum+=Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2]);n+=3
   }return sum/n}
   return {interior:mean(.58,.65,.42,.55),dayLimb:mean(.687,.707,.47,.52),nightLimb:mean(.29,.31,.47,.52)}
  },{output,name});hazePairs.push({name,...difference})
 }
 // Warm both paths before measured pairs, allowing saved tiles and shaders to settle.
 for(const near of [false,true]){
  await view(near?116:105,near?37:0,near?1.5:3.8)
  await page.mouse.move(box.width*.5,box.height*.5);await page.mouse.down()
  for(let i=1;i<=40;i++){await page.mouse.move(box.width*.5+Math.sin(i*Math.PI/20)*90,box.height*.5+Math.sin(i*Math.PI/10)*20);await page.waitForTimeout(20)}
  await page.mouse.up();await page.waitForTimeout(2000)
 }
 const results=[]
 for(let round=0;round<(viewsOnly?0:2);round++)for(const mode of ['static','drag','near-drag'])for(const enabled of round===0?[false,true]:[true,false]){
  await page.getByRole('checkbox',{name:'大气辉光',exact:true}).setChecked(enabled)
  await view(mode==='near-drag'?116:105,mode==='near-drag'?37:0,mode==='near-drag'?1.5:3.8)
  await page.evaluate(()=>{window.__samples=[];window.__gpu=[];window.__sampling=true})
  if(mode==='static')await page.waitForTimeout(2200)
  else {
   await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down()
   for(let i=1;i<=40;i++){await page.mouse.move(box.x+box.width*.5+Math.sin(i*Math.PI/20)*90,box.y+box.height*.5+Math.sin(i*Math.PI/10)*20);await page.waitForTimeout(20)}
   await page.evaluate(()=>{window.__sampling=false});await page.mouse.up();await page.waitForTimeout(250)
  }
  await page.evaluate(()=>{window.__sampling=false});await page.waitForTimeout(300)
  const stats=await page.evaluate(()=>{
   const stat=v=>{v=v.filter(Number.isFinite).sort((a,b)=>a-b);return {samples:v.length,median:v[Math.floor(v.length*.5)]??null,p95:v[Math.floor(v.length*.95)]??null,max:v.at(-1)??null,over50ms:v.filter(x=>x>50).length}}
   window.__collectGpu();const samples=window.__samples;return {cpuSubmitMs:stat(samples.map(s=>s.cpu)),gpuMs:stat(window.__gpu),renderIntervalMs:stat(samples.slice(1).map((s,i)=>s.time-samples[i].time)),gpuAvailable:window.__gpuAvailable,canvas:{width:document.querySelector('canvas').width,height:document.querySelector('canvas').height},pixelRatio:window.__review.gl.getPixelRatio(),textures:window.__review.gl.info.memory.textures,drawCalls:window.__review.gl.info.render.calls,triangles:window.__review.gl.info.render.triangles}
  })
  results.push({round,mode,atmosphere:enabled,...stats})
 }

 {
  await page.getByRole('checkbox',{name:'大气辉光',exact:true}).check()
  await view(105,0,1.5)
  await page.evaluate(()=>{const s=window.__review;s.camera.setViewOffset(1440,900,650,0,1440,900);s.invalidate()})
  await page.waitForTimeout(400);await page.screenshot({path:path.join(output,'grazing-limb.png')})
  await page.evaluate(()=>{window.__review.camera.clearViewOffset();window.__review.invalidate()})
  for(const [name,hours]of [['sun-below',-2],['sun-low',-1],['sun-higher',1]]){
   const instant=epoch+hours*3600000
   await page.evaluate(instant=>{Date.now=()=>instant},instant)
   await page.getByRole('button',{name:'返回当前时间',exact:true}).click();await page.getByRole('button',{name:'暂停时间',exact:true}).click()
   await view(105,0,3.8,earthRotationAngle(instant));await page.screenshot({path:path.join(output,name+'.png')})
  }
  await page.evaluate(epoch=>{Date.now=()=>epoch},epoch)
  await page.getByRole('button',{name:'返回当前时间',exact:true}).click();await page.getByRole('button',{name:'暂停时间',exact:true}).click()
  for(let i=0;i<8;i++){await view(101+i,0,3.8);await page.screenshot({path:path.join(output,'rotation-'+i+'.png')})}
 }
 assert.deepEqual(errors,[])
 const result={stage,epoch,imagery:'real bundled EOX and existing saved real tiles, network held identical',results,markerChecks,hazePairs,errors}
 await writeFile(path.join(output,viewsOnly?'views.json':'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
} finally {await app.close()}
