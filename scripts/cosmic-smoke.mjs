import {prepareControls} from './ui-controls.mjs'
import assert from 'node:assert/strict'
import path from 'node:path'
import {mkdir,writeFile} from 'node:fs/promises'
import {_electron as electron} from 'playwright'
const exe=process.argv[2],env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
const output=path.resolve('test-results/v03-cosmos');await mkdir(output,{recursive:true})
const args=['--mute-audio','--user-data-dir='+path.resolve('test-results/persistent-real-1790863173295')]
const app=await electron.launch(exe?{executablePath:path.resolve(exe),args,env}:{args:['.',...args],env})
try{
 const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 for(const host of ['tiles.maps.eox.at','gibs.earthdata.nasa.gov'])await page.route('https://'+host+'/**',r=>r.abort())
 await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await prepareControls(page,false)
 await page.getByRole('button',{name:'暂停时间',exact:true}).click()
 await page.getByRole('button',{name:'日照视角',exact:true}).click();await page.waitForTimeout(1200)
 await page.evaluate(()=>{
  const canvas=document.querySelector('canvas'),key=Object.keys(canvas).find(k=>k.startsWith('__reactFiber'));let fiber=canvas[key]
  for(let n=0;fiber&&n<40;n++,fiber=fiber.return){let hook=fiber.memoizedState
   for(let i=0;hook&&i<80;i++,hook=hook.next){const value=hook.memoizedState?.current;if(value?.camera&&value?.gl&&value?.invalidate){window.__review=value;return}}
  }throw Error('Canvas store missing')
 })
 const visible=()=>page.evaluate(()=>{let result={stars:false,nebula:false,meteor:false}
  window.__review.scene.traverse(o=>{if(o.type==='Points'&&o.geometry.attributes.position.count===1800)result.stars=o.visible
   if(o.geometry?.parameters?.radius===46)result.nebula=o.visible
   if(o.type==='LineSegments'&&o.material.color.getHexString()==='bfd7ef')result.meteor=o.parent.visible&&o.material.opacity>0
  });return result
 })
 assert.equal((await visible()).stars,true)
 await page.getByRole('checkbox',{name:'星空',exact:true}).uncheck();assert.equal((await visible()).stars,false)
 await page.screenshot({path:path.join(output,'all-off.png')})
 await page.getByRole('checkbox',{name:'星空',exact:true}).check()
 await page.getByRole('checkbox',{name:'星云',exact:true}).check();assert.equal((await visible()).nebula,true)
 await page.screenshot({path:path.join(output,'stars-nebula.png')})
 await page.getByRole('checkbox',{name:'流星',exact:true}).check()
 await page.waitForFunction(()=>{let active=false;window.__review.scene.traverse(o=>{if(o.type==='LineSegments'&&o.material.color.getHexString()==='bfd7ef'&&o.parent.visible&&o.material.opacity>0)active=true});return active},null,{timeout:18000})
 await page.screenshot({path:path.join(output,'meteor.png')})
 await page.getByRole('checkbox',{name:'流星',exact:true}).uncheck();assert.equal((await visible()).meteor,false)
 await page.getByRole('checkbox',{name:'星云',exact:true}).uncheck();assert.equal((await visible()).nebula,false)
 assert.deepEqual(errors,[]);const result={packaged:!!exe,starsToggle:true,nebulaToggle:true,meteorObserved:true,meteorToggle:true,errors};await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}finally{await app.close()}
