import useSimulationTime from './useSimulationTime'
import { solarPosition } from '../engine/astronomy/solar'
export default function SolarPanel() {
  const sun = solarPosition(useSimulationTime())
  const coordinate=(value:number,positive:string,negative:string)=>`${Math.abs(value).toFixed(2)}°${value>=0?positive:negative}`
  return <section className="solar-panel" data-testid="solar-state" data-epoch={sun.epoch} data-latitude={sun.latitude} data-longitude={sun.longitude} data-obliquity={sun.obliquity}>
    <p className="tools-heading">太阳直射位置</p>
    <p>{coordinate(sun.latitude,'N','S')} · {coordinate(sun.longitude,'E','W')}</p>
    <p className="library-note">地轴倾角 {sun.obliquity.toFixed(2)}° · 相对公转平面法线</p>
    <p className="library-note">天文近似 · 几何晨昏线 · 夜面适度提亮</p>
  </section>
}
