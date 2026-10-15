import {traceRender} from '../engine/renderTrace'
import { isWindowActive, subscribeActivity } from '../engine/windowActivity'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, CanvasTexture, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, SRGBColorSpace, Texture } from 'three'
import { AdaptiveDownloads, PrefetchBackoff, motionDetailLevel, MotionObservation } from '../imagery/scheduling'
import {blockingFailure,classifyFailure,httpFailure,failureMessage,failureDelay,affectsThroughput,sharedRetryDelay,loadingPhase,TileFailure} from '../imagery/failures'
import { earthMaterial } from './EarthAppearance'
import { selectClearView } from '../imagery/view'
import { ancestors, children, matrix, surfacePoint, tileBounds, tileKey, tileUrl, validTile, SOURCES, type ImagerySource, type TileId } from '../imagery/tiles'

export interface OnlineStatus {
  source: ImagerySource; displayedSource?: ImagerySource; phase: 'loading' | 'ready' | 'error' | 'limited'; loaded: number; total: number; hasView: boolean
  maxTexelRatio: number; targetDistance: number; message: string; saveWarning?:string
  runtime?:{assets:number;textureBytes:number;running:number;network:number;decode:number;reads:number;uploads:number;failures:number;motion:boolean;requested:number;canceled:number;decoded:number;uploaded:number;discarded:number;diskReads:number;diskHits:number;evicted:number;selections:number}
}
interface Props { source: ImagerySource; highest: boolean; pixelRatio: number; retryToken: number; onStatus: (status: OnlineStatus) => void; onUsable: () => void }
const MAX_TEXTURE_BYTES=512*1024*1024, BASE_LEVEL=3
interface Asset { bytes:number; source:ImagerySource; mesh:Mesh<BufferGeometry,MeshBasicMaterial>; bitmap:ImageBitmap; touched:number }
interface Base { canvas:HTMLCanvasElement; context:CanvasRenderingContext2D; ids:TileId[]; loaded:Set<string>; mesh?:Mesh<BufferGeometry,MeshBasicMaterial>; bytes:number; bitmap?:ImageBitmap; loading?:boolean; error?:boolean }
interface Job { id:TileId; source:ImagerySource; base:boolean; localOnly?:boolean }
function geometry(west:number,east:number,north:number,south:number,columns:number,rows:number,uMax=1,vMin=0) {
  const positions:number[]=[],normals:number[]=[],uv:number[]=[],indices:number[]=[]
  for(let r=0;r<=rows;r++)for(let c=0;c<=columns;c++){
    const p=surfacePoint(west+(east-west)*c/columns,north-(north-south)*r/rows)
    positions.push(...p);normals.push(...p);uv.push(c/columns*uMax,1-r/rows*(1-vMin))
  }
  for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){const a=r*(columns+1)+c,s=a+columns+1;indices.push(a,s,a+1,a+1,s,s+1)}
  const result=new BufferGeometry();result.setAttribute('position',new Float32BufferAttribute(positions,3));result.setAttribute('normal',new Float32BufferAttribute(normals,3));result.setAttribute('uv',new Float32BufferAttribute(uv,2));result.setIndex(indices);result.computeBoundingSphere();return result
}
function tileGeometry(id:TileId,source:ImagerySource){
  const b=tileBounds(id,source)
  // Angular tessellation preserves curvature without 32x32 vertices on every tiny patch.
  return geometry(b.west,b.east,b.north,b.south,Math.max(2,Math.ceil((b.east-b.west)/1.2)),Math.max(2,Math.ceil((b.north-b.south)/1.2)),b.uMax,b.vMin)
}
export default function RegionalImagery(props:Props) {
  const root=useRef<Group>(null),latest=useRef(props),refresh=useRef<()=>void>(()=>{}),tick=useRef<()=>void>(()=>{})
  const {camera,gl,invalidate,size}=useThree(),viewport=useRef(size)
  useLayoutEffect(()=>{latest.current=props;viewport.current=size},[props,size])
  useFrame(()=>tick.current())
  useEffect(()=>{
    const group=root.current!
    const downloadControls=new Map<ImagerySource,AdaptiveDownloads>([['eox',new AdaptiveDownloads()],['nasa',new AdaptiveDownloads()]])
    const prefetchBackoffs=new Map<ImagerySource,PrefetchBackoff>([['eox',new PrefetchBackoff()],['nasa',new PrefetchBackoff()]])
    let adaptive=downloadControls.get(latest.current.source)!
    const attempts=new Map<string,number>(), firstQueued=new Map<string,number>()
    const failureReasons=new Map<string,string>(),runningJobs=new Map<string,Job>(),runningStarted=new Map<string,number>(),networkJobs=new Set<string>()
    const cache=new Map<string,Asset>(),bases=new Map<ImagerySource,Base>(),running=new Map<string,AbortController>(),failures=new Map<string,number>()
    let networkActive=0,decodeActive=0,readsActive=0,requested=0,canceled=0,decoded=0,uploaded=0,discarded=0,diskReads=0,diskHits=0,evicted=0,selections=0
    let motionSpeed=0,responseMs=350,saveWarning='',lastStatusAt=0,lastPhase='',lastObservation=performance.now()
    group.updateWorldMatrix(true,false)
    const motion=new MotionObservation(camera.position.clone().applyMatrix4(group.parent!.matrixWorld.clone().invert()).normalize(),camera.position.length(),lastObservation)
    let wanted=new Map<string,Job>(),prefetch=new Map<string,Job>(),visible=new Set<string>(),active=0,disposed=false,usable=false
    let selectedSource=latest.current.source,selectedDistance=camera.position.length(),density=0,limited=false,lastMessage='',retryToken=latest.current.retryToken,lastSelect=0,lastMove=performance.now()
    const lastCamera=camera.position.clone(),lastDirection=camera.quaternion.clone(),lastEarth=group.parent!.quaternion.clone()
    let needed=new Set<string>(),settledPending=false,statusTimer:number|undefined,stopTimer:number|undefined
    const checkedLocal=new Set<string>(),repairLocal=new Set<string>()
    let displayedSource:ImagerySource|undefined
    const keyFor=(id:TileId,source:ImagerySource)=>source+'/'+tileKey(id)
    const baseKey=(id:TileId,source:ImagerySource)=>'base/'+keyFor(id,source)
    const baseBytes=()=>[...bases.values()].reduce((sum,b)=>sum+b.bytes,0)
    const cacheBytes=()=>[...cache.values()].reduce((sum,a)=>sum+a.bytes,0)
    function destroy(a:Asset){group.remove(a.mesh);a.mesh.geometry.dispose();a.mesh.material.map?.dispose();a.mesh.material.dispose();a.bitmap.close()}
    function prune(){
      let bytes=cacheBytes()+baseBytes()
      if(bytes<=MAX_TEXTURE_BYTES)return
      for(const [key,a] of [...cache].sort((a,b)=>a[1].touched-b[1].touched)){
        if(wanted.has(key)||visible.has(key))continue
        bytes-=a.bytes;evicted++;destroy(a);cache.delete(key);checkedLocal.delete(key);if(bytes<=MAX_TEXTURE_BYTES)break
      }
    }
    function loadBundled(base:Base){
      if(base.loading)return
      base.loading=true;base.error=false
      void fetch(import.meta.env.BASE_URL+'imagery/eox-2024-global.png').then(response=>{if(!response.ok)throw Error('Missing global resource');return response.blob()}).then(blob=>createImageBitmap(blob,{imageOrientation:'flipY'})).then(bitmap=>{
        if(disposed){bitmap.close();return}
        if(bitmap.width!==4096||bitmap.height!==2048){bitmap.close();throw Error('Invalid global resource')}
        const texture=new Texture(bitmap);texture.flipY=false;texture.colorSpace=SRGBColorSpace;texture.anisotropy=gl.capabilities.getMaxAnisotropy();texture.needsUpdate=true
        base.bitmap=bitmap;base.mesh=new Mesh(geometry(-180,180,90,-90,256,128),earthMaterial(texture));group.add(base.mesh)
        for(const id of base.ids)base.loaded.add(tileKey(id))
        base.loading=false;show();update();pump()
      }).catch(()=>{if(!disposed){base.loading=false;base.error=true;update()}})
    }
    function ensureBase(source:ImagerySource):Base{
      if(bases.has(source))return bases.get(source)!
      const m=matrix(BASE_LEVEL,source),canvas=document.createElement('canvas')
      canvas.width=m.columns*SOURCES[source].tileSize;canvas.height=m.rows*SOURCES[source].tileSize
      const context=canvas.getContext('2d')!
      const ids=Array.from({length:m.rows},(_,row)=>Array.from({length:m.columns},(_,col)=>({z:BASE_LEVEL,row,col}))).flat()
      const base:Base={canvas,context,ids,loaded:new Set<string>(),bytes:canvas.width*canvas.height*4*4/3};bases.set(source,base);if(source==='eox'){canvas.width=canvas.height=1;loadBundled(base)}return base
    }
    function isLoaded(key:string,job:Job){return job.id.z<=BASE_LEVEL?!!bases.get(job.source)?.mesh:cache.has(key)}
    function show(){
      const previous=visible,previousSource=displayedSource
      const source=latest.current.source,base=bases.get(source)
      if(base?.mesh){
        displayedSource=source
        visible=new Set()
        for(const job of wanted.values())for(const id of ancestors(job.id,source)){
          if(id.z<=BASE_LEVEL)break
          const key=keyFor(id,source);if(cache.has(key)){visible.add(key);break}
        }
        if(!usable){usable=true;latest.current.onUsable()}
      }
      for(const [s,b]of bases)if(b.mesh)b.mesh.visible=s===displayedSource
      for(const [key,a]of cache){if(a.source!==displayedSource)a.mesh.visible=false;else if(displayedSource===source)a.mesh.visible=visible.has(key);if(a.mesh.visible)a.touched=performance.now()}
      if(previousSource!==displayedSource||previous.size!==visible.size||[...visible].some(key=>!previous.has(key))){traceRender('imagery.visibleSet');invalidate()}
    }
    function update(){
      if(disposed)return
      const source=latest.current.source,base=ensureBase(source),baseReady=!!base.mesh
      const selectionCurrent=selectedSource===source
      const loaded=baseReady&&selectionCurrent?[...wanted].filter(([key,job])=>isLoaded(key,job)).length:base.loaded.size
      const total=baseReady?(selectionCurrent?wanted.size:0):base.ids.length
      const failedKey=baseReady?(selectionCurrent?([...wanted].find(([key,job])=>repairLocal.has(key)&&!isLoaded(key,job)&&failures.has(key)&&(attempts.get(key)??0)>=3)?.[0]??blockingFailure(wanted.values(),key=>cache.has(key),key=>failures.has(key)&&(attempts.get(key)??0)>=3)):undefined):base.ids.map(id=>baseKey(id,source)).find(key=>failures.has(key))
      const failed=base.error||!!failedKey
      const moving=performance.now()-lastMove<200&&motionSpeed>=.02
      const phase=loadingPhase(baseReady,failed,limited,loaded===total,moving,selectionCurrent)
      const message=!baseReady?(failed?(source==='eox'?'内置全球资源加载失败，请重试或修复安装':(failureReasons.get(failedKey??'')??'全球地表加载失败，请检查网络后重试')):(source==='eox'?'正在读取内置全球影像':'正在准备全球地表')):phase==='ready'?'当前视角高清已就绪':phase==='limited'?'已达到当前画质预算，仍可自由浏览':phase==='error'?(failureReasons.get(failedKey??'')??'部分高清影像暂不可用，请重试'):'正在补充高清细节'
      const runtime={assets:cache.size,textureBytes:Math.round(cacheBytes()+baseBytes()),running:active,network:networkActive,decode:decodeActive,reads:readsActive,uploads:uploads.length,failures:failures.size,motion:moving,requested,canceled,decoded,uploaded,discarded,diskReads,diskHits,evicted,selections}
      const status={source,displayedSource,phase,loaded,total,hasView:usable,maxTexelRatio:density,targetDistance:selectedDistance,message,saveWarning,runtime} satisfies OnlineStatus
      const encoded=JSON.stringify(status);if(encoded!==lastMessage){if(phase!==lastPhase||performance.now()-lastStatusAt>=200){clearTimeout(statusTimer);statusTimer=undefined;lastMessage=encoded;lastPhase=phase;lastStatusAt=performance.now();traceRender('imagery.status');latest.current.onStatus(status)}else if(statusTimer===undefined)statusTimer=window.setTimeout(()=>{statusTimer=undefined;update()},Math.max(1,200-(performance.now()-lastStatusAt)))}
    }
    const localReads=new Map<string,Promise<Uint8Array|null>>(),localBytes=new Map<string,Uint8Array>();let localByteCount=0
    function rememberLocal(key:string,bytes:Uint8Array){
      const old=localBytes.get(key);if(old)localByteCount-=old.byteLength
      localBytes.delete(key);localBytes.set(key,bytes);localByteCount+=bytes.byteLength
      while(localByteCount>16*1024*1024){const first=localBytes.keys().next().value!;localByteCount-=localBytes.get(first)!.byteLength;localBytes.delete(first)}
    }
    async function readLocal(job:Job,depth=0):Promise<Uint8Array|null>{
      const library=window.desktop?.imagery;if(!library||disposed)return null
      const key=keyFor(job.id,job.source),cached=localBytes.get(key);if(cached)return cached
      if(localReads.has(key))return localReads.get(key)!
      const request={...job.id,source:job.source}
      const task=(async()=>{
        diskReads++;const bytes=await library.read(request).catch(()=>null)
        if(bytes){diskHits++;rememberLocal(key,bytes);return bytes}
        if(depth>=3||job.id.z<BASE_LEVEL||!await library.canAssemble(request).catch(()=>false))return null
        const parts=children(job.id,job.source);if(parts.length!==4)return null
        const content=await Promise.all(parts.map(id=>readLocal({id,source:job.source,base:false},depth+1)))
        if(disposed||content.some(bytes=>!bytes))return null
        const size=SOURCES[job.source].tileSize,canvas=new OffscreenCanvas(size,size),context=canvas.getContext('2d')!
        context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high'
        for(let i=0;i<parts.length;i++){
          const bitmap=await createImageBitmap(new Blob([new Uint8Array(content[i]!)]),{imageOrientation:'none'})
          try{context.drawImage(bitmap,(parts[i].col%2)*size/2,(parts[i].row%2)*size/2,size/2,size/2)}finally{bitmap.close()}
        }
        const combined=new Uint8Array(await (await canvas.convertToBlob({type:'image/png'})).arrayBuffer())
        if(disposed)return null
        await library.save(request,combined).catch(()=>false);rememberLocal(key,combined);return combined
      })().catch(()=>null).finally(()=>localReads.delete(key))
      localReads.set(key,task);return task
    }
    function abortWork(controller:AbortController){if(!controller.signal.aborted){canceled++;controller.abort()}}
    const motionLevel=(source:ImagerySource)=>motionDetailLevel(SOURCES[source].rootSpan,SOURCES[source].maxLevel,motionSpeed,responseMs,performance.now()-lastMove<200)
    async function saveBytes(job:Job,bytes:Uint8Array){
      const library=window.desktop?.imagery;if(!library)return
      try {const saved=await library.save({...job.id,source:job.source},bytes);if(!disposed){saveWarning=saved?(saveWarning?(await library.info()).warning:''):(await library.info()).warning||'影像无法新增保存，已有文件保留';update()}}catch{if(!disposed){saveWarning='影像无法新增保存，已有文件保留';update()}}
    }
    async function decode(bytes:Uint8Array,job:Job,controller:AbortController){
      while(decodeActive>=2&&!disposed&&!controller.signal.aborted)await new Promise(resolve=>setTimeout(resolve,5))
      if(disposed||controller.signal.aborted)throw Error('Aborted')
      decodeActive++
      let bitmap:ImageBitmap
      try{bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)]),{imageOrientation:'flipY'})}catch{throw new TileFailure('invalid')}finally{decodeActive--}
      if(disposed||controller.signal.aborted||(job.source!==latest.current.source||(!job.base&&!needed.has(keyFor(job.id,job.source))))){bitmap.close();discarded++;throw Error('Aborted')}
      decoded++
      if(bitmap.width!==SOURCES[job.source].tileSize||bitmap.height!==SOURCES[job.source].tileSize){bitmap.close();throw new TileFailure('invalid')}
      return bitmap
    }
    async function download(job:Job,controller:AbortController){
            while(readsActive>=4&&!controller.signal.aborted)await new Promise(resolve=>setTimeout(resolve,5))
      if(controller.signal.aborted)throw Error('Aborted')
      readsActive++
      let saved:Uint8Array|null|undefined
      try{saved=await readLocal(job)}finally{readsActive--}
      if(controller.signal.aborted)throw Error('Aborted')
      if(saved){try{return await decode(saved,job,controller)}catch{if(controller.signal.aborted||disposed||(job.source!==latest.current.source||(!job.base&&!needed.has(keyFor(job.id,job.source)))))throw Error('Aborted');const key=keyFor(job.id,job.source),old=localBytes.get(key);if(old)localByteCount-=old.byteLength;localBytes.delete(key);repairLocal.add(key)}}
      if(job.localOnly){checkedLocal.add(keyFor(job.id,job.source));return null}
      while((networkActive>=adaptive.limit||performance.now()<adaptive.pauseUntil)&&!controller.signal.aborted)await new Promise(resolve=>setTimeout(resolve,20))
      if(controller.signal.aborted)throw Error('Aborted')
      networkActive++;requested++;const networkKey=keyFor(job.id,job.source);networkJobs.add(networkKey);const networkStart=performance.now()
      try {
      const response=await fetch(tileUrl(job.id,job.source),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]),credentials:'omit',cache:'no-store'})
      if(!response.ok)throw httpFailure(response.status,response.headers.get('Retry-After'))
      const length=Number(response.headers.get('content-length')??0);if(length>2097152)throw new TileFailure('invalid')
      const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>2097152)throw new TileFailure('invalid')
      responseMs=responseMs*.8+Math.min(3000,performance.now()-networkStart)*.2
      const bitmap=await decode(bytes,job,controller)
      rememberLocal(keyFor(job.id,job.source),bytes)
      void saveBytes(job,bytes)
      downloadControls.get(job.source)!.success(bytes.byteLength,performance.now())
      return bitmap
      }finally{networkActive--;networkJobs.delete(networkKey)}
    }
    const uploads:{job:Job;key:string;bitmap:ImageBitmap}[]=[]
    function drainUploads(){
      const started=performance.now();let count=0
      while(uploads.length&&count<(motionSpeed>=.02&&performance.now()-lastMove<200?1:2)&&performance.now()-started<3){const item=uploads.shift()!;if(item.job.source!==latest.current.source||(!item.job.base&&!needed.has(item.key))){item.bitmap.close();discarded++;continue}accept(item.job,item.key,item.bitmap);uploaded++;count++}
      if(count){update();pump()}
      if(uploads.length){traceRender('imagery.pendingUpload');invalidate()}
    }
    function accept(job:Job,key:string,bitmap:ImageBitmap){
      if(job.base){
        const base=ensureBase(job.source),s=SOURCES[job.source].tileSize
        // Network bitmaps are flipped for WebGL; undo that when assembling the global atlas.
        base.context.save();base.context.translate(job.id.col*s,(job.id.row+1)*s);base.context.scale(1,-1);base.context.drawImage(bitmap,0,0);base.context.restore();bitmap.close();base.loaded.add(tileKey(job.id))
        if(base.loaded.size===base.ids.length){
          const texture=new CanvasTexture(base.canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=gl.capabilities.getMaxAnisotropy()
          base.mesh=new Mesh(geometry(-180,180,90,-90,256,128),earthMaterial(texture));group.add(base.mesh)
        }
      }else{
        const texture=new Texture(bitmap);texture.flipY=false;texture.colorSpace=SRGBColorSpace;texture.anisotropy=gl.capabilities.getMaxAnisotropy();texture.needsUpdate=true;gl.initTexture(texture)
        const mesh=new Mesh(tileGeometry(job.id,job.source),earthMaterial(texture));mesh.scale.setScalar(1.0002+job.id.z*0.00001);mesh.renderOrder=job.id.z
        mesh.material.polygonOffset=true;mesh.material.polygonOffsetFactor=-job.id.z;mesh.material.polygonOffsetUnits=-job.id.z
        group.add(mesh);cache.set(key,{source:job.source,bytes:bitmap.width*bitmap.height*4*4/3,mesh,bitmap,touched:performance.now()})
      }
      failures.delete(key);attempts.delete(key);failureReasons.delete(key);repairLocal.delete(key);show();prune()
    }
    let priorityCamera=camera.position.clone(),priorityScores=new Map<string,number>()
    function priority(job:Job,key:string){
      if(priorityScores.has(key))return priorityScores.get(key)!
      const local=priorityCamera,bounds=tileBounds(job.id,job.source)
      const p=surfacePoint((bounds.west+bounds.east)/2,(bounds.north+bounds.south)/2)
      const center=local.x*p[0]+local.y*p[1]+local.z*p[2]
      const age=(performance.now()-(firstQueued.get(key)??performance.now()))/1000
      const span=(bounds.east-bounds.west)*Math.PI/180
      const distance=Math.sqrt(camera.position.lengthSq()+1-2*camera.position.length()*center)
      const pixels=span*viewport.current.height*gl.getPixelRatio()/(2*Math.tan((camera as PerspectiveCamera).fov*Math.PI/360)*Math.max(.1,distance))
      const fallback=ancestors(job.id,job.source).find(id=>id.z<=BASE_LEVEL||cache.has(keyFor(id,job.source)))?.z??BASE_LEVEL
      const deficit=pixels/SOURCES[job.source].tileSize*2**Math.max(0,job.id.z-fallback)
      const score=center*20+Math.log2(1+deficit)*5+age*.2;priorityScores.set(key,score);return score
    }
    function pump(){
      if(disposed||!isWindowActive())return
      priorityCamera=camera.position.clone().applyMatrix4(group.parent!.matrixWorld.clone().invert()).normalize();priorityScores=new Map()
      const source=latest.current.source,base=ensureBase(source),queue:[string,Job][]=[]
      if(selectedSource!==source||(!base.mesh&&source==='eox'))return
      if(!base.mesh){for(const id of base.ids)if(!base.loaded.has(tileKey(id)))queue.push([baseKey(id,source),{id,source,base:true}])}
      else {
        const intermediate=new Map<string,Job>(),cap=motionLevel(source)
        for(const [key,job]of wanted)if(!isLoaded(key,job)){
          if(!checkedLocal.has(key)&&!running.has(key)){intermediate.set(key,{...job,localOnly:true});continue}
          if(runningJobs.get(key)?.localOnly)continue
          if(repairLocal.has(key)){intermediate.set(key,job);continue}
          const chain=ancestors(job.id,source),fallback=chain.find(id=>id.z<=BASE_LEVEL||cache.has(keyFor(id,source)))?.z??BASE_LEVEL
          const next=chain.find(id=>id.z<=cap&&id.z<=fallback+1)
          if(next&&next.z>BASE_LEVEL){const k=keyFor(next,source);if(!isLoaded(k,{...job,id:next}))intermediate.set(k,{id:next,source,base:false})}
        }
        for(const [key]of intermediate)if(!firstQueued.has(key))firstQueued.set(key,performance.now())
        queue.push(...[...intermediate].sort((a,b)=>priority(b[1],b[0])-priority(a[1],a[0])))
        if(prefetchBackoffs.get(source)!.ready(performance.now())&&performance.now()-lastMove>500&&cacheBytes()+baseBytes()<MAX_TEXTURE_BYTES*.85)for(const [key,job]of prefetch)if(!cache.has(key))queue.push([key,job])
      }
      const now=performance.now()
      for(const [key,job]of queue){
        if(active>=16||uploads.length>=8)break
        if(running.has(key)||uploads.some(item=>item.key===key)||(failures.get(key)??0)>now||(attempts.get(key)??0)>=5)continue
        const controller=new AbortController();running.set(key,controller);runningJobs.set(key,job);runningStarted.set(key,now);active++
        void download(job,controller).then(bitmap=>{if(!bitmap)return;if(disposed||controller.signal.aborted||(job.source!==latest.current.source||(!job.base&&!needed.has(key)))){bitmap.close();discarded++;return}uploads.push({job,key,bitmap});traceRender('imagery.uploadReady');invalidate()}).catch(error=>{const failure=classifyFailure(error);if(!disposed&&!controller.signal.aborted&&failure.kind!=='canceled'){const attempt=(attempts.get(key)??0)+1,delay=failureDelay(failure,attempt);if(prefetch.has(key)&&!wanted.has(key))prefetchBackoffs.get(job.source)!.failure(performance.now(),delay);attempts.set(key,attempt);failureReasons.set(key,failureMessage(failure));failures.set(key,performance.now()+delay);if(affectsThroughput(failure))downloadControls.get(job.source)!.failure(performance.now(),sharedRetryDelay(failure,delay))}}).finally(()=>{
          active--;running.delete(key);runningJobs.delete(key);runningStarted.delete(key);if(!disposed){update();pump()}
        })
      }
    }
    function select(){
      if(disposed||!isWindowActive())return
      selections++;lastSelect=performance.now()
      group.updateWorldMatrix(true,false)
      const options=latest.current,base=ensureBase(options.source),tileBytes=SOURCES[options.source].tileSize**2*4*4/3
      adaptive=downloadControls.get(options.source)!
      const budget=Math.min(1536,Math.max(64,Math.floor((MAX_TEXTURE_BYTES-baseBytes())*.85/tileBytes)))
      const view=selectClearView(camera as PerspectiveCamera,group.parent!.matrixWorld,viewport.current.width*gl.getPixelRatio(),viewport.current.height*gl.getPixelRatio(),options.source,options.highest,budget)
      selectedSource=options.source;selectedDistance=camera.position.length();density=view.maxTexelRatio;limited=view.limited
      wanted=new Map(view.tiles.map(id=>[keyFor(id,options.source),{id,source:options.source,base:false}]))
      for(const [key]of wanted)if(!firstQueued.has(key))firstQueued.set(key,performance.now())
      for(const key of firstQueued.keys())if(!wanted.has(key)&&!cache.has(key))firstQueued.delete(key)
      for(const key of checkedLocal)if(!wanted.has(key)&&!cache.has(key)&&!running.has(key)){checkedLocal.delete(key);repairLocal.delete(key)}
      prefetch=new Map()
      for(const id of view.tiles){
        if(id.z<=BASE_LEVEL)continue
        const m=matrix(id.z,options.source)
        for(const [dr,dc]of [[0,1],[0,-1],[1,0],[-1,0]]){
          const neighbor={z:id.z,row:id.row+dr,col:(id.col+dc+m.columns)%m.columns}
          if(validTile(neighbor,options.source)){const key=keyFor(neighbor,options.source);if(!wanted.has(key))prefetch.set(key,{id:neighbor,source:options.source,base:false})}
        }
      }
      // Cancel obsolete work, preserving valid ancestors and the immediate surrounding view.
      needed=new Set([...wanted.keys(),...(motionLevel(options.source)<SOURCES[options.source].maxLevel?[]:prefetch.keys())])
      for(const job of wanted.values())for(const id of ancestors(job.id,job.source))needed.add(keyFor(id,job.source))
      for(const [key,controller]of running){const job=runningJobs.get(key);if(job?.source!==options.source||(!key.startsWith('base/')&&(!needed.has(key)||(job&&job.id.z>motionLevel(job.source)&&networkJobs.has(key)&&performance.now()-(runningStarted.get(key)??0)<responseMs*.7))))abortWork(controller)}
      for(const key of failures.keys())if(failures.size>1024&&!needed.has(key)&&!running.has(key)&&!key.startsWith('base/')){failures.delete(key);attempts.delete(key);failureReasons.delete(key)}
      for(let i=uploads.length-1;i>=0;i--)if(uploads[i].job.source!==options.source||(!uploads[i].job.base&&!needed.has(uploads[i].key))){uploads[i].bitmap.close();discarded++;uploads.splice(i,1)}
      if(options.retryToken!==retryToken){retryToken=options.retryToken;for(const backoff of prefetchBackoffs.values())backoff.reset();failures.clear();attempts.clear();failureReasons.clear();checkedLocal.clear();if(options.source==='eox'&&base.error)loadBundled(base)}
      if(base.mesh)show();update();prune();pump()
    }
    function checkStopped(){
      stopTimer=undefined;if(disposed||!isWindowActive())return
      const remaining=200-(performance.now()-lastMove)
      if(remaining>0){stopTimer=window.setTimeout(checkStopped,remaining);return}
      if(settledPending){settledPending=false;select()}
    }
    function scheduleStop(){if(stopTimer===undefined)stopTimer=window.setTimeout(checkStopped,200)}
    tick.current=()=>{
      if(!isWindowActive())return
      const now=performance.now(),moved=lastCamera.distanceToSquared(camera.position)>1e-10||1-Math.abs(lastDirection.dot(camera.quaternion))>1e-10||1-Math.abs(lastEarth.dot(group.parent!.quaternion))>1e-10
      if(moved){
        settledPending=true;scheduleStop()
        group.updateWorldMatrix(true,false)
        const local=camera.position.clone().applyMatrix4(group.parent!.matrixWorld.clone().invert()).normalize()
        motionSpeed=motion.observe(local,camera.position.length(),now)
        lastMove=now;lastCamera.copy(camera.position);lastDirection.copy(camera.quaternion);lastEarth.copy(group.parent!.quaternion)}
      if(!moved)motionSpeed=motion.decay(now)
      if(lastSelect===0||(moved&&now-lastSelect>120))select()
      else if(moved&&motionSpeed>=.02&&lastPhase==='ready')update()
      drainUploads()
    }
    refresh.current=select
    select()
    const visibility=()=>{if(!isWindowActive()){for(const c of running.values())abortWork(c)}else{lastSelect=0;traceRender('imagery.resume');invalidate()}}
    const unsubscribeActivity=subscribeActivity(visibility)
    let warningCheckAt=0,warningChecking=false
    const timer=window.setInterval(()=>{const now=performance.now();if(saveWarning&&isWindowActive()&&window.desktop?.imagery&&!warningChecking&&now-warningCheckAt>10000){warningCheckAt=now;warningChecking=true;void window.desktop.imagery.info().then(info=>{if(!disposed&&saveWarning!==info.warning){saveWarning=info.warning;update()}}).catch(()=>{}).finally(()=>{warningChecking=false})}if(isWindowActive()&&uploads.length)invalidate();if(isWindowActive()&&(active||uploads.length||[...failures].some(([key,due])=>needed.has(key)&&due<=performance.now()&&(attempts.get(key)??0)<5))){traceRender('imagery.retryOrWork');pump()}},500)
    return()=>{disposed=true;clearTimeout(statusTimer);clearTimeout(stopTimer);clearInterval(timer);unsubscribeActivity();tick.current=()=>{};refresh.current=()=>{};for(const c of running.values())abortWork(c);for(const item of uploads)item.bitmap.close();for(const a of cache.values())destroy(a);for(const b of bases.values()){if(b.mesh){group.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.map?.dispose();b.mesh.material.dispose()}b.bitmap?.close();b.canvas.width=b.canvas.height=1}}
  },[camera,gl,invalidate])
  useEffect(()=>refresh.current(),[props.source,props.highest,props.pixelRatio,props.retryToken,size.width,size.height])
  return <group ref={root}/>
}
