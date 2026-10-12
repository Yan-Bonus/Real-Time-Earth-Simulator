import { simulationClock } from '../engine/time/simulation'
import { Vector3 } from 'three'
import { solarPosition } from '../engine/astronomy/solar'
const initial = solarPosition(simulationClock.now())
/** Shared by every imagery material so newly uploaded tiles use the same Sun. */
export const solarUniforms = {
  sunDirection: { value: new Vector3(...initial.direction) },
  daylightEnabled: { value: 1 },
  atmosphereEnabled: { value: 1 },
}
