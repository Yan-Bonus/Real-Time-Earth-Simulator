export interface TileId { z: number; row: number; col: number }
export type ImagerySource = 'nasa' | 'eox'
export const SOURCES = {
  nasa: { maxLevel: 7, tileSize: 512, rootSpan: 288, origin: 'https://gibs.earthdata.nasa.gov', label: 'NASA Blue Marble · 历史影像' },
  eox: { maxLevel: 13, tileSize: 256, rootSpan: 180, origin: 'https://tiles.maps.eox.at', label: 'EOX Sentinel-2 · 2024 · 非商业验证' },
} as const
export const MAX_LEVEL = 7
export const TILE_SIZE = 512
export const NASA_ORIGIN = 'https://gibs.earthdata.nasa.gov'
export function matrix(z: number, source: ImagerySource = 'nasa') {
  if (!Number.isInteger(z) || z < 0 || z > SOURCES[source].maxLevel) throw new RangeError('Invalid level')
  const span = SOURCES[source].rootSpan / 2 ** z
  return { span, columns: Math.ceil(360 / span), rows: Math.ceil(180 / span) }
}
export function validTile({ z, row, col }: TileId, source: ImagerySource = 'nasa') {
  if (!Number.isInteger(z) || z < 0 || z > SOURCES[source].maxLevel) return false
  const { columns, rows } = matrix(z, source)
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0 && row < rows && col < columns
}
export function tileKey(tile: TileId) { return `${tile.z}/${tile.row}/${tile.col}` }
export function tileBounds(tile: TileId, source: ImagerySource = 'nasa') {
  if (!validTile(tile, source)) throw new RangeError('Invalid tile')
  const { span } = matrix(tile.z, source)
  const west = -180 + tile.col * span
  const north = 90 - tile.row * span
  const east = Math.min(180, west + span)
  const south = Math.max(-90, north - span)
  return { west, east, north, south, uMax: (east - west) / span, vMin: 1 - (north - south) / span }
}
export function children(tile: TileId, source: ImagerySource = 'nasa'): TileId[] {
  if (tile.z === SOURCES[source].maxLevel) return []
  return [0, 1].flatMap((r) => [0, 1].map((c) => ({ z: tile.z + 1, row: tile.row * 2 + r, col: tile.col * 2 + c }))).filter(child => validTile(child, source))
}
export function tileUrl(tile: TileId, source: ImagerySource = 'nasa') {
  if (!validTile(tile, source)) throw new RangeError('Invalid tile')
  if (source === 'eox') return `${SOURCES.eox.origin}/wmts/1.0.0/s2cloudless-2024/default/WGS84/${tileKey(tile)}.jpg`
  return `${NASA_ORIGIN}/wmts/epsg4326/best/BlueMarble_NextGeneration/default/default/500m/${tileKey(tile)}.jpeg`
}
export function surfacePoint(lon: number, lat: number): [number, number, number] {
  const longitude = lon * Math.PI / 180
  const latitude = lat * Math.PI / 180
  return [Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), -Math.cos(latitude) * Math.sin(longitude)]
}
export function ancestors(tile: TileId, source: ImagerySource = 'nasa'): TileId[] {
  if (!validTile(tile, source)) throw new RangeError('Invalid tile')
  const result: TileId[] = [tile]
  let current = tile
  while (current.z > 0) {
    current = { z: current.z - 1, row: Math.floor(current.row / 2), col: Math.floor(current.col / 2) }
    result.push(current)
  }
  return result
}
