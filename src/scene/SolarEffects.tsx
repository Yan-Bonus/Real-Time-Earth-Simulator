import { sceneEpoch } from '../engine/time/simulation'
import { useMemo, useRef } from 'react'
import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Group, Vector3, MathUtils, type ShaderMaterial, type PerspectiveCamera, type MeshBasicMaterial, type Mesh } from 'three'
import { solarPosition } from '../engine/astronomy/solar'
import { solarUniforms } from './solarUniforms'
import Atmosphere from './Atmosphere'

export interface SolarOptions {
  daylight: boolean; atmosphere: boolean; terminator: boolean
  subsolar: boolean; direction: boolean; tilt: boolean
}
const vertexShader = `varying vec3 localNormal; varying vec3 viewNormal; varying vec3 viewPoint;
  void main(){ localNormal=normal; viewNormal=normalMatrix*normal;
    vec4 point=modelViewMatrix*vec4(position,1.0); viewPoint=point.xyz; gl_Position=projectionMatrix*point; }`

export default function SolarEffects({ options }: { options: SolarOptions }) {
  const earthOccluder = useRef<Mesh>(null!)
  const marker = useRef<Group>(null), arrow = useRef<Group>(null), orbital = useRef<Group>(null), tilt = useRef<Group>(null)
  const arrowGlyph = useRef<Group>(null)
  const markerLabel = useRef<HTMLSpanElement>(null), arrowLabel = useRef<HTMLSpanElement>(null)
  const shaftMaterial = useRef<MeshBasicMaterial>(null), tipMaterial = useRef<MeshBasicMaterial>(null)
  const boundary = useRef<ShaderMaterial>(null)
  const scratch = useMemo(() => ({ sun: new Vector3(), normal: new Vector3(), up: new Vector3(0,1,0), front: new Vector3(0,0,1), world: new Vector3(), cameraDirection: new Vector3(), markerScreen: new Vector3(), arrowScreen: new Vector3() }), [])
  const boundaryUniforms = useMemo(() => ({ ...solarUniforms, pixelRatio: { value: 1 } }), [])
  const orbitalPoints = useMemo(() => Array.from({length:181},(_,i) => {
    const a=i/180*Math.PI*2;return [Math.cos(a)*1.26,0,Math.sin(a)*1.26] as [number,number,number]
  }), [])
  const arc = useMemo(() => Array.from({length:33},(_,i) => {
    const a=i/32*23.44*Math.PI/180;return [Math.sin(a)*1.38,Math.cos(a)*1.38,0] as [number,number,number]
  }), [])
  useFrame(({gl,camera,size}) => {
    const sun=solarPosition(sceneEpoch())
    scratch.sun.set(...sun.direction)
    solarUniforms.sunDirection.value.copy(scratch.sun)
    solarUniforms.daylightEnabled.value=options.daylight?1:0
    solarUniforms.atmosphereEnabled.value=options.atmosphere?1:0
    // R3F may clone uniforms when attaching a shader; update the actual materials too.
    for(const shader of [boundary.current])if(shader)shader.uniforms.sunDirection.value.copy(scratch.sun)
    if(boundary.current)boundary.current.uniforms.pixelRatio.value=gl.getPixelRatio()
    if(marker.current){marker.current.position.copy(scratch.sun).multiplyScalar(1.012);marker.current.quaternion.setFromUnitVectors(scratch.front,scratch.sun)}
    if(arrow.current)arrow.current.quaternion.setFromUnitVectors(scratch.up,scratch.sun)
    camera.getWorldDirection(scratch.cameraDirection)
    const pixelWorld = (point: Vector3) => {
      const depth = Math.max(0.01, scratch.world.copy(point).sub(camera.position).dot(scratch.cameraDirection))
      return 2 * Math.tan((camera as PerspectiveCamera).fov * Math.PI / 360) * depth / size.height
    }
    if(marker.current){
      marker.current.getWorldPosition(scratch.markerScreen)
      marker.current.scale.setScalar(Math.min(4,Math.max(0.05,5*pixelWorld(scratch.markerScreen)/0.014)))
      scratch.markerScreen.project(camera)
    }
    if(arrowGlyph.current){
      arrowGlyph.current.getWorldPosition(scratch.arrowScreen)
      arrowGlyph.current.scale.setScalar(Math.min(3,Math.max(0.04,34*pixelWorld(scratch.arrowScreen)/0.30)))
      const alignment=Math.abs(scratch.world.copy(scratch.arrowScreen).normalize().dot(scratch.cameraDirection))
      const opacity=Math.min(1,Math.max(0,(1-alignment-0.005)/0.035))
      if(shaftMaterial.current)shaftMaterial.current.opacity=opacity
      if(tipMaterial.current)tipMaterial.current.opacity=opacity
      scratch.arrowScreen.project(camera)
    }
    if(arrowLabel.current){
      const gap=Math.hypot((scratch.markerScreen.x-scratch.arrowScreen.x)*size.width/2,
        (scratch.markerScreen.y-scratch.arrowScreen.y)*size.height/2)
      const avoidance=options.subsolar?1-MathUtils.smoothstep(gap,55,95):0
      arrowLabel.current.style.transform=`translate(${54*avoidance}px, ${-14-6*avoidance}px)`
    }
    scratch.normal.set(...sun.eclipticNormal)
    if(orbital.current)orbital.current.quaternion.setFromUnitVectors(scratch.up,scratch.normal)
    if(tilt.current)tilt.current.rotation.y=Math.atan2(-scratch.normal.z,scratch.normal.x)
  })
  return <group>
    {/* Only solid Earth occludes labels. A negative Html epsilon rechecks depth even
        when an aligned label retains identical screen coordinates. */}
    <mesh ref={earthOccluder} visible={false}><sphereGeometry args={[1,128,64]}/><meshBasicMaterial/></mesh>
    {options.atmosphere && <Atmosphere/>}
    {options.terminator && <mesh renderOrder={105}>
      <sphereGeometry args={[1.0005,256,128]}/>
      <shaderMaterial ref={boundary} uniforms={boundaryUniforms} vertexShader={vertexShader} transparent depthTest={false} depthWrite={false} toneMapped={false}
        fragmentShader={`uniform vec3 sunDirection; uniform float pixelRatio;
          varying vec3 localNormal; varying vec3 viewNormal; varying vec3 viewPoint;
          void main(){ float incidence=dot(normalize(localNormal),sunDirection);
            float edge=abs(incidence)/max(fwidth(incidence),0.000001);
            float line=1.0-smoothstep(0.1*pixelRatio,0.85*pixelRatio,edge);
            float rim=smoothstep(0.04,0.22,dot(normalize(viewNormal),normalize(-viewPoint)));
            float alpha=line*rim*0.28;if(alpha<0.005)discard;gl_FragColor=vec4(0.36,0.45,0.52,alpha);
            #include <colorspace_fragment> }`}/>
    </mesh>}
    {options.subsolar && <group ref={marker}>
      <mesh><ringGeometry args={[0.009,0.014,40]}/><meshBasicMaterial color="#ffd58a" toneMapped={false}/></mesh>
      <mesh><circleGeometry args={[0.004,20]}/><meshBasicMaterial color="#fff1cb" toneMapped={false}/></mesh>
      <Html position={[0,0.03,0]} center eps={-1} occlude={[earthOccluder]} zIndexRange={[1,0]} pointerEvents="none" className="guide-label guide-label-equator"><span ref={markerLabel} data-testid="subsolar-label">SUN</span></Html>
    </group>}
    {options.direction && <group ref={arrow}>
      <group ref={arrowGlyph} position={[0,1.24,0]}>
        <mesh position={[0,0.175,0]}><cylinderGeometry args={[0.0025,0.0025,0.25,12]}/><meshBasicMaterial ref={shaftMaterial} color="#f0cc8f" transparent depthWrite={false} toneMapped={false}/></mesh>
        <mesh position={[0,0.025,0]} rotation={[0,0,Math.PI]}><coneGeometry args={[0.016,0.05,24]}/><meshBasicMaterial ref={tipMaterial} color="#f0cc8f" transparent depthWrite={false} toneMapped={false}/></mesh>
      </group>
      <Html position={[0,1.34,0]} center eps={-1} occlude={[earthOccluder]} zIndexRange={[1,0]} pointerEvents="none" className="guide-label guide-label-equator"><span ref={arrowLabel} data-testid="direction-label" style={{display:'inline-block'}}>LIGHT</span></Html>
    </group>}
    {options.tilt && <group>
      <group ref={orbital}>
        <Line points={orbitalPoints} color="#87a6b9" lineWidth={1} transparent opacity={0.35} depthWrite={false}/>
        <Line points={[[0,1.02,0],[0,1.50,0]]} color="#8ea4b9" lineWidth={1} dashed dashSize={0.022} gapSize={0.02} transparent opacity={0.7} depthWrite={false}/>
      </group>
      <group ref={tilt}>
        <Line points={arc} color="#f0cc8f" lineWidth={1.2} transparent opacity={0.85} depthWrite={false}/>
        <Line points={[[0,1.02,0],[0,1.5,0]]} color="#a7d0df" lineWidth={1.2} transparent opacity={0.8} depthWrite={false}/>
        <Html position={[0.3,1.44,0]} center eps={-1} occlude={[earthOccluder]} zIndexRange={[1,0]} pointerEvents="none" className="guide-label guide-label-equator">23.4°</Html>
      </group>
    </group>}
  </group>
}
