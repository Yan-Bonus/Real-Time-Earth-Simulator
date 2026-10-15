import {useEffect,useRef,useState,type ReactNode} from 'react'
export default function ControlGroup({title,children,open=false,resetToken=0}:{title:string;children:ReactNode;open?:boolean;resetToken?:number}){
 const key='earth.control-group.v1.'+title
 const [expanded,setExpanded]=useState(()=>{try{const saved=localStorage.getItem(key);return saved===null?open:saved==='true'}catch{return open}})
 const lastReset=useRef(resetToken)
 useEffect(()=>{if(lastReset.current!==resetToken){lastReset.current=resetToken;setExpanded(open);try{localStorage.setItem(key,String(open))}catch{/* Optional preference. */}}},[resetToken,key,open])
 return <details className="control-group" open={expanded} onToggle={event=>{const value=event.currentTarget.open;setExpanded(value);try{localStorage.setItem(key,String(value))}catch{/* Optional preference. */}}}><summary>{title}</summary><div className="control-group-body">{children}</div></details>
}
