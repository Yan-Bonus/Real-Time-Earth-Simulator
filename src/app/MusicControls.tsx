import { useEffect, useRef, useState } from 'react'
import { backgroundMusicSource } from './backgroundMusic'

const STORAGE_KEY='earth.music.preferences.v1'
interface Preferences { enabled:boolean; volume:number }
function readPreferences():Preferences {
  try {
    const value=JSON.parse(localStorage.getItem(STORAGE_KEY)??'null')
    return {enabled:typeof value?.enabled==='boolean'?value.enabled:true,volume:typeof value?.volume==='number'&&Number.isFinite(value.volume)?Math.min(100,Math.max(0,value.volume)):20}
  }catch{return {enabled:true,volume:20}}
}
export default function MusicControls({source=backgroundMusicSource}:{source?:string|null}) {
  const audio=useRef<HTMLAudioElement>(null)
  const [preferences,setPreferences]=useState(readPreferences)
  const [status,setStatus]=useState<'idle'|'playing'|'error'>('idle')
  useEffect(()=>{
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(preferences))}catch{/* Playback does not depend on storage availability. */}
  },[preferences])
  useEffect(()=>{if(audio.current)audio.current.volume=preferences.volume/100},[preferences.volume,source])
  useEffect(()=>{
    const player=audio.current
    if(!player||!source)return
    let active=true
    if(preferences.enabled){
      void player.play().catch(error=>{if(active&&error.name!=='AbortError')setStatus('error')})
    }else player.pause()
    return ()=>{active=false;player.pause()}
  },[preferences.enabled,source])
  const enabled=!!source&&preferences.enabled
  return <section className="music-controls" aria-label="背景音乐">
    <p className="tools-heading">背景音乐</p>
    <label><input type="checkbox" aria-label="播放背景音乐" checked={enabled} disabled={!source} onChange={event=>{setStatus('idle');setPreferences(value=>({...value,enabled:event.target.checked}))}}/>循环播放</label>
    <label className="music-volume-label" htmlFor="music-volume">音量<output htmlFor="music-volume">{preferences.volume}%</output></label>
    <input id="music-volume" className="music-volume" type="range" aria-label="背景音乐音量" min="0" max="100" step="1" value={preferences.volume} onChange={event=>setPreferences(value=>({...value,volume:Number(event.target.value)}))}/>
    <p className="music-status" role="status">{!source?'等待音乐文件':status==='error'?'音乐暂时无法播放，请重新开启':!enabled?'已关闭':status==='playing'?(preferences.volume===0?'已静音':'正在循环播放'):'准备播放…'}</p>
    {source&&<audio ref={audio} src={source} loop preload="auto" data-testid="background-audio" onPlaying={()=>setStatus('playing')} onError={()=>setStatus('error')}/>}
  </section>
}
