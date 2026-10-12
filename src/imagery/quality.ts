export function renderPixelRatio(nativeRatio: number, highest: boolean, width: number, height: number, maxViewport: number): number {
  const desired = Math.min(3, nativeRatio * (highest ? 1.25 : 1))
  return Math.min(desired, maxViewport / Math.max(1, width, height))
}
