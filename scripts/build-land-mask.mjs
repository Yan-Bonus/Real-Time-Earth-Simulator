import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { _electron as electron } from 'playwright'
const input = process.argv[2]
if (!input) throw new Error('Provide Natural Earth ne_10m_land.geojson input path')
const bytes = await readFile(input)
const data = JSON.parse(bytes)
if (data.type !== 'FeatureCollection') throw new Error('Expected a GeoJSON FeatureCollection')
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.EARTH_DEV_URL
const app = await electron.launch({ args: ['.'], env })
try {
  const page = await app.firstWindow()
  const mask = await page.evaluate(features => {
    const canvas = document.createElement('canvas'); canvas.width = 4096; canvas.height = 2048
    const context = canvas.getContext('2d'); context.fillStyle = '#000'; context.fillRect(0, 0, 4096, 2048)
    context.fillStyle = '#fff'
    for (const feature of features) {
      if (feature.properties?.featurecla !== 'Land') continue
      const geometry = feature.geometry
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
      for (const polygon of polygons) {
        context.beginPath()
        for (const ring of polygon) {
          ring.forEach(([lon, lat], index) => {
            const x = (lon + 180) / 360 * 4096, y = (90 - lat) / 180 * 2048
            if (index === 0) context.moveTo(x, y); else context.lineTo(x, y)
          })
          context.closePath()
        }
        context.fill('evenodd')
      }
    }
    // Check orientation and distinguish land, shallow seas, and the date-line ocean.
    const at = (lon, lat) => context.getImageData(Math.floor((lon + 180) / 360 * 4096), Math.floor((90 - lat) / 180 * 2048), 1, 1).data[0]
    const probes = [[116, 37, 255], [123, 35, 0], [150, 20, 0], [-150, 0, 0], [20, -80, 255], [0, 0, 0], [138, 37, 255]]
    for (const [lon, lat, expected] of probes) if (at(lon, lat) !== expected) throw new Error(`Mask mismatch at ${lon},${lat}`)
    return canvas.toDataURL('image/png').split(',')[1]
  }, data.features)
  const output = Buffer.from(mask, 'base64')
  await writeFile('public/textures/earth-land-mask-4k.png', output)
  console.log(JSON.stringify({ inputSha256: createHash('sha256').update(bytes).digest('hex'), outputSha256: createHash('sha256').update(output).digest('hex'), bytes: output.length, dimensions: '4096x2048', geographicProbes: 7 }))
} finally { await app.close() }