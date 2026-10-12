export function readableDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

export function worldTimeDifference(offsetMinutes: number): string {
  if (offsetMinutes === 0) return '与本地时间一致'
  const minutes = Math.abs(offsetMinutes)
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  const duration = [hours ? `${hours} 小时` : '', remainder ? `${remainder} 分钟` : ''].filter(Boolean).join(' ')
  return `比本地时间${offsetMinutes > 0 ? '慢' : '快'} ${duration}`
}

export function localZoneName(epochMilliseconds: number, zone: string): string {
  if (['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Harbin'].includes(zone)) return '北京时间'
  const label = new Intl.DateTimeFormat('zh-CN', { timeZone: zone, timeZoneName: 'long' })
    .formatToParts(epochMilliseconds).find((part) => part.type === 'timeZoneName')?.value
  return label && !/GMT|UTC/.test(label) ? label : '系统本地时区'
}
