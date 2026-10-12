import test from 'node:test'
import assert from 'node:assert/strict'
import { matrix, children, ancestors, tileBounds, validTile, tileUrl, SOURCES } from '../src/imagery/tiles.ts'
import { renderPixelRatio } from '../src/imagery/quality.ts'

test('EOX WGS84 matches official 256px 2x1 root matrix and preserves exact children', () => {
  assert.deepEqual(matrix(0, 'eox'), {span:180,columns:2,rows:1})
  assert.deepEqual(matrix(13, 'eox'), {span:180/8192,columns:16384,rows:8192})
  const root={z:0,row:0,col:1}
  assert.deepEqual(tileBounds(root,'eox'),{west:0,east:180,north:90,south:-90,uMax:1,vMin:0})
  const kids=children(root,'eox')
  assert.equal(kids.length,4)
  assert.equal(tileBounds(kids[0],'eox').east,tileBounds(kids[1],'eox').west)
  assert.equal(tileBounds(kids[0],'eox').south,tileBounds(kids[2],'eox').north)
  assert.deepEqual(ancestors(kids[0],'eox').at(-1),root)
})
test('EOX uses native detail cap, restricted URLs and valid edge coverage', () => {
  assert.equal(SOURCES.eox.tileSize,256)
  assert.equal(SOURCES.eox.maxLevel,13)
  assert.equal(validTile({z:14,row:0,col:0},'eox'),false)
  assert.equal(validTile({z:13,row:8192,col:0},'eox'),false)
  const last={z:13,row:8191,col:16383}
  assert.equal(tileBounds(last,'eox').east,180)
  assert.equal(tileBounds(last,'eox').south,-90)
  assert.deepEqual(children(last,'eox'),[])
  assert.equal(tileUrl({z:13,row:2412,col:13471},'eox'),'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024/default/WGS84/13/2412/13471.jpg')
  assert.throws(()=>tileUrl({z:99,row:0,col:0},'eox'),RangeError)
})
test('highest render scale respects native DPI and viewport hardware ceiling', () => {
  assert.equal(renderPixelRatio(1.5,false,1707,1044,16384),1.5)
  assert.equal(renderPixelRatio(1.5,true,1707,1044,16384),1.875)
  assert.equal(renderPixelRatio(3,true,1707,1044,16384),3)
  assert.equal(renderPixelRatio(2,true,8192,4096,8192),1)
})
