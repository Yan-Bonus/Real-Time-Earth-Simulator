import assert from 'node:assert/strict'
import test from 'node:test'
import { timeSnapshot, toJulianDate, MILLISECONDS_PER_DAY } from '../src/engine/time/clock.ts'

test('Julian dates match Unix epoch and J2000 noon UTC', () => {
  assert.equal(toJulianDate(0), 2440587.5)
  assert.equal(toJulianDate(Date.parse('2000-01-01T12:00:00Z')), 2451545)
  assert.equal(toJulianDate(MILLISECONDS_PER_DAY) - toJulianDate(0), 1)
})

test('UTC midnight and leap-day rollover preserve one shared instant', () => {
  const before = timeSnapshot(Date.parse('2024-02-29T23:59:59Z'))
  const after = timeSnapshot(before.epochMilliseconds + 1000)
  assert.equal(before.utcDate, '2024-02-29')
  assert.equal(before.utcTime, '23:59:59')
  assert.equal(after.utcDate, '2024-03-01')
  assert.equal(after.utcTime, '00:00:00')
  assert.equal(after.iso, '2024-03-01T00:00:00.000Z')
})

test('timezone offsets in input resolve to the same instant', () => {
  assert.deepEqual(timeSnapshot(Date.parse('2026-10-01T08:00:00+08:00')), timeSnapshot(Date.parse('2026-10-01T00:00:00Z')))
})

test('local display follows device timezone including half-hour offsets', () => {
  const original = process.env.TZ
  try {
    for (const [zone, date, time, offset] of [
      ['Asia/Shanghai', '2026-10-01', '08:00:00', 'UTC+08:00'],
      ['Asia/Kolkata', '2026-10-01', '05:30:00', 'UTC+05:30'],
      ['America/New_York', '2026-09-30', '20:00:00', 'UTC-04:00'],
    ]) {
      process.env.TZ = zone
      const result = timeSnapshot(Date.parse('2026-10-01T00:00:00Z'))
      assert.equal(result.localDate, date)
      assert.equal(result.localTime, time)
      assert.equal(result.offsetLabel, offset)
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})

// Cover user-facing differences for west/east and fractional-hour zones.
test('plain-language clock labels explain offsets and calendar dates', async () => {
  const { readableDate, worldTimeDifference, localZoneName } = await import('../src/app/clockLabels.ts')
  assert.equal(readableDate('2026-10-01'), '2026年10月1日')
  assert.equal(worldTimeDifference(480), '比本地时间慢 8 小时')
  assert.equal(worldTimeDifference(-240), '比本地时间快 4 小时')
  assert.equal(worldTimeDifference(330), '比本地时间慢 5 小时 30 分钟')
  assert.equal(worldTimeDifference(345), '比本地时间慢 5 小时 45 分钟')
  assert.equal(worldTimeDifference(0), '与本地时间一致')
  assert.equal(localZoneName(Date.parse('2026-10-01T00:00:00Z'), 'Asia/Shanghai'), '北京时间')
})
