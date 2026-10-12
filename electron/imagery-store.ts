import {readFile,writeFile,mkdir,rename,unlink,statfs,readdir,stat} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
export interface TileRequest {source:'eox'|'nasa';z:number;row:number;col:number}
export function validatedTile(input:unknown):TileRequest {
 if(!input||typeof input!=='object')throw Error('Invalid tile request')
 const p=input as TileRequest
 if(p.source!=='eox'&&p.source!=='nasa')throw Error('Invalid source')
 const span=(p.source==='eox'?180:288)/2**p.z,max=p.source==='eox'?13:7
 if(![p.z,p.row,p.col].every(Number.isInteger)||p.z<0||p.z>max||p.row<0||p.col<0||p.row>=Math.ceil(180/span)||p.col>=Math.ceil(360/span))throw Error('Invalid tile coordinates')
 return {source:p.source,z:p.z,row:p.row,col:p.col}
}
function dataset(p:TileRequest){return p.source==='eox'?'eox-s2cloudless-2024-WGS84':'nasa-blue-marble-500m-v1'}
function digest(b:Uint8Array){return createHash('sha256').update(b).digest('hex')}
export function validImage(b:Buffer,size:number){
 if(b.length<24||b.length>2*1024*1024)return false
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return b.readUInt32BE(16)===size&&b.readUInt32BE(20)===size
 if(b[0]!==255||b[1]!==216)return false
 let offset=2
 while(offset+4<=b.length){if(b[offset++]!==255)return false;while(b[offset]===255)offset++;const marker=b[offset++];if(marker===217||marker===218)return false;if(marker===1||(marker>=208&&marker<=215))continue;const length=b.readUInt16BE(offset);if(length<2||offset+length>b.length)return false;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return length>=8&&b.readUInt16BE(offset+3)===size&&b.readUInt16BE(offset+5)===size;offset+=length}
 return false
}
export class ImageryStore {
 root:string;warning='';private pending=0;private pendingBytes=0;private peakPendingBytes=0;private lastSaveMs=0;
 get activity(){return {pending:this.pending,pendingBytes:this.pendingBytes,peakPendingBytes:this.peakPendingBytes,lastSaveMs:this.lastSaveMs}}
private beforeMetadataCommit?:()=>Promise<void>;private chain:Promise<unknown>=Promise.resolve();private available:()=>Promise<bigint>;private summary?:{bytes:number;tiles:number};private scanned=0;private scanTask?:Promise<void>;private catalog=new Set<string>();private indexed=false;private indexTask?:Promise<void>
 constructor(root:string,available?:()=>Promise<bigint>,beforeMetadataCommit?:()=>Promise<void>){this.beforeMetadataCommit=beforeMetadataCommit;this.root=root;this.available=available??(async()=>{const disk=await statfs(this.root,{bigint:true});return disk.bavail*disk.bsize})}
 private paths(p:TileRequest){const dir=join(this.root,dataset(p),String(p.z),String(p.row));return {dir,file:join(dir,p.col+'.tile'),meta:join(dir,p.col+'.json')}}
 private async index(){
  if(this.indexed)return
  if(!this.indexTask)this.indexTask=(async()=>{for(const file of await readdir(this.root,{recursive:true}).catch(()=>[]))if(file.endsWith('.json')||file.endsWith('.json.pending'))this.catalog.add(join(this.root,file.replace(/\.pending$/,'')));this.indexed=true})().finally(()=>{this.indexTask=undefined})
  await this.indexTask
 }
 async canAssemble(input:unknown){const p=validatedTile(input);await this.index();const max=p.source==='eox'?13:7
  const complete=(tile:TileRequest,depth:number):boolean=>this.catalog.has(this.paths(tile).meta)||(depth<3&&tile.z<max&&[0,1].every(r=>[0,1].every(c=>complete({...tile,z:tile.z+1,row:tile.row*2+r,col:tile.col*2+c},depth+1))))
  return p.z>=3&&p.z<max&&[0,1].every(r=>[0,1].every(c=>complete({...p,z:p.z+1,row:p.row*2+r,col:p.col*2+c},1)))
 }
 private async descriptor(paths:{file:string;meta:string},b:Buffer){
  for(const path of [paths.meta,paths.meta+'.pending'])try{const m=JSON.parse(await readFile(path,'utf8'));if(m.bytes===b.length&&m.sha256===digest(b))return {m,path}}catch{}
  return null
 }
 async read(input:unknown):Promise<Uint8Array|null>{const p=validatedTile(input),paths=this.paths(p);try{const fileStat=await stat(paths.file);if(fileStat.size>2097152)return null;const b=await readFile(paths.file);if(!validImage(b,p.source==='eox'?256:512)||!await this.descriptor(paths,b))return null;return new Uint8Array(b)}catch{return null}}
 async save(input:unknown,data:Uint8Array){const p=validatedTile(input),b=Buffer.from(data);if(!validImage(b,p.source==='eox'?256:512))throw Error('Invalid image content')
 const save=async()=>{const paths=this.paths(p);let temp='',metaTemp='';try{
 await mkdir(paths.dir,{recursive:true});
 const oldBytes=await readFile(paths.file).catch(()=>null);
 const recovered=oldBytes?await this.descriptor(paths,oldBytes):null;
 if(recovered?.path===paths.meta+'.pending')await rename(recovered.path,paths.meta);
 const previous=recovered?.m??null;
 if(previous?.bytes===b.length&&previous?.sha256===digest(b)){
   const existing=await readFile(paths.file).catch(()=>null)
   if(existing&&existing.equals(b)){this.catalog.add(paths.meta);return true}
 }
 if(await this.available()<BigInt(256*1024*1024+b.length)){this.warning='磁盘空间不足，已停止新增保存；已有影像保留';return false}

 temp=paths.file+'.'+randomUUID()+'.part';metaTemp=paths.meta+'.'+randomUUID()+'.part'
 await writeFile(temp,b,{flag:'wx'});await writeFile(metaTemp,JSON.stringify({bytes:b.length,sha256:digest(b),source:p.source,version:dataset(p)}),{flag:'wx'});await rename(metaTemp,paths.meta+'.pending');metaTemp='';await rename(temp,paths.file);temp='';await this.beforeMetadataCommit?.();await rename(paths.meta+'.pending',paths.meta);this.catalog.add(paths.meta);if(this.summary){this.summary.bytes+=b.length-(previous?.bytes??0);if(!previous)this.summary.tiles++}this.warning='';return true
 }catch{this.summary=undefined;this.scanned=0;this.warning='影像保存暂不可用，已有文件保留；仍可联网浏览';return false}finally{if(temp)await unlink(temp).catch(()=>{});if(metaTemp)await unlink(metaTemp).catch(()=>{})}}
 this.pending++;this.pendingBytes+=b.length;this.peakPendingBytes=Math.max(this.peakPendingBytes,this.pendingBytes)
 const result=this.chain.then(async()=>{const started=performance.now();try{return await save()}finally{this.pending--;this.pendingBytes-=b.length;this.lastSaveMs=performance.now()-started}});this.chain=result.catch(()=>{});return result
 }
 async flush(){await this.chain}
 async info(){
  await this.chain
  if(this.warning.startsWith('磁盘空间不足'))try{if(await this.available()>=BigInt(258*1024*1024))this.warning=''}catch{}
  if(!this.summary||Date.now()-this.scanned>60000){
   if(!this.scanTask)this.scanTask=(async()=>{
    let bytes=0,tiles=0
    const entries:string[]=[]
    const collect=async(dir:string)=>{for(const e of await readdir(dir,{withFileTypes:true}).catch(()=>[])){if(e.isSymbolicLink())continue;const path=join(dir,e.name);if(e.isDirectory())await collect(path);else if(e.name.endsWith('.json')||e.name.endsWith('.json.pending'))entries.push(path.replace(/\.pending$/,''))}}
    await collect(this.root)
    const unique=[...new Set(entries)];let cursor=0
    await Promise.all(Array.from({length:16},async()=>{while(cursor<unique.length){const canonical=unique[cursor++];try{
      const pending=await readFile(canonical+'.pending','utf8').catch(()=>null)
      const image=pending?await readFile(canonical.replace(/\.json$/,'.tile')).catch(()=>null):null
      const match=image?await this.descriptor({meta:canonical,file:canonical.replace(/\.json$/,'.tile')},image):null
      const m=match?.m??JSON.parse(await readFile(canonical,'utf8'))
      if(Number.isFinite(m.bytes)&&m.bytes>0){bytes+=m.bytes;tiles++}
    }catch{}}}))
    this.summary={bytes,tiles};this.scanned=Date.now()
   })().finally(()=>{this.scanTask=undefined})
   await this.scanTask
  }
  return {directory:this.root,bytes:this.summary!.bytes,tiles:this.summary!.tiles,warning:this.warning}
 }

}
