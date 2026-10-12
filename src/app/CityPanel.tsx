import type {City} from '../cities/catalog'
export default function CityPanel({city,onClose,onFocus}:{city:City|null;onClose:()=>void;onFocus:(city:City)=>void}){
 if(!city)return <p className="library-note">点击地球上的圆形节点，查看城市并转向该位置。</p>
 const coordinate=(v:number,pos:string,neg:string)=>`${Math.abs(v).toFixed(3)}° ${v>=0?pos:neg}`
 return <section className="city-info" data-testid="city-info" aria-label="选中城市"><div className="settings-heading"><h2>{city.localName}</h2><button type="button" className="reset-button" onClick={onClose} aria-label="取消城市选择">×</button></div><p>{city.countryLabel??city.country}</p><dl><dt>纬度</dt><dd>{coordinate(city.latitude,'N','S')}</dd><dt>经度</dt><dd>{coordinate(city.longitude,'E','W')}</dd></dl><button className="reset-button" type="button" onClick={()=>onFocus(city)}>聚焦此城市</button><p className="library-note">城市圆点是交互标记；数据：{city.source??'Natural Earth'}。</p></section>
}
