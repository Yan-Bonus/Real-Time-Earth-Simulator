import {ancestors,tileKey,type ImagerySource,type TileId} from './tiles.ts'
import {retryDelay} from './scheduling.ts'
export type FailureKind='canceled'|'timeout'|'network'|'rate-limit'|'service'|'not-found'|'http'|'invalid'
export class TileFailure extends Error {
 kind:FailureKind; retryAfter:string|null; status:number
 constructor(kind:FailureKind,status=0,retryAfter:string|null=null){super(kind);this.name='TileFailure';this.kind=kind;this.status=status;this.retryAfter=retryAfter}
}
export function classifyFailure(error:unknown):TileFailure {
 if(error instanceof TileFailure)return error
 if(error instanceof Error&&error.name==='TimeoutError')return new TileFailure('timeout')
 if(error instanceof Error&&(error.name==='AbortError'||error.message==='Aborted'))return new TileFailure('canceled')
 return new TileFailure('network')
}
export function httpFailure(status:number,retryAfter:string|null){return new TileFailure(status===429?'rate-limit':status===503?'service':status===404?'not-found':'http',status,retryAfter)}
export function failureMessage(f:TileFailure){
 const messages={canceled:'任务已取消',timeout:'影像请求超时，请检查网络后重试',network:'影像连接失败，请检查网络后重试','rate-limit':'影像服务限流（429），等待后可重试',service:'影像服务繁忙（503），等待后可重试','not-found':'影像资源不存在（404），可重试或更换影像来源',http:'影像服务返回错误（'+f.status+'），请重试',invalid:'影像内容损坏或尺寸不正确，请重试'}
 return messages[f.kind]
}
export function failureDelay(f:TileFailure,attempt:number){return retryDelay(attempt,f.retryAfter)}
export function affectsThroughput(f:TileFailure){return ['timeout','network','rate-limit','service'].includes(f.kind)}
// Only the missing next level on a currently required path blocks refinement.
// Failed lower ancestors already covered by finer textures and prefetch are irrelevant.
export function blockingFailure(targets:Iterable<{id:TileId;source:ImagerySource}>,loaded:(key:string)=>boolean,failed:(key:string)=>boolean,baseLevel=3):string|undefined {
 for(const job of targets){const key=(id:TileId)=>job.source+'/'+tileKey(id),chain=ancestors(job.id,job.source)
  if(job.id.z<=baseLevel||loaded(key(job.id)))continue
  const fallback=chain.find(id=>id.z<=baseLevel||loaded(key(id)))!.z
  const next=chain.find(id=>id.z===fallback+1)
  if(next&&failed(key(next)))return key(next)
 }
}

/** Ordinary failures back off their own tile; only service pressure pauses the shared queue. */
export function sharedRetryDelay(failure:TileFailure,delay:number){return failure.kind==='rate-limit'||failure.kind==='service'?delay:0}

export function loadingPhase(baseReady:boolean,failed:boolean,limited:boolean,complete:boolean,moving:boolean,selectionCurrent=true):'loading'|'ready'|'error'|'limited' {
 if(failed)return 'error'
 if(!baseReady||!selectionCurrent)return 'loading'
 if(limited)return 'limited'
 return complete&&!moving?'ready':'loading'
}
