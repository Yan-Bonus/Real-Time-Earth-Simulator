import useSimulationTime from './useSimulationTime'
import { simulationClock } from '../engine/time/simulation'
import { timeSnapshot } from '../engine/time/clock'
import { localZoneName, readableDate, worldTimeDifference } from './clockLabels'

export default function ClockPanel() {
  const snapshot = timeSnapshot(useSimulationTime())
  const minuteReadout=Math.abs(simulationClock.rate)>=3600
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const localDescription = `当前显示时间；时区：${zone}（${snapshot.offsetLabel}）。`
  const worldDescription = 'UTC（协调世界时），用于统一全球时间，也将作为地球自转计算的统一时间基准。'
  const difference = worldTimeDifference(snapshot.offsetMinutes)
  return (
    <section className="clock-panel" aria-label="本地时间与世界标准时间" data-testid="clock-panel" data-epoch={snapshot.epochMilliseconds}>
      <div className="clock-block clock-local" title={localDescription} tabIndex={0} aria-description={localDescription}>
        <div className="clock-row">
          <span className="clock-label">{simulationClock.isRealTime ? '本地时间' : '模拟时间'}</span>
          <time dateTime={snapshot.iso} data-testid="local-clock">{minuteReadout?snapshot.localTime.slice(0,5):snapshot.localTime}</time>
        </div>
        <p className="clock-detail">{simulationClock.isRealTime ? '真实时间 · ' : simulationClock.rate === 0 ? '已暂停 · ' : `${simulationClock.rate < 0 ? '倒放' : '正向'} ${Math.abs(simulationClock.rate)}× · `}{readableDate(snapshot.localDate)} · {localZoneName(snapshot.epochMilliseconds, zone)}</p>
      </div>
      <div className="clock-block clock-world" title={worldDescription} tabIndex={0} aria-description={worldDescription}>
        <div className="clock-row">
          <span className="clock-label">{simulationClock.isRealTime ? '世界标准时间' : '模拟世界时间'}</span>
          <time dateTime={snapshot.iso} data-testid="utc-clock">{minuteReadout?snapshot.utcTime.slice(0,5):snapshot.utcTime}</time>
        </div>
        <p className="clock-detail">UTC{minuteReadout?' · 按分钟显示':''} · {snapshot.utcDate !== snapshot.localDate ? `${readableDate(snapshot.utcDate)} · ` : ''}{difference}</p>
      </div>
    </section>
  )
}
