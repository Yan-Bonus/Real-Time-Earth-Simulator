import {traceRender} from '../engine/renderTrace'
import type { CosmicOptions } from '../scene/CosmicBackground'
import TimeControls from './TimeControls'
import ControlGroup from './ControlGroup'
import { useCallback, useEffect, useRef, useState } from 'react'
import EarthScene from '../scene/EarthScene'
import SceneBoundary from './SceneBoundary'
import ClockPanel from './ClockPanel'
import DiagnosticsPanel from './DiagnosticsPanel'
import MusicControls from './MusicControls'
import ImageryLibrary from './ImageryLibrary'
import SolarPanel from './SolarPanel'
import type { SolarOptions } from '../scene/SolarEffects'
import { SOURCES, type ImagerySource } from '../imagery/tiles'
import type { SceneDiagnostics } from '../scene/RotatingEarth'
import type { OnlineStatus } from '../scene/RegionalImagery'

import CityPanel from './CityPanel'
import {CITIES,cityLabel,type City} from '../cities/catalog'
import type {CityFocus} from '../scene/EarthScene'
export default function App() {
  useEffect(()=>traceRender('app.reactCommit'))
  const [settingsOpen,setSettingsOpen]=useState(false)
  const [observing,setObserving]=useState(()=>window.matchMedia('(max-width:800px)').matches)
  const [returnToken,setReturnToken]=useState(0),[returnAvailable,setReturnAvailable]=useState(false)
  const [cityHint,setCityHint]=useState(()=>{try{return localStorage.getItem('earth.cityHint.dismissed.v1')!=='true'}catch{return true}})
  const panelToggle=useRef<HTMLButtonElement>(null)
  useEffect(()=>{const media=window.matchMedia('(max-width:800px)'),change=()=>{if(media.matches){setObserving(true);setSettingsOpen(false)}};media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  const togglePanels=()=>{setObserving(value=>!value);setSettingsOpen(false);panelToggle.current?.focus()}
  const dismissHint=()=>{setCityHint(false);try{localStorage.setItem('earth.cityHint.dismissed.v1','true')}catch{/* Hint dismiss remains available for this session. */}}
  const viewerRef=useRef<HTMLElement>(null),footerRef=useRef<HTMLElement>(null)
  useEffect(()=>{const footer=footerRef.current;if(!footer)return;const update=()=>viewerRef.current?.style.setProperty('--viewer-footer-height',footer.getBoundingClientRect().height+'px');const observer=new ResizeObserver(update);observer.observe(footer);update();return()=>observer.disconnect()},[])
  const [cosmic,setCosmic]=useState<CosmicOptions>({stars:true,nebula:false,meteors:false})
  const [cities,setCities]=useState(true),[selectedCity,setSelectedCity]=useState<City|null>(null),[cityFocus,setCityFocus]=useState<CityFocus|null>(null)
  const onSelectCity=useCallback((city:City)=>{setSelectedCity(city);const panel=document.querySelector<HTMLDetailsElement>(".scene-tools .control-group");if(panel)panel.open=true;setCityFocus(value=>({city,token:(value?.token??0)+1}))},[])
  const [sunToken,setSunToken]=useState(0)
  const [solar,setSolar]=useState<SolarOptions>({daylight:true,atmosphere:true,terminator:false,subsolar:true,direction:false,tilt:false})
  const solarToggle=(key:keyof SolarOptions,checked:boolean)=>setSolar(value=>({...value,[key]:checked}))
  const [resetToken, setResetToken] = useState(0)
  const [regionToken, setRegionToken] = useState(0)
  const [source, setSource] = useState<ImagerySource>('eox')
  const [highest, setHighest] = useState(true)
  const [axis, setAxis] = useState(false)
  const [equator, setEquator] = useState(false)
  const [grid, setGrid] = useState(false)
  const settingsTrigger=useRef<HTMLButtonElement>(null)
  useEffect(()=>{
    if(!settingsOpen)return
    const trigger=settingsTrigger.current
    document.querySelector<HTMLButtonElement>('#viewer-settings .settings-heading button')?.focus()
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setSettingsOpen(false)}}
    window.addEventListener('keydown',escape)
    return()=>{window.removeEventListener('keydown',escape);trigger?.focus()}
  },[settingsOpen])
  const [debug, setDebug] = useState(false)
  const [diagnostics, setDiagnostics] = useState<SceneDiagnostics | null>(null)
  const [retryToken,setRetryToken]=useState(0)
  const [regionStatus,setRegionStatus]=useState<OnlineStatus>({source:'eox',phase:'loading',loaded:0,total:0,hasView:false,maxTexelRatio:0,targetDistance:3.8,message:'正在读取内置全球影像'})
  const onRegionStatus=useCallback((status:OnlineStatus)=>{if(status.source===source)setRegionStatus(status)},[source])
  return (
    <main ref={viewerRef} className="viewer" data-observing={observing}>
      <SceneBoundary>
        <EarthScene returnToken={returnToken} onReturnAvailable={setReturnAvailable} cities={cities} selectedCity={selectedCity} cityFocus={cityFocus} onSelectCity={onSelectCity} cosmic={cosmic} solar={solar} sunToken={sunToken} resetToken={resetToken} regionToken={regionToken} retryToken={retryToken} onRegionStatus={onRegionStatus} axis={axis} equator={equator} grid={grid} onDiagnostics={debug&&settingsOpen ? setDiagnostics : undefined} source={source} highest={highest} />
      </SceneBoundary>
      <div className={regionStatus.hasView?'network-state network-state-compact':'network-state network-state-startup'} data-testid="imagery-state" data-runtime={JSON.stringify(regionStatus.runtime)} data-phase={regionStatus.phase} data-source={regionStatus.source} data-has-view={regionStatus.hasView} data-target-distance={regionStatus.targetDistance} data-texel-ratio={regionStatus.maxTexelRatio} aria-live="polite" style={regionStatus.hasView?{display:'none'}:undefined}>
        <p>{regionStatus.message}</p><progress hidden={regionStatus.phase!=='loading'} aria-label="高清影像加载进度" max={Math.max(1,regionStatus.total)} value={regionStatus.loaded}/><button hidden={regionStatus.phase!=='error'} type="button" className="reset-button" onClick={()=>setRetryToken(value=>value+1)}>重新连接</button>
      </div>
      <header className="viewer-header">
        <div>
          <p className="eyebrow">REAL-TIME EARTH SIMULATOR</p>
          <h1>地球观察室</h1>
        </div>
        <div className="viewer-info"><span className="version">V0.4 · 城市探索</span><ClockPanel /><TimeControls compact={observing}/></div>
      </header>
      <button ref={panelToggle} className="panel-toggle reset-button" type="button" aria-expanded={!observing} onClick={togglePanels}>{observing?'展开面板':'收起面板'}</button>
      <aside hidden={observing} className="scene-tools" aria-label="地球控制面板">
        <ControlGroup title="城市探索"><label><input type="checkbox" checked={cities} onChange={e=>setCities(e.target.checked)}/>城市节点</label><p className="library-note">{CITIES.length} 个城市 · 按视角显示</p>{cityHint&&<div className="city-help"><p>放大显示圆点，继续放大显示名称；指向查看名称，点击聚焦城市。</p><button type="button" className="hint-dismiss" onClick={dismissHint}>不再提示</button></div>}<CityPanel city={selectedCity} onClose={()=>{setSelectedCity(null);setCityFocus(null)}} onFocus={onSelectCity}/></ControlGroup>
        <ControlGroup title="时间探索"><TimeControls exploration/></ControlGroup>
        <ControlGroup title="显示图层">
          <p className="tools-heading">地球参考线</p>
          <label><input type="checkbox" checked={axis} onChange={event=>setAxis(event.target.checked)}/>自转轴</label>
          <label><input type="checkbox" checked={equator} onChange={event=>setEquator(event.target.checked)}/>赤道</label>
          <label><input type="checkbox" checked={grid} onChange={event=>setGrid(event.target.checked)}/>经纬网（30°）</label>
          <p className="tools-heading">太阳与昼夜</p>
          {([['daylight','昼夜明暗'],['atmosphere','大气辉光'],['terminator','晨昏线'],['subsolar','太阳直射点'],['direction','太阳方向'],['tilt','地轴倾角']] as const).map(([key,label])=>
            <label key={key}><input type="checkbox" checked={solar[key]} onChange={event=>solarToggle(key,event.target.checked)}/>{label}</label>)}
          <SolarPanel/>
        </ControlGroup>
        <ControlGroup title="宇宙背景">
          {([['stars','星空'],['nebula','星云'],['meteors','流星']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={cosmic[key]} onChange={event=>setCosmic(value=>({...value,[key]:event.target.checked}))}/>{label}</label>)}
          <p className="library-note cosmic-note">装饰性背景，非真实星表；可独立关闭。</p>
        </ControlGroup>
        <ControlGroup title="音乐"><MusicControls/></ControlGroup>
        <button ref={settingsTrigger} className="settings-trigger" type="button" aria-expanded={settingsOpen} aria-controls="viewer-settings" onClick={()=>setSettingsOpen(value=>!value)}>设置</button>
      </aside>
      {settingsOpen&&!observing&&<aside id="viewer-settings" className="settings-panel" aria-label="设置面板">
        <div className="settings-heading"><h2>设置</h2><button className="reset-button" type="button" onClick={()=>setSettingsOpen(false)}>关闭设置</button></div>
        <label className="source-picker">联网影像<select aria-label="区域影像" value={source} onChange={event=>setSource(event.target.value as ImagerySource)}>
          <option value="eox">联网高清 · EOX 2024</option><option value="nasa">联网历史 · NASA</option>
        </select></label>
        <label><input type="checkbox" checked={highest} onChange={event=>setHighest(event.target.checked)}/>最高画质</label>
        <ImageryLibrary/>
        {regionStatus.runtime&&<section className="imagery-library" aria-label="影像调度状态"><p>内存影像：{regionStatus.runtime.assets} 块 · {(regionStatus.runtime.textureBytes/1048576).toFixed(0)} MiB纹理预算</p><p>下载 {regionStatus.runtime.network} · 解码 {regionStatus.runtime.decode} · 待上传 {regionStatus.runtime.uploads}</p></section>}
        <label><input type="checkbox" checked={debug} onChange={event=>setDebug(event.target.checked)}/>调试信息</label>
        {debug&&<DiagnosticsPanel value={diagnostics}/>}
        <p className="library-note">四季与日照采用说明中的近似；地表为历史合成影像。</p>
      </aside>}
      <footer ref={footerRef} className="viewer-footer">
        <div>
          <p className="imagery-credit">{SOURCES[source].label}{source === 'eox' && <span> · © EOX · Contains modified Copernicus Sentinel data 2024 · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a> · <a href="https://cloudless.eox.at/pricing" target="_blank" rel="noreferrer">授权说明</a></span>}</p>
          {cityHint&&!observing&&<p className="city-entry-hint">放大地球探索城市 · <button type="button" className="hint-dismiss" onClick={dismissHint}>不再提示</button></p>}
          {observing&&selectedCity&&<p className="observation-selection" role="status">已选：{cityLabel(selectedCity)}</p>}
          <p className="instructions">拖动旋转视角 <span>·</span> 滚轮缩放 <span>·</span> F11 全屏</p>
          {regionStatus.saveWarning&&<p className="save-warning" role="status">{regionStatus.saveWarning}</p>}
          <div className="status-line"><p className="scene-status" role="status">{regionStatus.phase==='loading'&&regionStatus.hasView?'高清细化中':regionStatus.message}</p>{regionStatus.phase==='error'&&regionStatus.hasView&&<button className="retry-inline" type="button" onClick={()=>setRetryToken(value=>value+1)}>重新连接</button>}</div>
          <p className="region-status" data-testid="region-status" hidden={!settingsOpen}>{regionStatus.phase==='ready'?'':`${regionStatus.loaded}/${regionStatus.total} 块影像`}{regionStatus.phase==='ready'?' · 当前视角加载完成':''}</p>
        </div>
        <div className="viewer-actions">
          {returnAvailable&&<button className="reset-button" type="button" onClick={()=>{setSelectedCity(null);setReturnToken(value=>value+1)}}>返回上一视角</button>}
          <button className="reset-button" type="button" onClick={()=>setSunToken(value=>value+1)}>日照视角</button>
          <button className="reset-button" type="button" onClick={() => setRegionToken((value) => value + 1)}>区域预览</button>
          <button className="reset-button" type="button" onClick={() => setResetToken((value) => value + 1)}>重置视角</button>
        </div>
      </footer>
    </main>
  )
}
