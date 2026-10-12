import {prepareControls} from './ui-controls.mjs'
import assert from 'node:assert/strict'
import path from 'node:path'
import {writeFile} from 'node:fs/promises'
import {_electron as electron} from 'playwright'
import {solarPosition} from '../src/engine/astronomy/solar.ts'
const exe=process.argv[2],env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
const args=['--mute-audio','--user-data-dir='+path.resolve('test-results/persistent-real-1790863173295')]
const app=await electron.launch(exe?{executablePath:path.resolve(exe),args,env}:{args:['.',...args],env})
try {
 const page=await app.firstWindow(),errors=[],captures=[]
 const capture=async file=>{const start=performance.now(),visibility=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return{visible:w.isVisible(),minimized:w.isMinimized(),focused:w.isFocused()}}),hidden=await page.evaluate(()=>document.hidden);const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));await writeFile(file,Buffer.from(png,'base64'));captures.push({file,wallMs:performance.now()-start,hidden,...visibility})}
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE|GL_INVALID/i.test(m.text()))errors.push(m.text())})
 for(const host of ['tiles.maps.eox.at','gibs.earthdata.nasa.gov'])await page.route('https://'+host+'/**',r=>r.abort('internetdisconnected'))
 await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await prepareControls(page,true)
 await page.addInitScript(epoch=>{const NativeDate=Date;window.__fixedEpoch=epoch;class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[window.__fixedEpoch]))}static now(){return window.__fixedEpoch}};globalThis.Date=FixedDate},Date.parse('2026-10-01T00:00Z'));await page.reload();await prepareControls(page,true)
 await page.waitForFunction(()=>document.querySelector('[data-testid="imagery-state"]')?.dataset.hasView==='true')
 await page.getByRole('checkbox',{name:'播放背景音乐',exact:true}).uncheck()
 for(const name of ['晨昏线','太阳方向','地轴倾角','自转轴'])await page.getByRole('checkbox',{name,exact:true}).check()
 await page.waitForTimeout(1800)
 const read=()=>page.getByTestId('solar-state').evaluate(el=>({latitude:Number(el.dataset.latitude),longitude:Number(el.dataset.longitude),tilt:Number(el.dataset.obliquity)}))
 const first=await read(),expected=solarPosition(Date.parse('2026-10-01T00:00Z'))
 assert.ok(Math.abs(first.latitude-expected.latitude)<1e-8);assert.ok(Math.abs(first.longitude-expected.longitude)<1e-8)
 await capture('test-results/v02-dawn.png')
 for(const name of ['太阳方向','地轴倾角','自转轴','太阳直射点'])await page.getByRole('checkbox',{name,exact:true}).uncheck()
 await page.waitForTimeout(300);await capture('test-results/v02-natural-dawn.png')
 await page.getByRole('checkbox',{name:'大气辉光',exact:true}).uncheck();await page.waitForTimeout(300)
 await capture('test-results/v02-atmosphere-off.png')
 const atmosphereDelta=await app.evaluate(({nativeImage},directory)=>{
   const on=nativeImage.createFromPath(directory+'/v02-natural-dawn.png'),off=nativeImage.createFromPath(directory+'/v02-atmosphere-off.png');
   const {width:w,height:h}=on.getSize(),a=on.getBitmap(),b=off.getBitmap();
   const region=(left,right)=>{let difference=0,n=0;for(let y=Math.floor(h*.47);y<Math.floor(h*.52);y++)for(let x=Math.floor(w*left);x<Math.floor(w*right);x++){
     const i=(y*w+x)*4;difference+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);n+=3
   }return difference/n};return {dayLimb:region(.685,.705),nightLimb:region(.29,.31)}
 },path.resolve('test-results'))
 assert.ok(atmosphereDelta.dayLimb>0.1&&atmosphereDelta.nightLimb<atmosphereDelta.dayLimb*.5,'Atmosphere must favor the illuminated limb, rather than a uniform blue ring')
 await page.getByRole('checkbox',{name:'大气辉光',exact:true}).check()
 await page.getByRole('checkbox',{name:'晨昏线',exact:true}).uncheck()
 await page.waitForTimeout(300);await capture('test-results/v02-natural-boundary.png')
 await page.getByRole('button',{name:'日照视角',exact:true}).click();await page.waitForTimeout(2000)
 await capture('test-results/v02-sun-view.png')
 await page.getByRole('checkbox',{name:'调试信息',exact:true}).check();await page.waitForTimeout(1200)
 console.log(JSON.stringify({stage:'diagnostics',visibility:await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return{visible:w.isVisible(),minimized:w.isMinimized(),focused:w.isFocused()}}),clock:await page.evaluate(()=>({hidden:document.hidden,performance:performance.now(),date:Date.now(),checked:document.querySelector('#viewer-settings input[type=checkbox]:last-of-type')?.checked}))}));
 const actualLongitude=Number(await page.getByTestId('diagnostics').getAttribute('data-longitude'))
 assert.ok(Math.abs(actualLongitude-expected.longitude)<0.05,'Sun view must center on the computed subsolar position')
 await page.getByRole('checkbox',{name:'调试信息',exact:true}).uncheck()
 await page.evaluate(epoch=>{window.__fixedEpoch=epoch},Date.parse('2026-10-01T12:00Z'))
 await page.getByRole('button',{name:'重置视角',exact:true}).click();await page.waitForTimeout(1500)
 const second=await read();assert.ok(Math.abs(second.longitude-first.longitude)>170)
 for(const name of ['晨昏线','太阳方向','地轴倾角','自转轴'])await page.getByRole('checkbox',{name,exact:true}).uncheck()
 await page.waitForTimeout(300)
 await capture('test-results/v02-night.png')
 await page.getByRole('checkbox',{name:'昼夜明暗',exact:true}).uncheck();await page.getByRole('checkbox',{name:'大气辉光',exact:true}).uncheck();await page.waitForTimeout(300)
 await capture('test-results/v02-neutral.png')
 const luminance=await app.evaluate(({nativeImage},directory)=>{
   const mean=name=>{const image=nativeImage.createFromPath(directory+'/'+name),{width:w,height:h}=image.getSize(),pixels=image.getBitmap();let sum=0,count=0;
     for(let y=Math.floor(h*.42);y<Math.floor(h*.52);y++)for(let x=Math.floor(w*.47);x<Math.floor(w*.53);x++){
       const i=(y*w+x)*4;sum+=pixels[i]+pixels[i+1]+pixels[i+2];count+=3
     }return sum/count
   };return {night:mean('v02-night.png'),neutral:mean('v02-neutral.png')}
 },path.resolve('test-results'))
 assert.ok(luminance.night>2&&luminance.night<luminance.neutral*.8,'Night must be visibly darker, with readable residual detail')
 for(const name of ['昼夜明暗','大气辉光','晨昏线','太阳直射点','太阳方向','地轴倾角']){
   const box=page.getByRole('checkbox',{name,exact:true});await box.check();await box.uncheck();await box.check()
 }
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({packaged:!!exe,first,second,luminance,atmosphereDelta,captures,errors}))
}finally{await app.close()}
