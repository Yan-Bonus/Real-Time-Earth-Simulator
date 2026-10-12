export const MILLISECONDS_PER_DAY = 86_400_000
const UNIX_EPOCH_JULIAN_DATE = 2_440_587.5

export function toJulianDate(epochMilliseconds: number): number {
  return UNIX_EPOCH_JULIAN_DATE + epochMilliseconds / MILLISECONDS_PER_DAY
}

function padded(value: number): string {
  return String(value).padStart(2, '0')
}

export function timeSnapshot(epochMilliseconds: number) {
  const date = new Date(epochMilliseconds)
  const offset = -date.getTimezoneOffset()
  const offsetLabel = `UTC${offset >= 0 ? '+' : '-'}${padded(Math.floor(Math.abs(offset) / 60))}:${padded(Math.abs(offset) % 60)}`
  return {
    epochMilliseconds,
    iso: date.toISOString(),
    localDate: `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(date.getDate())}`,
    localTime: `${padded(date.getHours())}:${padded(date.getMinutes())}:${padded(date.getSeconds())}`,
    utcDate: `${date.getUTCFullYear()}-${padded(date.getUTCMonth() + 1)}-${padded(date.getUTCDate())}`,
    utcTime: `${padded(date.getUTCHours())}:${padded(date.getUTCMinutes())}:${padded(date.getUTCSeconds())}`,
    offsetLabel,
    offsetMinutes: offset,
    julianDate: toJulianDate(epochMilliseconds),
  }
}
