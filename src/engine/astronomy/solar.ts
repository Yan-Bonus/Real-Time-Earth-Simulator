import { toJulianDate } from '../time/clock.ts'

const RAD = Math.PI / 180
const normalize = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180
/** NOAA/Meeus low-precision apparent Sun. UTC approximates UT1/TT;
 * geometric illumination excludes refraction, terrain and the finite solar disc.
 * Intended for current-era visualization, not precision ephemerides. */
export function solarPosition(epoch: number) {
  if (!Number.isFinite(epoch)) throw new RangeError('Invalid solar epoch')
  const jd = toJulianDate(epoch), t = (jd - 2451545) / 36525
  const meanLongitude = normalize(280.46646 + t * (36000.76983 + 0.0003032 * t)) * RAD
  const anomaly = normalize(357.52911 + t * (35999.05029 - 0.0001537 * t)) * RAD
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
  const center = Math.sin(anomaly) * (1.914602 - t * (0.004817 + 0.000014 * t))
    + Math.sin(2 * anomaly) * (0.019993 - 0.000101 * t) + Math.sin(3 * anomaly) * 0.000289
  const omega = (125.04 - 1934.136 * t) * RAD
  const apparentLongitude = meanLongitude + (center - 0.00569 - 0.00478 * Math.sin(omega)) * RAD
  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
  const obliquity = meanObliquity + 0.00256 * Math.cos(omega)
  const latitude = Math.asin(Math.sin(obliquity * RAD) * Math.sin(apparentLongitude)) / RAD
  const y = Math.tan(obliquity * RAD / 2) ** 2
  const equationOfTime = 4 / RAD * (y * Math.sin(2 * meanLongitude) - 2 * eccentricity * Math.sin(anomaly)
    + 4 * eccentricity * y * Math.sin(anomaly) * Math.cos(2 * meanLongitude)
    - 0.5 * y * y * Math.sin(4 * meanLongitude) - 1.25 * eccentricity * eccentricity * Math.sin(2 * anomaly))
  const utcMinutes = ((epoch % 86400000) + 86400000) % 86400000 / 60000
  const longitude = normalize((720 - utcMinutes - equationOfTime) / 4)
  const lat = latitude * RAD, lon = longitude * RAD
  const direction: [number, number, number] = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)]
  const sidereal = normalize(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * t * t - t * t * t / 38710000) * RAD
  // Ecliptic north normal (RA=270 deg) expressed in Earth-fixed equatorial axes.
  const eclipticNormal: [number, number, number] = [-Math.sin(obliquity * RAD) * Math.sin(sidereal), Math.cos(obliquity * RAD), Math.sin(obliquity * RAD) * Math.cos(sidereal)]
  return { epoch, latitude, longitude, obliquity, equationOfTime, direction, eclipticNormal }
}
