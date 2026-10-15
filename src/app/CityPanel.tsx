import type {City} from '../cities/catalog'
export default function CityPanel({city,onClose,onFocus,compact=false}:{city:City|null;onClose:()=>void;onFocus:(city:City)=>void;compact?:boolean}){
 if(!city)return <p className="library-note">单击圆点查看城市，双击或点击“聚焦”转向该位置。</p>
 const coordinate=(v:number,pos:string,neg:string)=>`${Math.abs(v).toFixed(3)}° ${v>=0?pos:neg}`
 return <section className={'city-info'+(compact?' city-info-compact':'')} data-testid="city-info" aria-label="选中城市"><div className="settings-heading"><h2>{city.localName}</h2><button type="button" className="reset-button" onClick={onClose} aria-label="取消城市选择">×</button></div><p>{city.countryLabel??city.country}</p>{!compact&&<><dl><dt>纬度</dt><dd>{coordinate(city.latitude,'N','S')}</dd><dt>经度</dt><dd>{coordinate(city.longitude,'E','W')}</dd></dl><p className="library-note">{city.adminRole==='capital'?'首都 · 双圆':city.adminRole==='regional'?'区域行政中心 · 空心圆':'普通城市 · 实心圆'}</p></>}<button className="reset-button" type="button" onClick={()=>onFocus(city)}>聚焦此城市</button>{!compact&&<p className="library-note">数据：{city.source??'Natural Earth'}。</p>}</section>
}
