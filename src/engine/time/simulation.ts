/** UTC exploration range; solar calculations are approximate within these centuries. */
export const MIN_EPOCH = Date.UTC(1900, 0, 1)
export const MAX_EPOCH = Date.UTC(2101, 0, 1) - 1
export class SimulationClock {
  private anchorEpoch: number
  private anchorTick: number
  private real = true
  private speed = 1
  private rememberedRate = 1
  private wall: () => number
  private tick: () => number
  private listeners = new Set<() => void>()
  constructor(wall = () => Date.now(), tick = () => performance.now()) {
    this.wall = wall; this.tick = tick
    this.anchorEpoch = wall(); this.anchorTick = tick()
  }
  now(): number { return this.real ? this.wall() : Math.min(MAX_EPOCH, Math.max(MIN_EPOCH, this.anchorEpoch + (this.tick() - this.anchorTick) * this.speed)) }
  get rate(): number { return this.speed }
  get isRealTime(): boolean { return this.real }
  get resumeRate(): number { return this.rememberedRate }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private changed() { for (const listener of this.listeners) listener() }
  setRate(rate: number): void {
    if (!Number.isFinite(rate) || Math.abs(rate) > 3600) throw new RangeError('Unsupported simulation rate')
    this.anchorEpoch = this.now(); this.anchorTick = this.tick(); this.real = false; this.speed = rate
    if (rate !== 0) this.rememberedRate = rate
    this.changed()
  }
  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate === 0 || Math.abs(rate) > 3600) throw new RangeError('Unsupported playback rate')
    if (this.speed === 0) { this.rememberedRate = rate; this.changed() }
    else this.setRate(rate)
  }
  pause(): void { this.setRate(0) }
  resume(): void { this.setRate(this.rememberedRate) }
  setDate(epoch: number): void {
    if (!Number.isFinite(epoch) || epoch < MIN_EPOCH || epoch > MAX_EPOCH) throw new RangeError('UTC date must be within 1900–2100')
    this.anchorEpoch = epoch; this.anchorTick = this.tick(); this.real = false
    this.changed()
  }
  stopAtBoundary(): void {
    if (!this.real && this.speed !== 0 && (this.now() === MIN_EPOCH || this.now() === MAX_EPOCH)) this.pause()
  }
  reset(): void { this.real = true; this.speed = 1; this.rememberedRate = 1; this.changed() }
}
export const simulationClock = new SimulationClock()
// One epoch is captured before all scene callbacks, then published to both time panels.
let frameEpoch = simulationClock.now(), publishedEpoch = frameEpoch, lastPublish = -Infinity
const timeListeners = new Set<() => void>()
export const subscribeTime = (listener: () => void) => { timeListeners.add(listener); return () => { timeListeners.delete(listener) } }
export const timeSnapshotEpoch = () => publishedEpoch
export const sceneEpoch = () => frameEpoch
export function captureSimulationFrame(force = false) {
  simulationClock.stopAtBoundary()
  frameEpoch = simulationClock.now()
  const tick = performance.now(), cadence = Math.abs(simulationClock.rate) > 1 ? 33 : 200
  if (force || tick - lastPublish >= cadence) {
    lastPublish = tick; publishedEpoch = frameEpoch
    for (const listener of timeListeners) listener()
  }
  return frameEpoch
}
simulationClock.subscribe(() => captureSimulationFrame(true))
