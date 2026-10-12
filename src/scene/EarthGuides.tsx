import { useMemo, useRef } from 'react'
import { Html, Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, Vector3 } from 'three'
import { surfacePoint } from '../imagery/tiles'

type Point = [number, number, number]
/** Analytic graticule avoids independent line depths fighting imagery tile layers. */
function SurfaceGrid({ grid, equator }: { grid: boolean; equator: boolean }) {
  const { gl } = useThree()
  const material = useRef<import('three').ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ grid: { value: 0 }, equator: { value: 0 }, pixelRatio: { value: 1 } }), [])
  useFrame(() => {
    if (!material.current) return
    material.current.uniforms.grid.value = grid ? 1 : 0
    material.current.uniforms.equator.value = equator ? 1 : 0
    material.current.uniforms.pixelRatio.value = gl.getPixelRatio()
  })
  return <mesh renderOrder={100}>
    <sphereGeometry args={[1.0004, 256, 128]} />
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthTest={false} depthWrite={false} toneMapped={false}
      vertexShader={`varying vec3 localPoint; varying vec3 viewPoint; varying vec3 viewNormal;
        void main() { localPoint = position; vec4 p = modelViewMatrix * vec4(position,1.0);
          viewPoint=p.xyz; viewNormal=normalMatrix*normal; gl_Position=projectionMatrix*p; }`}
      fragmentShader={`uniform float grid; uniform float equator; uniform float pixelRatio;
        varying vec3 localPoint; varying vec3 viewPoint; varying vec3 viewNormal;
        float stroke(float value, float width) {
          float footprint=max(fwidth(value),0.000001);
          return 1.0-smoothstep(footprint*max(0.0,width-0.5),footprint*(width+0.5),abs(value));
        }
        void main() {
          vec3 p=normalize(localPoint);
          float lat=asin(clamp(p.y,-1.0,1.0)); float lon=atan(-p.z,p.x);
          float rim=smoothstep(0.04,0.24,dot(normalize(viewNormal),normalize(-viewPoint)));
          float latDistance=abs(mod(lat+0.2617993878,0.5235987756)-0.2617993878);
          float lonDistance=abs(mod(lon+0.2617993878,0.5235987756)-0.2617993878);
          // Differentiate atan analytically so the +/-180 degree seam has no wide stripe.
          vec2 direction=vec2(p.x,-p.z); vec2 dx=dFdx(direction); vec2 dy=dFdy(direction);
          float lonFootprint=(abs(direction.x*dx.y-direction.y*dx.x)+abs(direction.x*dy.y-direction.y*dy.x))/max(dot(direction,direction),0.000001);
          float parallels=1.0-smoothstep(0.25*pixelRatio,1.25*pixelRatio,latDistance/max(fwidth(lat),0.000001));
          float meridians=(1.0-smoothstep(0.25*pixelRatio,1.25*pixelRatio,lonDistance/max(lonFootprint,0.000001)))*smoothstep(0.02,0.12,length(p.xz));
          float eq=stroke(lat,0.75*pixelRatio)*equator;
          // Only suppress the zero-latitude parallel; meridians stay continuous across it.
          parallels*=smoothstep(0.002,0.008,abs(lat));
          float lines=max(parallels,meridians)*grid;
          // Equator has its own toggle; do not leave a zero-latitude grid line behind.
          float alpha=max(lines*0.48,eq*0.8)*rim;
          if(alpha<0.005)discard;
          vec3 color=mix(vec3(0.76,0.82,0.87),vec3(0.89,0.78,0.56),eq);
          gl_FragColor=vec4(color,alpha);
        }`} />
  </mesh>
}

function GuideLabel({ latitude, longitude, text, kind = 'grid', followView = false, followLatitude = false }: {
  latitude: number; longitude: number; text: string; kind?: string; followView?: boolean; followLatitude?: boolean
}) {
  const anchor = useRef<Group>(null)
  const element = useRef<HTMLDivElement>(null)
  const { camera } = useThree()
  const scratch = useMemo(() => ({ world: new Vector3(), localCamera: new Vector3(), normal: new Vector3(), toCamera: new Vector3(), projected: new Vector3() }), [])
  useFrame(() => {
    const node = anchor.current
    if (!node || !element.current || !node.parent) return
    if (followView || followLatitude) {
      node.parent.updateWorldMatrix(true, false)
      scratch.localCamera.copy(camera.position)
      node.parent.worldToLocal(scratch.localCamera)
      const centerLongitude = Math.atan2(-scratch.localCamera.z, scratch.localCamera.x) * 180 / Math.PI
      const distance = scratch.localCamera.length()
      const labelLongitude = followView ? centerLongitude - Math.min(35, Math.max(6, (distance - 1) * 18)) : longitude
      const labelLatitude = followLatitude && distance < 2 ? Math.max(-80, Math.min(80, Math.asin(scratch.localCamera.y / distance) * 180 / Math.PI - 7)) : latitude
      node.position.set(...surfacePoint(labelLongitude, labelLatitude).map(value => value * 1.009) as Point)
    }
    node.getWorldPosition(scratch.world)
    scratch.normal.copy(scratch.world).normalize()
    scratch.toCamera.copy(camera.position).sub(scratch.world).normalize()
    const facing = scratch.normal.dot(scratch.toCamera)
    scratch.projected.copy(scratch.world).project(camera)
    const visible = facing > 0.2 && Math.abs(scratch.projected.x) < 0.93 && Math.abs(scratch.projected.y) < 0.93
    element.current.style.visibility = visible ? 'visible' : 'hidden'
    element.current.style.opacity = String(Math.min(1, Math.max(0, (facing - 0.2) / 0.2)))
  })
  const position = useMemo(() => surfacePoint(longitude, latitude).map(value => value * 1.009) as Point, [longitude, latitude])
  return <group ref={anchor} position={position}>
    <Html center ref={element} zIndexRange={[1, 0]} pointerEvents="none" className={`guide-label guide-label-${kind}`} style={{ visibility: 'hidden' }}>{text}</Html>
  </group>
}

export default function EarthGuides({ axis, equator, grid }: { axis: boolean; equator: boolean; grid: boolean }) {
  const latitudeLines = useMemo(() => [-60, -30, 30, 60], [])
  const longitudeLines = useMemo(() => Array.from({ length: 12 }, (_, index) => index * 30 - 180), [])
  const axisPoints = useMemo<Point[]>(() => [[0, -1.17, 0], [0, 1.17, 0]], [])
  return <group>
    {(grid || equator) && <SurfaceGrid grid={grid} equator={equator} />}
    {equator && <group>
      <GuideLabel latitude={0} longitude={0} text="0°" kind="equator" followView />
    </group>}
    {grid && <group>
      {latitudeLines.map(value => <group key={`lat-${value}`}>
        <GuideLabel latitude={value} longitude={0} text={`${Math.abs(value)}°${value > 0 ? 'N' : 'S'}`} followView />
      </group>)}
      {longitudeLines.map(value => <group key={`lon-${value}`}>
        <GuideLabel latitude={-7} longitude={value} followLatitude text={value === 0 ? '0°' : `${Math.abs(value)}°${Math.abs(value) === 180 ? '' : value > 0 ? 'E' : 'W'}`} />
      </group>)}
    </group>}
    {axis && <group>
      <Line points={axisPoints} color="#91bfd1" lineWidth={1.2} dashed dashSize={0.025} gapSize={0.018} transparent opacity={0.65} renderOrder={100} depthTest depthWrite={false} toneMapped={false} />
      <mesh position={[0, 1.18, 0]}><coneGeometry args={[0.008, 0.026, 24]} /><meshBasicMaterial color="#b2d9e6" toneMapped={false} /></mesh>
      {[1, -1].map(sign => <mesh key={sign} position={[0, sign * 1.004, 0]}><sphereGeometry args={[0.007, 16, 12]} /><meshBasicMaterial color="#b2d9e6" toneMapped={false} /></mesh>)}
      <Html position={[0, 1.23, 0]} center occlude zIndexRange={[1, 0]} pointerEvents="none" className="guide-label guide-label-pole">N</Html>
      <Html position={[0, -1.23, 0]} center occlude zIndexRange={[1, 0]} pointerEvents="none" className="guide-label guide-label-pole">S</Html>
    </group>}
  </group>
}
