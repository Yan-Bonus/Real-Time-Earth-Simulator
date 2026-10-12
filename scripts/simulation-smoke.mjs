import {prepareControls,setSimulationRate} from './ui-controls.mjs'
import assert from 'node:assert/strict'
import path from 'node:path'
import {writeFile} from 'node:fs/promises'
import {_electron as electron} from 'playwright'
const exe=process.argv[2],env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
const args=['--disable-features=CalculateNativeWinOcclusion','--mute-audio','--user-data-dir='+path.resolve('test-results/simulation-profile')]
const app=await electron.launch(exe?{executablePath:path.resolve(exe),args,env}:{args:['.',...args],env})
try {
 const shot=async file=>{const capture=await app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {visible:w.isVisible(),minimized:w.isMinimized(),png:(await w.webContents.capturePage()).toPNG().toString('base64')}});console.log('native capture',file,{visible:capture.visible,minimized:capture.minimized});await writeFile(file,Buffer.from(capture.png,'base64'))}
 const page=await app.firstWindow(),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(message.type()==='error'&&/shader|WebGL|THREE|GL_INVALID/i.test(message.text()))errors.push(message.text())})
 await page.route('https://tiles.maps.eox.at/**',route=>route.abort())
 await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await prepareControls(page,false)
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setAlwaysOnTop(true);w.show();w.focus()})
 await page.bringToFront()
 await page.waitForFunction(()=>document.querySelector('[data-testid="imagery-state"]')?.dataset.hasView==='true')
 const epoch=async()=>Number(await page.getByTestId('clock-panel').getAttribute('data-epoch'))
 const solar=async()=>Number(await page.getByTestId('solar-state').getAttribute('data-longitude'))
 await page.getByRole('button',{name:'暂停时间',exact:true}).click();await page.waitForTimeout(350)
 const frozen=await epoch(),sun=await solar();await page.waitForTimeout(600)
 assert.equal(await epoch(),frozen);assert.equal(await solar(),sun)
 await setSimulationRate(page,'3600');await page.waitForTimeout(900)
 const forward=await epoch();assert.ok(forward-frozen>2000000);assert.notEqual(await solar(),sun)
 await setSimulationRate(page,'-3600');const reverseStart=await epoch(),reverseRate=await page.getByTestId('time-controls').getAttribute('data-rate');await page.waitForTimeout(900);console.log(JSON.stringify({forward,reverseStart,reverseEnd:await epoch(),reverseRate,finalRate:await page.getByTestId('time-controls').getAttribute('data-rate')}))
 assert.equal(reverseRate,'-3600');assert.ok(await epoch()<reverseStart-1500000,'Measure reverse progress after the control change, not before its asynchronous action')
 const synchronized=await page.evaluate(()=>({clock:Number(document.querySelector('[data-testid="clock-panel"]').dataset.epoch),sun:Number(document.querySelector('[data-testid="solar-state"]').dataset.epoch)}));assert.equal(synchronized.clock,synchronized.sun,'Time and Sun panels must share one epoch')
 await page.getByRole('button',{name:'暂停时间',exact:true}).click();
 await page.getByRole('button',{name:'继续播放',exact:true}).click();
 assert.equal(await page.getByTestId('time-controls').getAttribute('data-rate'),'-3600');
 await page.getByRole('button',{name:'暂停时间',exact:true}).click();await page.waitForTimeout(300)
 await page.getByRole('button',{name:'日照视角',exact:true}).click()
 await page.getByRole('combobox',{name:'模拟速度',exact:true}).scrollIntoViewIfNeeded()
 await shot('test-results/v03-time-controls.png')
 await page.getByRole('button',{name:'返回当前时间',exact:true}).click();await page.waitForTimeout(300)
 assert.ok(Math.abs(await epoch()-Date.now())<1500)
 assert.equal(await page.getByTestId('time-controls').getAttribute('data-real'),'true')
 await page.getByLabel('探索日期 UTC',{exact:true}).fill('2024-02-29T12:30')
 await page.getByRole('button',{name:'跳转日期',exact:true}).click()
 assert.equal(await epoch(),Date.UTC(2024,1,29,12,30))
 await page.getByRole('spinbutton',{name:'四季场景年份',exact:true}).fill('2027')
 for(const [name,month,day]of [['春分',2,20],['夏至',5,21],['秋分',8,22],['冬至',11,21]]){
  await page.getByRole('button',{name,exact:true}).click();assert.equal(await epoch(),Date.UTC(2027,month,day,12))
 }
 await page.getByRole('spinbutton',{name:'四季场景年份',exact:true}).fill('2101')
 await page.getByRole('button',{name:'春分',exact:true}).click();await page.getByRole('alert').filter({hasText:'四季场景年份'}).waitFor()
 await page.getByRole('spinbutton',{name:'四季场景年份',exact:true}).fill('2026')
 await page.getByRole('button',{name:'夏至',exact:true}).click()
 await shot('test-results/v03-seasons.png')
 // Acceptance: every supported nonzero rate resumes unchanged after pause.
 const resumeRates=[]
 for(const rate of [-3600,-60,-1,1,60,3600]){
  await setSimulationRate(page,String(rate))
  await page.getByRole('button',{name:'暂停时间',exact:true}).click()
  const held=await epoch();await page.waitForTimeout(100);assert.equal(await epoch(),held)
  await page.getByRole('button',{name:'继续播放',exact:true}).click()
  assert.equal(Number(await page.getByTestId('time-controls').getAttribute('data-rate')),rate)
  resumeRates.push(rate)
 }
 await page.getByRole('button',{name:'暂停时间',exact:true}).click()
 const beforeInvalid=await epoch()
 for(const value of ['', '1899-12-31T23:59', '2101-01-01T00:00']){
  await page.getByLabel('探索日期 UTC',{exact:true}).fill(value)
  await page.getByRole('button',{name:'跳转日期',exact:true}).click()
  await page.getByRole('alert').waitFor();assert.equal(await epoch(),beforeInvalid)
 }
 // Both date bounds must pause safely; native performance clocks remain unchanged.
 for(const [date,rate,bound]of [['1900-01-01T00:00',-3600,Date.UTC(1900,0,1)],['2100-12-31T23:59:59',3600,Date.UTC(2101,0,1)-1]]){
  await page.getByLabel('探索日期 UTC',{exact:true}).fill(date)
  await page.getByRole('button',{name:'跳转日期',exact:true}).click()
  await setSimulationRate(page,String(rate))
  await page.waitForFunction(()=>document.querySelector('[data-testid="time-controls"]').dataset.rate==='0')
  assert.equal(await epoch(),bound)
 }
 await page.getByRole('button',{name:'返回当前时间',exact:true}).click();await page.waitForTimeout(300)
 assert.ok(Math.abs(await epoch()-Date.now())<1000)
 const waitFullscreen=async expected=>{for(let attempt=0;attempt<120;attempt++){if(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen())===expected)return;await page.waitForTimeout(25)}throw Error('Native fullscreen did not reach '+expected)}
 const nativeKey=keyCode=>app.evaluate(({BrowserWindow},keyCode)=>{const contents=BrowserWindow.getAllWindows()[0].webContents;contents.sendInputEvent({type:'keyDown',keyCode});contents.sendInputEvent({type:'keyUp',keyCode})},keyCode)
 await nativeKey('F11');await waitFullscreen(true)
 await nativeKey('Escape');await waitFullscreen(false)
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({packaged:!!exe,pause:true,forward:true,reverse:true,solarSynchronized:true,returnToNow:true,resumeOriginalRate:true,utcDates:true,fourApproximateSeasons:true,inputErrors:true,resumeRates,dateBounds:true,invalidDatesPreserveTime:true,fullscreenKeys:true,errors}))
} finally {await app.close()}

