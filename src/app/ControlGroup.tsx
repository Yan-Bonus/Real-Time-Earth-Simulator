import type { ReactNode } from 'react'
export default function ControlGroup({title,children,open=false}:{title:string;children:ReactNode;open?:boolean}) {
  return <details className="control-group" open={open}><summary>{title}</summary><div className="control-group-body">{children}</div></details>
}
