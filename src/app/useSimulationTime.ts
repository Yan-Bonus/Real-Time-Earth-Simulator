import { useSyncExternalStore } from 'react'
import { subscribeTime, timeSnapshotEpoch, simulationClock } from '../engine/time/simulation'
export default function useSimulationTime() {
  useSyncExternalStore(simulationClock.subscribe, () => `${simulationClock.rate}/${simulationClock.isRealTime}`)
  return useSyncExternalStore(subscribeTime, timeSnapshotEpoch)
}
