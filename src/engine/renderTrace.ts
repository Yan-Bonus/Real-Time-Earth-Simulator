/** Optional test observer; absent in normal desktop execution. */
export function traceRender(reason:string){
 const observer=(window as Window&{__earthRenderTrace?:(reason:string,time:number)=>void}).__earthRenderTrace
 observer?.(reason,performance.now())
}
