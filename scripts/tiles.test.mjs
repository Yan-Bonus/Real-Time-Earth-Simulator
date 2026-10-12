import test from 'node:test'
import assert from 'node:assert/strict'
import { ancestors, matrix, tileBounds, children, validTile, tileUrl, surfacePoint } from '../src/imagery/tiles.ts'
test('NASA 500m grid is not an XYZ grid', () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, z) => { const m = matrix(z); return [m.columns, m.rows] }), [[2,1],[3,2],[5,3],[10,5],[20,10],[40,20],[80,40],[160,80]])
  assert.throws(() => matrix(8), RangeError)
})
test('edge coverage and UV clipping preserve source scale', () => {
  assert.deepEqual(tileBounds({z:0,row:0,col:1}), {west:108,east:180,north:90,south:-90,uMax:0.25,vMin:0.375})
  assert.equal(children({z:0,row:0,col:1}).length, 2)
  const last = tileBounds({z:7,row:79,col:159})
  assert.equal(last.east, 180); assert.equal(last.south, -90)
  assert.equal(last.uMax, 1); assert.equal(last.vMin, 0)
})
test('child coverage is continuous and remains inside its parent', () => {
  for (let z=0; z<7; z++) {
    const m = matrix(z)
    for (const parent of [{z,row:0,col:0},{z,row:m.rows-1,col:m.columns-1}]) {
      const b = tileBounds(parent)
      const parts = children(parent).map(tile => tileBounds(tile))
      assert.equal(Math.min(...parts.map(p=>p.west)), b.west)
      assert.equal(Math.max(...parts.map(p=>p.east)), b.east)
      assert.equal(Math.max(...parts.map(p=>p.north)), b.north)
      assert.equal(Math.min(...parts.map(p=>p.south)), b.south)
      const area = parts.reduce((sum,p)=>sum+(p.east-p.west)*(p.north-p.south),0)
      assert.equal(area,(b.east-b.west)*(b.north-b.south))
    }
  }
})
test('invalid coordinates cannot create arbitrary requests', () => {
  for (const tile of [{z:7,row:80,col:0},{z:1,row:0,col:3},{z:0,row:-1,col:0},{z:0,row:0,col:0.5}]) {
    assert.equal(validTile(tile),false); assert.throws(()=>tileUrl(tile),RangeError)
  }
  assert.equal(new URL(tileUrl({z:7,row:22,col:131})).hostname,'gibs.earthdata.nasa.gov')
})
test('geographic orientation, poles and date line meet on a unit sphere', () => {
  assert.deepEqual(surfacePoint(0,0),[1,0,-0])
  for (const lon of [-180,-90,0,90,180]) {
    for (const lat of [-90,0,90]) {
      const p=surfacePoint(lon,lat)
      assert.ok(Math.abs(Math.hypot(...p)-1)<1e-12)
    }
  }
  const a=surfacePoint(-180,30), b=surfacePoint(180,30)
  assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-12))
  assert.ok(surfacePoint(0,90)[1]>0.9999)
})

test('edge tiles retain valid parents through every level', () => {
  for(let z=0;z<=7;z++) {
    const m=matrix(z)
    const chain=ancestors({z,row:m.rows-1,col:m.columns-1})
    assert.equal(chain.length,z+1)
    assert.ok(chain.every(tile => validTile(tile)))
    assert.equal(chain.at(-1).z,0)
  }
})

test('off-screen and tiny fringe patches cannot dominate visible-area budgets', async () => {
  const {viewportCoverage} = await import('../src/imagery/visibility.ts')
  assert.equal(viewportCoverage({left:1.1,right:2,bottom:-0.5,top:0.5}),undefined)
  const center=viewportCoverage({left:-0.2,right:0.2,bottom:-0.2,top:0.2})
  const edge=viewportCoverage({left:0.6,right:1,bottom:-0.2,top:0.2})
  assert.equal(center.centerDistance,0)
  assert.ok(center.weight>edge.weight)
  const fringe=viewportCoverage({left:0.99,right:50,bottom:-1,top:1})
  assert.ok(fringe.area<0.021)
  assert.ok(fringe.weight<center.weight)
  assert.equal(viewportCoverage({left:0,right:0,bottom:0,top:1}),undefined)
})
