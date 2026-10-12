import data from '../data/cities.json' with {type:'json'}
export interface City {id:string;name:string;localName:string;country:string;longitude:number;latitude:number;rank:number;population:number;source?:string;referenceIds?:string[];displayName?:string;countryLabel?:string;isCapital?:boolean;adminLevel?:string;adminRole?:'capital'|'regional'|'other';adminSource?:string}
export const CITIES:readonly City[]=data as City[]
export const cityLabel=(city:City)=>city.displayName??city.localName.replace(/市$/,'')
export interface Box {left:number;top:number;right:number;bottom:number}
export interface ProjectedCity {city:City;x:number;y:number;opacity?:number;label?:{x:number;y:number}}
export interface LayoutOptions {limit?:number;spacing?:number;labels?:number;hovered?:string|null;widths?:Map<string,number>;anchors?:Map<string,number>;retained?:Set<string>}
export const intersects=(a:Box,b:Box)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top
export function cityDetail(distance:number,previous=0){if(previous===2&&distance<2.15)return 2;if(previous===1&&distance>1.85&&distance<3.15)return 1;if(previous===0&&distance>2.85)return 0;return distance<2?2:distance<3?1:0}
export function cityPresentation(detail:number,moving:boolean){return {limit:[0,24,56][detail]??0,spacing:detail===1?60:42,labels:detail===2&&!moving?8:0}}
export function arrangeCities(points:ProjectedCity[],width:number,height:number,blocked:Box[],selected:string|null,options:LayoutOptions={}){
 const radius=(p:ProjectedCity)=>Math.hypot(p.x-width/2,p.y-height/2)
 const priority=(p:ProjectedCity)=>p.city.id===selected?-100:p.city.id===options.hovered?-90:(p.city.adminRole==='capital'?-3:p.city.adminRole==='regional'?-1.5:Math.min(p.city.rank,6)*.18*Math.min(1,radius(p)/80))+radius(p)/300-(options.retained?.has(p.city.id)?.08:0)
 const sorted=[...points].sort((a,b)=>priority(a)-priority(b)||Math.hypot(a.x-width/2,a.y-height/2)-Math.hypot(b.x-width/2,b.y-height/2)||a.city.id.localeCompare(b.city.id))
 const nodes:ProjectedCity[]=[],occupied:Box[]=[...blocked];let labels=0
 for(const p of sorted){if(nodes.length>=(options.limit??96))break;const box={left:p.x-12,right:p.x+12,top:p.y-12,bottom:p.y+12}
  if(box.left<0||box.top<0||box.right>width||box.bottom>height||blocked.some(b=>intersects(box,b))||nodes.some(n=>Math.hypot(n.x-p.x,n.y-p.y)<(options.spacing??24)))continue
  nodes.push(p);occupied.push(box)
 }
 const labelNodes=[...nodes].sort((a,b)=>priority(a)-priority(b));
 for(const p of labelNodes){if(labels>=(options.labels??20)&&p.city.id!==selected&&p.city.id!==options.hovered)continue;const w=options.widths?.get(p.city.id)??cityLabel(p.city).length*13+8,h=20
  const positions=[[p.x+15,p.y-10],[p.x-w-15,p.y-10],[p.x-w/2,p.y+15],[p.x-w/2,p.y-h-15]],old=options.anchors?.get(p.city.id),order=old===undefined?[0,1,2,3]:[old,...[0,1,2,3].filter(i=>i!==old)]
  for(const i of order){const [x,y]=positions[i],b={left:x,top:y,right:x+w,bottom:y+h};if(x>=0&&y>=0&&b.right<=width&&b.bottom<=height&&!occupied.some(r=>intersects(b,r))){p.label={x:x-p.x,y:y-p.y};occupied.push(b);options.anchors?.set(p.city.id,i);labels++;break}}
 }
 return nodes
}
export function onVisibleSurface(nx:number,ny:number,nz:number,cx:number,cy:number,cz:number){return nx*cx+ny*cy+nz*cz>1.003}
