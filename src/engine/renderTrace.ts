/** Bounded, timer-free counters for correlating native activity and render wakeups. */
const counts:Record<string,number>={},samples:{at:number;counts:Record<string,number>}[]=[]
let lastSample=-Infinity
export const readRenderTrace=()=>({timeOrigin:performance.timeOrigin,now:performance.now(),counts:{...counts},samples:[...samples]})
export function traceRender(reason:string){
 const now=performance.now();counts[reason]=(counts[reason]??0)+1
 if(now-lastSample>=500){lastSample=now;if(samples.length>=120)samples.shift();samples.push({at:now,counts:{...counts}})}
 const observer=(window as Window&{__earthRenderTrace?:(reason:string,time:number)=>void}).__earthRenderTrace
 observer?.(reason,now)
}

Object.defineProperty(window,'__earthReadRenderTrace',{value:readRenderTrace,configurable:true})
