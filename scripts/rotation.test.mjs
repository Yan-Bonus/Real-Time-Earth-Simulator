import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import { earthRotationAngle } from '../src/engine/astronomy/rotation.ts'
import { surfacePoint } from '../src/imagery/tiles.ts'
const tau = 2 * Math.PI
const delta = (before, after) => ((after - before) % tau + tau) % tau

test('ERA matches IERS reference epoch and stays normalized before/after J2000', () => {
  const reference = Date.parse('2000-01-01T12:00:00Z')
  assert.ok(Math.abs(earthRotationAngle(reference) / tau - 0.7790572732640) < 1e-12)
  for (const epoch of [Date.parse('1900-01-01Z'), reference, Date.parse('2100-01-01Z')]) {
    const angle = earthRotationAngle(epoch)
    assert.ok(angle >= 0 && angle < tau)
  }
})
test('rotation uses sidereal rate and a UTC day is slightly more than one turn', () => {
  const start = Date.parse('2026-10-01T00:00:00Z')
  const advance = delta(earthRotationAngle(start), earthRotationAngle(start + 3600000))
  assert.ok(Math.abs(advance * 180 / Math.PI - 15.041067178670319) < 1e-7)
  const dayAdvance = delta(earthRotationAngle(start), earthRotationAngle(start + 86400000))
  assert.ok(Math.abs(dayAdvance * 180 / Math.PI - 0.9856122880876566) < 1e-7)
})
test('scene rotation moves eastward and camera preview resolves the same geographic position', () => {
  const axis = new Vector3(0, 1, 0)
  const prime = new Vector3(...surfacePoint(0, 0)).applyAxisAngle(axis, Math.PI / 2)
  assert.ok(prime.distanceTo(new Vector3(...surfacePoint(90, 0))) < 1e-12)
  for (const epoch of [Date.parse('2000-01-01T12:00:00Z'), Date.parse('2026-10-01T12:00:00Z')]) {
    const target = new Vector3(...surfacePoint(116, 37))
    const camera = target.clone().applyAxisAngle(axis, earthRotationAngle(epoch)).multiplyScalar(1.5)
    const local = camera.clone().applyAxisAngle(axis, -earthRotationAngle(epoch)).normalize()
    assert.ok(local.distanceTo(target) < 1e-12)
  }
})
