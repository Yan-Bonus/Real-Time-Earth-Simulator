import {traceRender} from '../engine/renderTrace'
import type {CosmicOptions} from '../scene/CosmicBackground'
import TimeControls from './TimeControls'
import ControlGroup from './ControlGroup'
import {useCallback,useEffect,useRef,useState} from 'react'
import EarthScene from '../scene/EarthScene'
import SceneBoundary from './SceneBoundary'
import ClockPanel from './ClockPanel'
import DiagnosticsPanel from './DiagnosticsPanel'
import MusicControls from './MusicControls'
import ImageryLibrary from './ImageryLibrary'
import SolarPanel from './SolarPanel'
import type {SolarOptions} from '../scene/SolarEffects'
import {SOURCES,type ImagerySource} from '../imagery/tiles'
import type {SceneDiagnostics} from '../scene/RotatingEarth'
import type {OnlineStatus} from '../scene/RegionalImagery'
import CityPanel from './CityPanel'
import {CITIES,type City} from '../cities/catalog'
import type {CityFocus} from '../scene/EarthScene'
import {DEFAULT_DISPLAY,readDisplayPreferences,saveDisplayPreferences} from './displayPreferences'
export default function App(){
 useEffect(()=>traceRender('app.reactCommit'))
 const [initial]=useState(readDisplayPreferences),[narrow,setNarrow]=useState(()=>window.matchMedia('(max-width:800px)').matches)
 const [settingsOpen,setSettingsOpen]=useState(false),[observing,setObserving]=useState(()=>window.matchMedia('(max-width:800px)').matches||initial.observing),[displayReset,setDisplayReset]=useState(0)
 const [returnToken,setReturnToken]=useState(0),[returnAvailable,setReturnAvailable]=useState(false)
 const [cityHint,setCityHint]=useState(()=>{try{return localStorage.getItem('earth.cityHint.dismissed.v1')!=='true'}catch{return true}})
 const panelToggle=useRef<HTMLButtonElement>(null),settingsTrigger=useRef<HTMLButtonElement>(null)
 useEffect(()=>{const media=window.matchMedia('(max-width:800px)'),change=()=>{setNarrow(media.matches);if(media.matches){setObserving(true);setSettingsOpen(false)}};media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
 const togglePanels=()=>{setObserving(value=>!value);setSettingsOpen(false);panelToggle.current?.focus()}
 const dismissHint=()=>{setCityHint(false);try{localStorage.setItem('earth.cityHint.dismissed.v1','true')}catch{/* Optional preference. */}}
 const viewerRef=useRef<HTMLElement>(null),footerRef=useRef<HTMLElement>(null),headerRef=useRef<HTMLElement>(null)
 useEffect(()=>{const update=()=>{if(footerRef.current)viewerRef.current?.style.setProperty('--viewer-footer-height',footerRef.current.getBoundingClientRect().height+'px');if(headerRef.current)viewerRef.current?.style.setProperty('--viewer-header-height',headerRef.current.getBoundingClientRect().height+'px')};const observer=new ResizeObserver(update);if(footerRef.current)observer.observe(footerRef.current);if(headerRef.current)observer.observe(headerRef.current);update();return()=>observer.disconnect()},[])
 const [cosmic,setCosmic]=useState<CosmicOptions>(initial.cosmic),[solar,setSolar]=useState<SolarOptions>(initial.solar)
 const [cities,setCities]=useState(initial.cities),[axis,setAxis]=useState(initial.axis),[equator,setEquator]=useState(initial.equator),[grid,setGrid]=useState(initial.grid)
 useEffect(()=>saveDisplayPreferences({cities,axis,equator,grid,cosmic,solar,observing}),[cities,axis,equator,grid,cosmic,solar,observing])
 const restoreDisplay=()=>{setCities(DEFAULT_DISPLAY.cities);setAxis(DEFAULT_DISPLAY.axis);setEquator(DEFAULT_DISPLAY.equator);setGrid(DEFAULT_DISPLAY.grid);setCosmic({...DEFAULT_DISPLAY.cosmic});setSolar({...DEFAULT_DISPLAY.solar});setDisplayReset(value=>value+1);if(narrow){setObserving(true);setSettingsOpen(false)}else setObserving(false)}
 const [selectedCity,setSelectedCity]=useState<City|null>(null),[cityFocus,setCityFocus]=useState<CityFocus|null>(null)
 const onSelectCity=useCallback((city:City)=>{setCityFocus(null);setSelectedCity(city);if(!observing){const panel=document.querySelector<HTMLDetailsElement>('.scene-tools .control-group');if(panel)panel.open=true}},[observing])
 const onFocusCity=useCallback((city:City)=>{setSelectedCity(city);setCityFocus(value=>({city,token:(value?.token??0)+1}))},[])
 const closeCity=useCallback(()=>{const id=selectedCity?.id;setSelectedCity(null);setCityFocus(null);requestAnimationFrame(()=>{const node=id?document.querySelector<HTMLButtonElement>('[data-city-id="'+id+'"]'):null;if(node?.checkVisibility())node.focus({preventScroll:true});else{const summary=document.querySelector<HTMLElement>('.scene-tools summary');(observing?panelToggle.current:summary)?.focus({preventScroll:true})}})},[selectedCity,observing])
 const [sunToken,setSunToken]=useState(0),[resetToken,setResetToken]=useState(0),[regionToken,setRegionToken]=useState(0)
 // Source and highest quality start from the bundled EOX globe on every launch.
 const [source,setSource]=useState<ImagerySource>('eox'),[highest,setHighest]=useState(true),[debug,setDebug]=useState(false)
 const [diagnostics,setDiagnostics]=useState<SceneDiagnostics|null>(null),[retryToken,setRetryToken]=useState(0)
 const [regionStatus,setRegionStatus]=useState<OnlineStatus>({source:'eox',phase:'loading',loaded:0,total:0,hasView:false,maxTexelRatio:0,targetDistance:3.8,message:'正在读取内置全球影像'})
 const onRegionStatus=useCallback((status:OnlineStatus)=>{if(status.source===source)setRegionStatus(status)},[source])
 useEffect(()=>{if(!settingsOpen)return;const trigger=settingsTrigger.current,fallback=panelToggle.current;document.querySelector<HTMLButtonElement>('#viewer-settings .settings-heading button')?.focus();return()=>{if(trigger?.checkVisibility())trigger.focus();else fallback?.focus()}},[settingsOpen])
 useEffect(()=>{const dismiss=(event:Event)=>{if(event.defaultPrevented)return;if(settingsOpen){setSettingsOpen(false);event.preventDefault();return}if(!window.dispatchEvent(new Event('earth:cancel-flight',{cancelable:true}))){event.preventDefault();return}if(selectedCity){closeCity();event.preventDefault()}}
  const escape=(event:KeyboardEvent)=>{if(event.key!=='Escape'||event.defaultPrevented)return;if(document.activeElement?.matches('input,select,textarea,[contenteditable=true]'))return;dismiss(event);if(!event.defaultPrevented)void window.desktop?.exitFullscreen?.().catch(()=>{})}
  window.addEventListener('keydown',escape,true);window.addEventListener('earth:dismiss-ui',dismiss);return()=>{window.removeEventListener('keydown',escape,true);window.removeEventListener('earth:dismiss-ui',dismiss)}
 },[settingsOpen,selectedCity,closeCity])
 const displaySource=regionStatus.displayedSource??'eox',switching=regionStatus.hasView&&source!==displaySource
 const statusMessage=switching?((regionStatus.source===source&&regionStatus.phase==='error'?'切换失败':'正在切换')+' · 当前继续显示 '+(displaySource==='eox'?'EOX':'NASA')):regionStatus.phase==='loading'&&regionStatus.hasView?'高清细化中':regionStatus.message
 return <main ref={viewerRef} className="viewer" data-observing={observing} data-narrow={narrow}>
  <SceneBoundary><EarthScene returnToken={returnToken} onReturnAvailable={setReturnAvailable} cities={cities} selectedCity={selectedCity} cityFocus={cityFocus} onSelectCity={onSelectCity} onFocusCity={onFocusCity} cosmic={cosmic} solar={solar} sunToken={sunToken} resetToken={resetToken} regionToken={regionToken} retryToken={retryToken} onRegionStatus={onRegionStatus} axis={axis} equator={equator} grid={grid} onDiagnostics={debug&&settingsOpen?setDiagnostics:undefined} source={source} highest={highest}/></SceneBoundary>
  <div className="network-state network-state-startup" data-testid="imagery-state" data-runtime={JSON.stringify(regionStatus.runtime)} data-phase={regionStatus.phase} data-source={regionStatus.source} data-displayed-source={regionStatus.displayedSource} data-has-view={regionStatus.hasView} data-target-distance={regionStatus.targetDistance} data-texel-ratio={regionStatus.maxTexelRatio} aria-live="polite" style={regionStatus.hasView?{display:'none'}:undefined}><p>{regionStatus.message}</p><progress hidden={regionStatus.phase!=='loading'} aria-label="高清影像加载进度" max={Math.max(1,regionStatus.total)} value={regionStatus.loaded}/><button hidden={regionStatus.phase!=='error'} type="button" className="reset-button" onClick={()=>setRetryToken(value=>value+1)}>重新连接</button></div>
  <header ref={headerRef} className="viewer-header"><div><p className="eyebrow">REAL-TIME EARTH SIMULATOR</p><h1>地球观察室</h1></div><div className="viewer-info"><span className="version">V0.4 · 城市探索</span>{!observing&&!narrow&&<ClockPanel/>}<TimeControls compact={observing||narrow}/></div></header>
  <button ref={panelToggle} className="panel-toggle reset-button" type="button" aria-expanded={!observing} onClick={togglePanels}>{observing?'展开面板':'收起面板'}</button>
  <aside hidden={observing||(narrow&&settingsOpen)} className="scene-tools" aria-label="地球控制面板">
   <ControlGroup title="城市探索" resetToken={displayReset}><label><input type="checkbox" checked={cities} onChange={e=>setCities(e.target.checked)}/>城市节点</label><p className="library-note">{CITIES.length} 个城市 · 按视角显示</p>{cityHint&&<div className="city-help"><p>放大显示圆点与名称。单击选择，双击聚焦；方向键切换节点，Enter选择。</p><button type="button" className="hint-dismiss" onClick={dismissHint}>不再提示</button></div>}<CityPanel city={selectedCity} onClose={closeCity} onFocus={onFocusCity}/></ControlGroup>
   <ControlGroup title="时间探索" resetToken={displayReset}><TimeControls exploration/></ControlGroup>
   <ControlGroup title="显示图层" resetToken={displayReset}><p className="tools-heading">地球参考线</p><label><input type="checkbox" checked={axis} onChange={e=>setAxis(e.target.checked)}/>自转轴</label><label><input type="checkbox" checked={equator} onChange={e=>setEquator(e.target.checked)}/>赤道</label><label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/>经纬网（30°）</label><p className="tools-heading">太阳与昼夜</p>{([['daylight','昼夜明暗'],['atmosphere','大气辉光'],['terminator','晨昏线'],['subsolar','太阳直射点'],['direction','太阳方向'],['tilt','地轴倾角']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={solar[key]} onChange={e=>setSolar(value=>({...value,[key]:e.target.checked}))}/>{label}</label>)}<button className="reset-button" type="button" onClick={()=>setSunToken(value=>value+1)}>日照视角</button><SolarPanel/></ControlGroup>
   <ControlGroup title="宇宙背景" resetToken={displayReset}>{([['stars','星空'],['nebula','星云'],['meteors','流星']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={cosmic[key]} onChange={e=>setCosmic(value=>({...value,[key]:e.target.checked}))}/>{label}</label>)}<p className="library-note cosmic-note">装饰性背景，非真实星表；可独立关闭。</p></ControlGroup>
   <ControlGroup title="音乐" resetToken={displayReset}><MusicControls/></ControlGroup>
   <ControlGroup title="视角工具" resetToken={displayReset}><button className="reset-button" type="button" onClick={()=>setRegionToken(value=>value+1)}>示例近景</button><p className="library-note">固定显示116°E、37°N附近，非当前位置。</p></ControlGroup>
   <button ref={settingsTrigger} className="settings-trigger" type="button" aria-expanded={settingsOpen} aria-controls="viewer-settings" onClick={()=>setSettingsOpen(value=>!value)}>设置</button>
  </aside>
  {observing&&selectedCity&&<aside className="city-selection" aria-label="城市信息"><CityPanel compact city={selectedCity} onClose={closeCity} onFocus={onFocusCity}/></aside>}
  {settingsOpen&&!observing&&<aside id="viewer-settings" className="settings-panel" aria-label="设置面板"><div className="settings-heading"><h2>设置</h2><button className="reset-button" type="button" onClick={()=>setSettingsOpen(false)}>关闭设置</button></div><label className="source-picker">联网影像<select aria-label="区域影像" value={source} onChange={e=>setSource(e.target.value as ImagerySource)}><option value="eox">联网高清 · EOX 2024</option><option value="nasa">联网历史 · NASA</option></select></label><label><input type="checkbox" checked={highest} onChange={e=>setHighest(e.target.checked)}/>最高画质</label><ImageryLibrary/>{regionStatus.runtime&&<section className="imagery-library" aria-label="影像调度状态"><p>内存影像：{regionStatus.runtime.assets} 块 · {(regionStatus.runtime.textureBytes/1048576).toFixed(0)} MiB纹理预算</p><p>下载 {regionStatus.runtime.network} · 解码 {regionStatus.runtime.decode} · 待上传 {regionStatus.runtime.uploads}</p></section>}<label><input type="checkbox" checked={debug} onChange={e=>setDebug(e.target.checked)}/>调试信息</label>{debug&&<DiagnosticsPanel value={diagnostics}/>}<button className="reset-button" type="button" onClick={restoreDisplay}>恢复默认显示</button><p className="library-note">保存图层、宇宙、城市与面板偏好；每次启动为真实时间、EOX最高画质。恢复显示不删除影像或重置音乐。</p></aside>}
  <footer ref={footerRef} className="viewer-footer"><div><p className="imagery-credit" data-source={displaySource}>{SOURCES[displaySource].label}{displaySource==='eox'&&<span> · © EOX · Contains modified Copernicus Sentinel data 2024 · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a> · <a href="https://cloudless.eox.at/pricing" target="_blank" rel="noreferrer">授权说明</a></span>}</p>{cityHint&&!observing&&<p className="city-entry-hint">单击查看城市，双击聚焦 · <button type="button" className="hint-dismiss" onClick={dismissHint}>不再提示</button></p>}<p className="instructions">拖动旋转视角 <span>·</span> 滚轮缩放 <span>·</span> F11 全屏</p>{regionStatus.saveWarning&&<p className="save-warning" role="status">{regionStatus.saveWarning}</p>}{(switching||regionStatus.phase!=='ready')&&<div className="status-line"><p className="scene-status" role="status">{statusMessage}</p>{regionStatus.phase==='error'&&regionStatus.hasView&&<button className="retry-inline" type="button" onClick={()=>setRetryToken(value=>value+1)}>重新连接</button>}{switching&&<button className="retry-inline" type="button" onClick={()=>setSource(displaySource)}>取消切换</button>}</div>}<p className="region-status" data-testid="region-status" hidden={!settingsOpen}>{regionStatus.phase==='ready'?'当前视角加载完成':`${regionStatus.loaded}/${regionStatus.total} 块影像`}</p></div><div className="viewer-actions">{returnAvailable&&<button className="reset-button" type="button" onClick={()=>{setSelectedCity(null);setCityFocus(null);setReturnToken(value=>value+1)}}>返回上一视角</button>}<button className="reset-button" type="button" onClick={()=>setResetToken(value=>value+1)}>重置视角</button></div></footer>
 </main>
}
