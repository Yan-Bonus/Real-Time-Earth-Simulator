export interface ScreenBounds { left: number; right: number; bottom: number; top: number }
/** Clip a projected patch to the viewport before spending a subdivision budget on it. */
export function viewportCoverage(bounds: ScreenBounds) {
  const left = Math.max(-1, bounds.left), right = Math.min(1, bounds.right)
  const bottom = Math.max(-1, bounds.bottom), top = Math.min(1, bounds.top)
  if (right <= left || top <= bottom) return undefined
  const nearestX = left > 0 ? left : right < 0 ? right : 0
  const nearestY = bottom > 0 ? bottom : top < 0 ? top : 0
  const centerDistance = Math.hypot(nearestX, nearestY)
  const area = (right - left) * (top - bottom)
  return { area, centerDistance, weight: Math.sqrt(area) / (1 + 4 * centerDistance ** 2) }
}
