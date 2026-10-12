import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const dir='test-results/global-tiles';await mkdir(dir,{recursive:true})
let next=0,done=0;const entries=[]
await Promise.all(Array.from({length:4},async()=>{while(next<128){const n=next++,row=Math.floor(n/16),col=n%16,url='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024/default/WGS84/3/'+row+'/'+col+'.jpg',file=dir+'/'+row+'-'+col+'.jpg';let bytes
try{bytes=await readFile(file)}catch{for(let attempt=0;attempt<4;attempt++){try{const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>2097152||bytes[0]!==255||bytes[1]!==216)throw Error('Invalid JPEG');await writeFile(file,bytes);break}catch(e){if(attempt===3)throw e;await new Promise(r=>setTimeout(r,1000*(attempt+1)))}}}
entries.push({row,col,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});done++;if(done%16===0)console.log('Global tiles '+done+'/128')}}))
await writeFile('public/imagery/global-manifest.json',JSON.stringify({source:'eox',dataset:'s2cloudless-2024',matrix:'WGS84',level:3,columns:16,rows:8,width:4096,height:2048,url:'https://cloudless.eox.at/products/viewing',license:'CC BY-NC-SA 4.0',attribution:'© EOX · Contains modified Copernicus Sentinel data 2024',tiles:entries.sort((a,b)=>a.row-b.row||a.col-b.col)},null,2))
console.log('All global source tiles downloaded and checksummed')
