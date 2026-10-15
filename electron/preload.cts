import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktop', Object.freeze({
  platform: process.platform,
  exitFullscreen: ()=>ipcRenderer.invoke('window:exit-fullscreen'),
  windowDiagnostics: ()=>ipcRenderer.invoke('window:diagnostics'),
  onActivity: (listener:(active:boolean)=>void)=>{
    let revision=0,disposed=false
    const handler=(_event:Electron.IpcRendererEvent,active:boolean)=>{revision++;listener(active)}
    const refresh=()=>{const current=revision;void ipcRenderer.invoke('window:activity-state').then(active=>{if(!disposed&&current===revision)listener(Boolean(active))}).catch(()=>{})}
    ipcRenderer.on('window:activity',handler);document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);refresh()
    return()=>{disposed=true;ipcRenderer.removeListener('window:activity',handler);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh)}
  },
  imagery: Object.freeze({
    read: (tile:unknown)=>ipcRenderer.invoke('imagery:read',tile),
    canAssemble: (tile:unknown)=>ipcRenderer.invoke('imagery:assemble',tile),
    save: (tile:unknown,bytes:Uint8Array)=>ipcRenderer.invoke('imagery:save',tile,bytes),
    info: ()=>ipcRenderer.invoke('imagery:info'),
    activity: ()=>ipcRenderer.invoke('imagery:activity'),
    open: ()=>ipcRenderer.invoke('imagery:open'),
  }),
}))
