import {traceRender} from './renderTrace'
// Combine Chromium page visibility with Electron native hide/minimize state.
let nativeActive=true
const listeners=new Set<()=>void>()
export const isWindowActive=()=>nativeActive&&!document.hidden
export const subscribeActivity=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}}
const notify=()=>{for(const listener of listeners)listener()}
window.desktop?.onActivity?.(active=>{traceRender(active?'window.active':'window.inactive');if(nativeActive===active)return;nativeActive=active;notify()})
document.addEventListener('visibilitychange',()=>{traceRender(document.hidden?'window.documentHidden':'window.documentVisible');notify()})
