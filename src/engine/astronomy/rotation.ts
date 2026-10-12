import { toJulianDate } from '../time/clock.ts'

const TAU = 2 * Math.PI
// IERS TN32 §5.4.4; UTC approximates UT1, with no EOP/polar-motion correction.
export function earthRotationAngle(epochMilliseconds: number): number {
  const days = toJulianDate(epochMilliseconds) - 2451545
  const turns = 0.7790572732640 + 1.0027378119113546 * days
  return ((turns % 1) + 1) % 1 * TAU
}
