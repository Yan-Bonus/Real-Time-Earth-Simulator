import assert from 'node:assert/strict'
import path from 'node:path'
import {_electron as electron} from 'playwright'
const exe=process.argv[2],env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EARTH_DEV_URL
const results=[]
for(let i=0;i<3;i++){const started=performance.now();const app=await electron.launch({executablePath:path.resolve(exe),args:['--mute-audio','--user-data-dir='+path.resolve('test-results/startup-'+Date.now())],env});try{const page=await app.firstWindow();let baseRequests=0;for(const host of ['tiles.maps.eox.at','gibs.earthdata.nasa.gov'])await page.route('https://'+host+'/**',async route=>{if(/WGS84\/3\//.test(route.request().url()))baseRequests++;await route.abort()});await page.getByRole('heading',{name:'地球观察室',exact:true}).waitFor();await page.waitForLoadState();await page.reload();await page.waitForFunction(()=>document.querySelector('[data-testid="imagery-state"]')?.dataset.hasView==='true',null,{timeout:15000});assert.equal(baseRequests,0);results.push(Math.round(performance.now()-started))}finally{await app.close()}}
console.log(JSON.stringify({offlineStartupMilliseconds:results,medianMilliseconds:[...results].sort((a,b)=>a-b)[1],baseNetworkRequests:0}))
