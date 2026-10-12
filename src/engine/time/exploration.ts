import { MIN_EPOCH, MAX_EPOCH } from './simulation.ts'
export const SEASONS = [
  { label: '春分', month: 3, day: 20 }, { label: '夏至', month: 6, day: 21 },
  { label: '秋分', month: 9, day: 22 }, { label: '冬至', month: 12, day: 21 },
] as const
export function parseUTCDate(input: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(input)) throw new RangeError('请输入完整的 UTC 日期和时间。')
  const full = input.length === 16 ? input + ':00' : input
  const epoch = Date.parse(full + 'Z')
  if (!Number.isFinite(epoch) || epoch < MIN_EPOCH || epoch > MAX_EPOCH) throw new RangeError('支持 1900 年至 2100 年的 UTC 日期。')
  if (new Date(epoch).toISOString().slice(0,19) !== full) throw new RangeError('日期或时间无效，请检查月份、天数与时分秒。')
  return epoch
}
export function seasonalDate(year: number, index: number): number {
  if (!Number.isInteger(year) || year < 1900 || year > 2100 || !SEASONS[index]) throw new RangeError('四季场景年份须为 1900–2100。')
  const {month, day} = SEASONS[index]
  return Date.UTC(year, month - 1, day, 12)
}
