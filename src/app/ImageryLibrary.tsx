import {useEffect,useState} from 'react'
export default function ImageryLibrary(){
 const [info,setInfo]=useState<ImageryLibraryInfo|null>(null),[error,setError]=useState('')
 useEffect(()=>{let alive=true;const poll=()=>{void window.desktop?.imagery?.info().then(value=>{if(alive)setInfo(value)}).catch(()=>{if(alive)setError('影像库状态暂不可用')})};poll();const timer=setInterval(poll,15000);return()=>{alive=false;clearInterval(timer)}},[])
 if(!window.desktop?.imagery)return null
 return <section className="imagery-library" aria-label="永久影像库"><p className="tools-heading">已保存影像</p><p>{info?info.tiles+' 块 · '+(info.bytes/1048576).toFixed(1)+' MB':'正在读取资源信息'}</p><p>长期保存 · 不自动删除</p><button type="button" className="reset-button" onClick={()=>{void window.desktop?.imagery?.open().then(value=>setError(value?'无法打开影像文件夹':'')).catch(()=>setError('无法打开影像文件夹'))}}>打开影像文件夹</button>{(info?.warning||error)&&<p role="status">{info?.warning||error}</p>}</section>
}
