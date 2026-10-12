import assert from 'node:assert/strict'
import path from 'node:path'
import {mkdir,writeFile} from 'node:fs/promises'
import {_electron as electron} from 'playwright'
const stage=process.argv[2]??'panel',exe=process.argv[3],env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
const output=path.resolve('test-results/v03-ui-'+stage);await mkdir(output,{recursive:true})
const args=['--disable-features=CalculateNativeWinOcclusion','--mute-audio','--user-data-dir='+path.resolve('test-results/persistent-real-1790863173295')]
const app=await electron.launch(exe?{executablePath:path.resolve(exe),args,env}:{args:['.',...args],env})
try {
 const capture=async file=>{const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));await writeFile(path.join(output,file),Buffer.from(png,'base64'))}
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 for(const host of ['tiles.maps.eox.at','gibs.earthdata.nasa.gov'])await page.route('https://'+host+'/**',r=>r.abort())
 await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor()
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setContentSize(1440,900);w.setAlwaysOnTop(true);w.show();w.focus()})
 await page.waitForFunction(()=>document.querySelector('[data-testid="imagery-state"]')?.dataset.hasView==='true')
 const groups=page.locator('.control-group');assert.equal(await groups.count(),4)
 assert.deepEqual(await groups.evaluateAll(nodes=>nodes.map(n=>n.open)),[false,false,false,false])
 assert.equal(await page.locator('#viewer-settings').count(),0)
 await capture('initial.png')
 for(const title of ['时间探索','显示图层','宇宙背景','音乐']){
  const g=groups.filter({has:page.locator('summary',{hasText:title})});await g.locator('summary').click();assert.equal(await g.evaluate(n=>n.open),true);await g.locator('summary').click();assert.equal(await g.evaluate(n=>n.open),false)
 }
 await page.getByRole('button',{name:'设置',exact:true}).click()
 assert.equal(await page.getByRole('region',{name:'永久影像库'}).count(),1)
 await page.getByRole('checkbox',{name:'调试信息',exact:true}).check();await page.waitForTimeout(1200)
 assert.equal(await page.getByTestId('diagnostics').count(),1)
 await capture('settings.png')
 await page.keyboard.press('Escape');assert.equal(await page.locator('#viewer-settings').count(),0);assert.equal(await page.getByRole('button',{name:'设置',exact:true}).evaluate(e=>e===document.activeElement),true);await page.getByRole('button',{name:'设置',exact:true}).click()
 await page.getByRole('button',{name:'关闭设置',exact:true}).click();assert.equal(await page.getByTestId('diagnostics').count(),0)
 if(stage!=='panel'){
  const bar=page.getByTestId('time-controls');assert.equal(await bar.isVisible(),true)
  await page.getByRole('combobox',{name:'时间方向',exact:true}).selectOption('reverse');await page.getByRole('combobox',{name:'模拟速度',exact:true}).selectOption('3600')
  await page.getByRole('button',{name:'暂停时间',exact:true}).click()
  await page.getByRole('combobox',{name:'时间方向',exact:true}).selectOption('forward')
  assert.equal(await bar.getAttribute('data-rate'),'0')
  await page.getByRole('button',{name:'继续播放',exact:true}).click();assert.equal(await bar.getAttribute('data-rate'),'3600')
  await page.getByRole('button',{name:'返回当前时间',exact:true}).click();assert.equal(await bar.getAttribute('data-real'),'true')
  const title=page.locator('summary',{hasText:'时间探索'});await title.click()
  assert.equal(await page.getByRole('textbox',{name:'探索日期 UTC',exact:true}).isVisible(),true)
  await capture('time-expanded.png');await title.click()
  await page.getByRole('button',{name:'区域预览',exact:true}).click();await page.waitForTimeout(1800);await capture('nearest.png')
 }
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'result.json'),JSON.stringify({stage,groups:true,settings:true,time:stage!=='panel',errors},null,2));console.log('UI '+stage+' passed')
} finally {await app.close()}
