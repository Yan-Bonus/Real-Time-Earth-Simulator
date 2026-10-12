import {prepareControls} from './ui-controls.mjs'
import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir,writeFile } from 'node:fs/promises'
import { _electron as electron } from 'playwright'
const mode=process.argv[2]??'fixture',exe=process.argv[3]
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
if(process.env.EARTH_TEST_DEV_URL)env.EARTH_DEV_URL=process.env.EARTH_TEST_DEV_URL
const profileArg='--user-data-dir='+path.resolve('test-results/profile-'+mode+'-'+Date.now())
const app=await electron.launch({...exe?{executablePath:path.resolve(exe),args:[profileArg,'--disable-features=CalculateNativeWinOcclusion']}:{args:['.',profileArg,'--disable-features=CalculateNativeWinOcclusion']},env})
let release=()=>{}
await app.evaluate(({BrowserWindow})=>{globalThis.__nativeAudit=[];const w=BrowserWindow.getAllWindows()[0];const record=event=>globalThis.__nativeAudit.push({event,at:Date.now(),visible:w.isVisible(),minimized:w.isMinimized(),focused:w.isFocused(),bounds:w.getContentBounds()});record('audit-start');for(const event of ['show','hide','minimize','restore','focus','blur','resize'])w.on(event,()=>record(event));w.webContents.on('did-finish-load',()=>record('did-finish-load'))})
try {
  await mkdir('test-results',{recursive:true})
  const page=await app.firstWindow(),errors=[],localImages=[],counts=new Map()
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|shader|GL_INVALID/i.test(message.text()))errors.push(message.text())})
  page.on('request',request=>{if(/earth-blue-marble|earth-land-mask/.test(request.url()))localImages.push(request.url())})
  let failure=false,held=false,gate=Promise.resolve(),fixtures
  for(const host of ['tiles.maps.eox.at','gibs.earthdata.nasa.gov'])await page.route('https://'+host+'/**',async route=>{
    if(failure||mode==='fixture'&&!fixtures){await route.abort('internetdisconnected');return}
    const url=route.request().url();counts.set(url,(counts.get(url)??0)+1)
    if(held)await gate
    try{if(mode==='real')await route.continue();else {await new Promise(r=>setTimeout(r,15));await route.fulfill({status:200,contentType:'image/png',body:fixtures[host]})}}catch{}
  })
  await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await prepareControls(page,true);await page.waitForLoadState();await page.waitForTimeout(200)
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMaximized()),true)
  await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.unmaximize();win.setSize(1440,900);win.setAlwaysOnTop(true);win.show();win.focus()})
  if(mode==='fixture'){
    const data=await page.evaluate(()=>Object.fromEntries([['tiles.maps.eox.at',256,'#d07050'],['gibs.earthdata.nasa.gov',512,'#267aca']].map(([host,size,color])=>{
      const c=document.createElement('canvas');c.width=size;c.height=size;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,size,size);ctx.fillStyle='#ffffff';for(let y=0;y<size;y+=32)for(let x=0;x<size;x+=32)ctx.fillRect(x,y,4,4);return [host,c.toDataURL('image/png').split(',')[1]]
    })))
    fixtures=Object.fromEntries(Object.entries(data).map(([host,data])=>[host,Buffer.from(data,'base64')]))
  }
  await page.addInitScript(epoch=>{const NativeDate=Date;class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[epoch]))}static now(){return epoch}};globalThis.Date=FixedDate},Date.parse('2026-10-01T00:00:00Z'));await page.reload();await prepareControls(page,true)
  const state=page.getByTestId('imagery-state'),canvas=page.locator('canvas')
  let expectedSource='eox'
  const ready=()=>page.waitForFunction(source=>{const el=document.querySelector('[data-testid="imagery-state"]');return el?.dataset.phase==='ready'&&el.dataset.source===source},expectedSource,{timeout:240000}).catch(async error=>{console.error('NATIVE WINDOW HISTORY',JSON.stringify(await app.evaluate(({BrowserWindow})=>({events:globalThis.__nativeAudit,current:BrowserWindow.getAllWindows().map(w=>({visible:w.isVisible(),minimized:w.isMinimized(),focused:w.isFocused(),bounds:w.getContentBounds()}))}))));console.error('READY FAILURE',await state.evaluate(el=>({...el.dataset})),await page.getByTestId('diagnostics').count()?await page.getByTestId('diagnostics').evaluate(el=>({...el.dataset})):null);throw error})
  const phase=value=>page.waitForFunction(value=>document.querySelector('[data-testid="imagery-state"]')?.dataset.phase===value,value,{timeout:40000})
  for(const group of await page.locator('.control-group').all())if(await group.evaluate(n=>n.open))await group.locator('summary').click()
  const diagnostics=page.getByTestId('diagnostics')
  const read=()=>diagnostics.evaluate(el=>({longitude:Number(el.dataset.longitude),latitude:Number(el.dataset.latitude),distance:Number(el.dataset.cameraDistance)}))
  const distance=value=>page.waitForFunction(value=>Math.abs(Number(document.querySelector('[data-testid="diagnostics"]')?.dataset.cameraDistance)-value)<.01,value)
  await ready();assert.ok(Number(await state.getAttribute('data-texel-ratio'))<=.9)
  await page.getByRole('checkbox',{name:'调试信息',exact:true}).check();await distance(3.8)
  const baseCount=[...counts.keys()].filter(url=>/\/3\/\d+\/\d+\.jpg$/.test(url)).length
  assert.equal(baseCount,0,'Bundled global atlas must not download level-3 tiles')
  await page.screenshot({path:'test-results/fluid-overview-'+mode+(exe?'-packaged':'')+'.png'})
  const initial=await read();counts.clear();held=true;gate=new Promise(resolve=>release=resolve)
  const b=await canvas.boundingBox()
  await page.evaluate(()=>{window.__frameTimes=[];window.__sampling=true;let last=performance.now();function frame(t){if(!window.__sampling)return;window.__frameTimes.push(t-last);last=t;requestAnimationFrame(frame)}requestAnimationFrame(frame)})
  await page.bringToFront();await page.mouse.move(b.width*.5,b.height*.5);await page.mouse.down()
  for(let i=1;i<=30;i++){await page.mouse.move(b.width*.5+i*8,b.height*.5+Math.sin(i*.2)*35);await page.waitForTimeout(20)}
  await page.mouse.up();await page.waitForTimeout(1200)
  const moved=await read();assert.ok(Math.abs(moved.longitude-initial.longitude)>10,'Camera must rotate before any new network response completes')
  const frameStats=await page.evaluate(()=>{window.__sampling=false;const values=window.__frameTimes.filter(x=>x>0).sort((a,b)=>a-b);return {samples:values.length,medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)],over50ms:values.filter(x=>x>50).length}})
  for(let i=0;i<30;i++){await page.mouse.wheel(0,-300);await page.waitForTimeout(15)}await distance(1.5)
  assert.equal(await state.getAttribute('data-has-view'),'true','Global surface remains available while details wait')
  const instantZoom=await read()
  release();held=false
  await page.getByRole('button',{name:'区域预览',exact:true}).click();await page.waitForFunction(()=>Math.abs(Number(document.querySelector('[data-testid="diagnostics"]')?.dataset.longitude)-116)<.05);await ready();await page.waitForFunction(()=>Math.abs(Number(document.querySelector('[data-testid="diagnostics"]')?.dataset.latitude)-37)<.05)
  const nearest=await read();assert.ok(Math.abs(nearest.latitude-37)<.05);assert.ok(Number(await state.getAttribute('data-texel-ratio'))<=.9)
  held=mode==='fixture';gate=new Promise(resolve=>release=resolve)
  await page.evaluate(()=>{window.__nearFrames=[];window.__sampling=true;let last=performance.now();function frame(t){if(!window.__sampling)return;window.__nearFrames.push(t-last);last=t;requestAnimationFrame(frame)}requestAnimationFrame(frame)})
  await page.mouse.move(b.width*.5,b.height*.5);await page.mouse.down()
  for(let i=1;i<=40;i++){await page.mouse.move(b.width*.5+Math.sin(i*Math.PI/20)*120,b.height*.5);await page.waitForTimeout(20)}
  await page.mouse.up();await page.waitForTimeout(300)
  const nearFrameStats=await page.evaluate(()=>{window.__sampling=false;const v=window.__nearFrames.filter(x=>x>0).sort((a,b)=>a-b);return {samples:v.length,medianMs:v[Math.floor(v.length*.5)],p95Ms:v[Math.floor(v.length*.95)],over50ms:v.filter(x=>x>50).length}})
  release();held=false;await page.getByRole('button',{name:'区域预览',exact:true}).click();await page.waitForFunction(()=>Math.abs(Number(document.querySelector('[data-testid="diagnostics"]')?.dataset.longitude)-116)<.05);await ready()
  await page.getByRole('checkbox',{name:'调试信息',exact:true}).uncheck();await page.mouse.move(10,10);await page.screenshot({path:'test-results/fluid-nearest-'+mode+(exe?'-packaged':'')+'.png'})
  // Returning to a previously seen region must reuse network responses, not download the same tiles again.
  const beforeReturn=new Map(counts)
  await page.getByRole('button',{name:'重置视角',exact:true}).click();await page.waitForTimeout(1200);await ready()
  const repeated=[...counts].filter(([url,count])=>beforeReturn.has(url)&&count>beforeReturn.get(url))
  assert.equal(repeated.length,0,'Revisiting the overview should not redownload cached imagery')
  if(mode==='fixture'){
    failure=true;expectedSource='nasa';await page.getByRole('combobox',{name:'区域影像',exact:true}).selectOption('nasa');await phase('error');assert.equal(await state.getAttribute('data-has-view'),'true')
    failure=false;await page.getByRole('button',{name:'重新连接',exact:true}).click();await ready()
    await page.locator('.control-group').filter({has:page.locator('summary',{hasText:'显示图层'})}).locator('summary').click()
    for(const name of ['自转轴','赤道','经纬网（30°）'])await page.getByRole('checkbox',{name,exact:true}).check()
    assert.equal(await page.locator('.guide-label-equator').filter({hasText:'0°'}).isVisible(),true)
    for(const name of ['自转轴','赤道','经纬网（30°）'])await page.getByRole('checkbox',{name,exact:true}).uncheck()
    failure=true;expectedSource='eox';await page.reload();await prepareControls(page,true);await ready();assert.equal(await state.getAttribute('data-has-view'),'true')
    failure=false;
    await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.unmaximize();win.setSize(720,640)})
    await page.waitForTimeout(500);await ready();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true)
  }
  assert.deepEqual(localImages,[]);assert.deepEqual(errors,[])
  console.log(JSON.stringify({mode,packaged:!!exe,bundledGlobalTiles:128,baseNetworkRequests:baseCount,initial,movedWhileNetworkHeld:moved,zoomWhileNetworkHeld:instantZoom,nearest,frameStats,nearFrameStats,repeatedOnReturn:repeated.length,shaderErrors:0}))
}finally{release();try{await writeFile('test-results/online-native-audit.json',JSON.stringify(await app.evaluate(({BrowserWindow})=>({events:globalThis.__nativeAudit,current:BrowserWindow.getAllWindows().map(w=>({visible:w.isVisible(),minimized:w.isMinimized(),focused:w.isFocused(),bounds:w.getContentBounds()}))})),null,2))}finally{await app.close()}}
