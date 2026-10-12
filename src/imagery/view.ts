import { Frustum, Matrix4, PerspectiveCamera, Sphere, Vector3 } from 'three'
import { viewportCoverage } from './visibility.ts'
import { children, SOURCES, surfacePoint, tileBounds, tileKey, type ImagerySource, type TileId } from './tiles.ts'

export interface ClearView { tiles: TileId[]; maxTexelRatio: number; limited: boolean; reason?: string }
export function selectClearView(camera: PerspectiveCamera, earthMatrix: Matrix4, width: number, height: number, source: ImagerySource, highest = true, budget = 640): ClearView {
  camera.updateMatrixWorld()
  const local = camera.position.clone().applyMatrix4(earthMatrix.clone().invert())
  const direction = local.clone().normalize(), horizon = Math.acos(1 / Math.max(1.001, local.length()))
  const clip = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(earthMatrix)
  const frustum = new Frustum().setFromProjectionMatrix(clip), provider = SOURCES[source]
  const threshold = provider.tileSize * (highest ? 0.9 : 1)
  type Candidate = { id: TileId; pixels: number }
  function candidate(id: TileId): Candidate | undefined {
    const b = tileBounds(id, source)
    const center = new Vector3(...surfacePoint((b.west + b.east) / 2, (b.north + b.south) / 2))
    const angle = Math.min(Math.PI, Math.hypot(b.east-b.west, b.north-b.south) * Math.PI / 360)
    if (center.angleTo(direction) > horizon + angle) return
    const bound = angle >= Math.PI/2 ? new Sphere(new Vector3(),1.001) : new Sphere(center.clone().multiplyScalar(Math.cos(angle)),Math.sin(angle)+0.001)
    if (!frustum.intersectsSphere(bound)) return
    // Large hemispheric patches cross the perspective singularity; always subdivide them.
    if (id.z < 3) return {id, pixels: Infinity}
    let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity
    const point=new Vector3(),longitudes=Array.from({length:7},(_,c)=>{const lon=(b.west+(b.east-b.west)*c/6)*Math.PI/180;return [Math.cos(lon),Math.sin(lon)]})
    for(let r=0;r<=6;r++) {const lat=(b.south+(b.north-b.south)*r/6)*Math.PI/180,cosLat=Math.cos(lat),sinLat=Math.sin(lat)
     for(let c=0;c<=6;c++) {
      point.set(cosLat*longitudes[c][0],sinLat,-cosLat*longitudes[c][1])
      if(point.dot(local)<0.985) continue
      point.applyMatrix4(clip)
      if(point.z>1 || point.z < -1) continue
      left=Math.min(left,point.x);right=Math.max(right,point.x)
      bottom=Math.min(bottom,point.y);top=Math.max(top,point.y)
    }
    }
    if(!Number.isFinite(left) || !viewportCoverage({left:left-0.012,right:right+0.012,bottom:bottom-0.012,top:top+0.012})) return
    return {id,pixels:Math.max((right-left)*width/2,(top-bottom)*height/2)}
  }
  let selected: Candidate[] = [{z:0,row:0,col:0},{z:0,row:0,col:1}].map(candidate).filter((n): n is Candidate=>!!n)
  const blocked=new Set<string>()
  while(selected.length) {
    let split:Candidate|undefined
    for(const n of selected)if(n.pixels>threshold&&n.id.z<provider.maxLevel&&!blocked.has(tileKey(n.id))&&(!split||n.pixels>split.pixels||n.pixels===split.pixels&&n.id.z<split.id.z))split=n
    if(!split) break
    const parts=children(split.id,source).map(candidate).filter((n): n is Candidate=>!!n)
    if(!parts.length) {selected=selected.filter(n=>n!==split);continue}
    if(selected.length-1+parts.length>budget) {blocked.add(tileKey(split.id));continue}
    selected=selected.filter(n=>n!==split).concat(parts)
  }
  const ratio=Math.max(0,...selected.map(n=>n.pixels/provider.tileSize))
  return {tiles:selected.map(n=>n.id),maxTexelRatio:ratio,limited:ratio>(highest?0.9:1),reason:ratio>(highest?0.9:1)?'当前视角超出影像或设备的清晰度上限':undefined}
}
