import { useState, useSyncExternalStore } from 'react'
import { SEASONS, parseUTCDate, seasonalDate } from '../engine/time/exploration'
import { simulationClock } from '../engine/time/simulation'
import useSimulationTime from './useSimulationTime'
export default function TimeControls({exploration=false,compact=false}:{exploration?:boolean;compact?:boolean}) {
 useSyncExternalStore(simulationClock.subscribe,()=>`${simulationClock.rate}/${simulationClock.resumeRate}/${simulationClock.isRealTime}`)
 const rate=simulationClock.rate,real=simulationClock.isRealTime
 const [date,setDate]=useState(()=>new Date(simulationClock.now()).toISOString().slice(0,19)),[year,setYear]=useState(()=>String(new Date(simulationClock.now()).getUTCFullYear())),[error,setError]=useState('')
 const fillCurrent=()=>{const now=simulationClock.now();setDate(new Date(now).toISOString().slice(0,19));setYear(String(new Date(now).getUTCFullYear()));setError('')}
 const applyDate=(time:number)=>{simulationClock.pause();simulationClock.setDate(time);setDate(new Date(time).toISOString().slice(0,19));setYear(String(new Date(time).getUTCFullYear()));setError('')}
 const attempt=(action:()=>number)=>{try{applyDate(action())}catch(error){setError(error instanceof Error?error.message:'日期无效')}}
 const playback=rate===0?simulationClock.resumeRate:rate,direction=playback<0?-1:1
 if(!exploration)return <section className={compact?'time-toolbar time-toolbar-compact':'time-toolbar'} aria-label="时间播放控制" data-testid="time-controls" data-rate={rate} data-real={real}>
  {compact&&<CompactClock label={rate===0?'已暂停':real?'真实时间':'模拟时间'} rate={rate}/>}
  <div className="time-toolbar-row"><button className="reset-button pause-button" type="button" onClick={()=>rate===0?simulationClock.resume():simulationClock.pause()}>{rate===0?'继续播放':'暂停时间'}</button><label><span>方向</span><select aria-label="时间方向" value={direction<0?'reverse':'forward'} onChange={event=>simulationClock.setPlaybackRate((event.target.value==='reverse'?-1:1)*Math.abs(playback))}><option value="forward">正放</option><option value="reverse">倒放</option></select></label><label><span>倍率</span><select aria-label="模拟速度" value={Math.abs(playback)} onChange={event=>simulationClock.setPlaybackRate(direction*Number(event.target.value))}>{[1,60,3600].map(value=><option key={value} value={value}>{value}×</option>)}</select></label></div>
  <button className="reset-button now-button" type="button" onClick={()=>simulationClock.reset()}>返回当前时间</button>
  {!compact&&<p className="library-note">{real?'实时同步系统时钟':rate===0?`已暂停 · 继续后${direction<0?'倒放':'正放'} ${Math.abs(playback)}×`:`模拟播放 · ${direction<0?'倒放':'正放'} ${Math.abs(rate)}×`}</p>}
 </section>
 return <section className="time-controls" aria-label="日期与四季探索" data-testid="time-exploration"><form noValidate onSubmit={event=>{event.preventDefault();attempt(()=>parseUTCDate(date))}}><label className="date-field">探索日期草稿 · UTC<input aria-label="探索日期 UTC" type="datetime-local" step="1" min="1900-01-01T00:00:00" max="2100-12-31T23:59:59" value={date} onChange={event=>{setDate(event.target.value);setError('')}} required/></label><div className="date-actions"><button className="reset-button" type="submit">跳转日期</button><button className="reset-button" type="button" onClick={fillCurrent}>使用当前模拟时间</button></div></form><label className="date-field">四季场景年份<input aria-label="四季场景年份" type="number" min="1900" max="2100" step="1" value={year} onChange={event=>setYear(event.target.value)}/></label><div className="season-buttons">{SEASONS.map((season,index)=><button className="reset-button" type="button" key={season.label} onClick={()=>attempt(()=>seasonalDate(Number(year),index))}>{season.label}</button>)}</div><p className="library-note">UTC 1900–2100；跳转后暂停。四季采用该年 3/20、6/21、9/22、12/21 的 12:00 UTC 近似日期，非精确节气时刻。到达日期范围边界自动暂停。</p>{error&&<p className="date-error" role="alert">{error}</p>}<p className="library-note">仅改变地球与日照时间；地表仍为历史影像，音乐正常播放。</p></section>
}

function CompactClock({label,rate}:{label:string;rate:number}){
 const epoch=useSimulationTime()
 return <p className="compact-time-state" data-testid="compact-clock" data-epoch={epoch}><span>{label}</span><time dateTime={new Date(epoch).toISOString()}>{new Date(epoch).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:Math.abs(rate)>=3600?undefined:'2-digit',hour12:false})}</time></p>
}
