import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, session, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { ImageryStore } from './imagery-store.js'

const devUrl = !app.isPackaged && process.env.EARTH_DEV_URL
const localEntry = fileURLToPath(new URL('../dist/index.html', import.meta.url))

async function createWindow() {
  const window = new BrowserWindow({
    title: 'Real-Time Earth Simulator',
    width: 1100,
    height: 800,
    minWidth: 720,
    minHeight: 640,
    backgroundColor: '#0b1220',
    show: false,
    frame: true,
    fullscreen: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  const activity=()=>window.webContents.send('window:activity',window.isVisible()&&!window.isMinimized())
  window.on('show',activity);window.on('hide',activity)
  window.on('minimize',activity);window.on('restore',activity)
  window.webContents.on('did-finish-load',activity)
  window.setMenuBarVisibility(false)
  window.once('ready-to-show', () => {
    window.maximize()
    window.show()
  })
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return
    if (input.key === 'F11') {
      event.preventDefault()
      window.setFullScreen(!window.isFullScreen())
    } else if (input.key === 'Escape' && window.isFullScreen()) {
      event.preventDefault()
      void window.webContents.executeJavaScript('(()=>{const button=document.querySelector("#viewer-settings .settings-heading button");if(button){button.click();return true}return !window.dispatchEvent(new Event("earth:cancel-flight",{cancelable:true}))})()').then(closed=>{if(!closed)window.setFullScreen(false)}).catch(()=>window.setFullScreen(false))
    }
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (['https://cloudless.eox.at/pricing', 'https://creativecommons.org/licenses/by-nc-sa/4.0/'].includes(url)) {
      void shell.openExternal(url).catch(error => console.error('无法打开影像授权说明', error))
    }
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  if (devUrl) {
    const url = new URL(devUrl)
    if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:') {
      throw new Error('开发入口必须是本机 127.0.0.1 HTTP 地址')
    }
    await window.loadURL(url.href)
  } else {
    await window.loadFile(localEntry)
  }
}

function reportStartupError(error: unknown) {
  console.error(error)
  dialog.showErrorBox('Real-Time Earth Simulator 启动失败', String(error))
  app.exit(1)
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark'
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; script-src 'self'${devUrl ? " 'unsafe-inline'" : ''}; style-src 'self'${devUrl ? " 'unsafe-inline'" : ''}; img-src 'self' data: blob:; connect-src 'self' https://gibs.earthdata.nasa.gov https://tiles.maps.eox.at${devUrl ? ' ws://127.0.0.1:*' : ''}; object-src 'none'; base-uri 'none'`,
        ],
      },
    })
  })
  Menu.setApplicationMenu(process.platform === 'darwin'
    ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }])
    : null)
  const profile=process.argv.find(arg=>arg.startsWith('--user-data-dir='))
  const imageryDirectory=profile?join(resolve(profile.slice('--user-data-dir='.length)),'imagery'):process.platform==='win32'?join('D:/RealTimeEarthSimulatorData','imagery'):join(app.getPath('userData'),'imagery')
  const store=new ImageryStore(imageryDirectory)
  let flushed=false
  app.on('before-quit',event=>{
    if(flushed)return
    event.preventDefault()
    void Promise.race([store.flush(),new Promise<void>(resolve=>setTimeout(resolve,5000))]).finally(()=>{flushed=true;app.quit()})
  })
  const trusted=(event:Electron.IpcMainInvokeEvent)=>{if(!BrowserWindow.fromWebContents(event.sender)||event.senderFrame!==event.sender.mainFrame)throw Error('Invalid imagery client')}
  ipcMain.handle('window:activity-state',event=>{trusted(event);const window=BrowserWindow.fromWebContents(event.sender);return !!window&&window.isVisible()&&!window.isMinimized()})
  ipcMain.handle('imagery:read',(event,input:unknown)=>{trusted(event);return store.read(input)})
  ipcMain.handle('imagery:assemble',(event,input:unknown)=>{trusted(event);return store.canAssemble(input)})
  ipcMain.handle('imagery:save',(event,input:unknown,bytes:Uint8Array)=>{trusted(event);if(!(bytes instanceof Uint8Array)||bytes.byteLength>2097152)throw Error('Invalid image bytes');const image=nativeImage.createFromBuffer(Buffer.from(bytes));const size=image.getSize();const expected=(input as {source?:string})?.source==='eox'?256:512;if(image.isEmpty()||size.width!==expected||size.height!==expected)throw Error('Invalid decoded image');return store.save(input,bytes)})
  ipcMain.handle('imagery:activity',event=>{trusted(event);return store.activity})
  ipcMain.handle('imagery:info',event=>{trusted(event);return store.info()})
  ipcMain.handle('imagery:open',async event=>{trusted(event);const {mkdir}=await import('node:fs/promises');await mkdir(imageryDirectory,{recursive:true});return shell.openPath(imageryDirectory)})
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow().catch(reportStartupError)
  })
}).catch(reportStartupError)

app.on('window-all-closed', () => {
  app.quit()
})
