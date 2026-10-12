import {prepareControls} from './ui-controls.mjs'
import assert from 'node:assert/strict'
import path from 'node:path'
import {mkdir} from 'node:fs/promises'
import {_electron} from 'playwright'
const exe=process.argv[2],env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
await mkdir('test-results',{recursive:true})
const args=['--mute-audio','--user-data-dir='+path.resolve('test-results/music-profile-'+Date.now())]
const app=await _electron.launch({...exe?{executablePath:path.resolve(exe),args}:{args:['.',...args]},env})
try{
  const page=await app.firstWindow(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  for(const host of ['tiles.maps.eox.at','gibs.earthdata.nasa.gov'])await page.route('https://'+host+'/**',route=>route.abort('internetdisconnected'))
  await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await prepareControls(page,false)
  const audio=page.getByTestId('background-audio'),toggle=page.getByRole('checkbox',{name:'播放背景音乐',exact:true}),slider=page.getByRole('slider',{name:'背景音乐音量',exact:true})
  const playing=()=>page.waitForFunction(()=>{const a=document.querySelector('audio');return a&&!a.paused&&a.readyState>=3&&a.currentTime>.1},null,{timeout:15000})
  await playing();assert.equal(await toggle.isChecked(),true)
  const initial=await audio.evaluate(a=>({duration:a.duration,loop:a.loop,volume:a.volume,src:a.currentSrc}));assert.ok(initial.duration>0);assert.equal(initial.loop,true);assert.equal(initial.volume,.2);assert.equal(await page.locator('audio').count(),1)
  await toggle.uncheck();assert.equal(await audio.evaluate(a=>a.paused),true)
  await slider.fill('63');assert.equal(await audio.evaluate(a=>a.volume),.63)
  await toggle.check();await playing()
  await audio.evaluate(a=>{a.currentTime=a.duration-.15})
  await page.waitForFunction(()=>{const a=document.querySelector('audio');return a&&!a.paused&&a.currentTime<2},null,{timeout:5000})
  await slider.fill('0');assert.equal(await audio.evaluate(a=>a.volume),0);assert.equal(await toggle.isChecked(),true)
  await slider.fill('37');await toggle.uncheck();await page.reload();await prepareControls(page,false);await toggle.waitFor();assert.equal(await toggle.isChecked(),false);assert.equal(await slider.inputValue(),'37');assert.equal(await audio.evaluate(a=>a.paused),true);assert.equal(await audio.evaluate(a=>a.volume),.37)
  await toggle.check();await playing();await page.reload();await prepareControls(page,false);await playing();assert.equal(await slider.inputValue(),'37')
  assert.deepEqual(errors,[])
  await page.screenshot({path:'test-results/music-controls'+(exe?'-packaged':'')+'.png'})
  console.log(JSON.stringify({packaged:!!exe,initial,autoplay:true,loopBoundary:true,toggle:true,volumeRange:true,persistedAfterReload:true,pageErrors:0}))
}finally{await app.close()}
