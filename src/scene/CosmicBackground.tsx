import {traceRender} from '../engine/renderTrace'
import { isWindowActive, subscribeActivity } from '../engine/windowActivity'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, BufferGeometry, Float32BufferAttribute, type Group, type LineBasicMaterial, type ShaderMaterial } from 'three'
export interface CosmicOptions { stars: boolean; nebula: boolean; meteors: boolean }
function makeStarField() {
    let seed=6281
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
    const vertices:number[]=[],colors:number[]=[],sizes:number[]=[]
    for(let i=0;i<1800;i++){
      const y=2*random()-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y)
      vertices.push(44*r*Math.cos(a),44*y,44*r*Math.sin(a))
      const b=.014+random()**6*.24,tint=random();colors.push(b*(tint<.18?1:.86),b*(tint<.18?.92:.95),b*(tint<.18?.8:1));sizes.push(.7+random()**4*.9)
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setAttribute('starSize',new Float32BufferAttribute(sizes,1));return geometry
}

/** Decorative, deterministic star field; not a catalog of observed stars. */
export default function CosmicBackground({options}:{options:CosmicOptions}) {
  const {invalidate}=useThree()
  const starMaterial=useRef<ShaderMaterial>(null)
  const meteor=useRef<Group>(null),trail=useRef<LineBasicMaterial>(null),started=useRef(-Infinity)
  const stars=useMemo(()=>makeStarField(),[])
  const trailGeometry=useMemo(()=>{
    const positions:number[]=[],colors:number[]=[]
    for(let i=0;i<12;i++)for(const t of [i/12,(i+1)/12]){positions.push(-2.8*t,-.7*t,0);const b=(1-t)**2;colors.push(b,b,b)}
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));return geometry
  },[])
  const starUniforms=useMemo(()=>({pixelRatio:{value:1}}),[])
  useEffect(()=>()=>{stars.dispose();trailGeometry.dispose()},[stars,trailGeometry])
  useEffect(()=>{
    let timer:number|undefined
    const schedule=()=>{
      window.clearTimeout(timer);started.current=-Infinity
      if(meteor.current)meteor.current.visible=false
      if(!options.meteors||!isWindowActive())return
      timer=window.setTimeout(()=>{started.current=performance.now();traceRender('cosmic.start');invalidate();timer=window.setTimeout(schedule,2400)},12000)
    }
    const unsubscribeActivity=subscribeActivity(schedule);schedule();traceRender('cosmic.settings');invalidate()
    return()=>{window.clearTimeout(timer);unsubscribeActivity()}
  },[options.meteors,invalidate])
  useFrame(({gl})=>{
    if(starMaterial.current)starMaterial.current.uniforms.pixelRatio.value=gl.getPixelRatio()
    if(!meteor.current)return
    const t=(performance.now()-started.current)/1000,active=options.meteors&&isWindowActive()&&t>=0&&t<1.8
    meteor.current.visible=active
    if(active){meteor.current.position.set(-9+t*7,9-t*1.8,-24);if(trail.current)trail.current.opacity=Math.sin(t/1.8*Math.PI)*.55;traceRender('cosmic.animation');invalidate()}
  })
  return <group>
    <mesh visible={options.nebula} renderOrder={-100}>
      <sphereGeometry args={[46,40,24]}/>
      <shaderMaterial side={BackSide} depthWrite={false} depthTest={false} toneMapped={false}
        vertexShader={`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`varying vec3 direction;void main(){vec3 d=normalize(direction);float band=exp(-pow((d.y+.24*d.x)/.16,2.0));float wave=.5+.5*sin(d.x*15.0+sin(d.z*11.0));vec3 color=vec3(.00243,.00439,.00857)+band*wave*vec3(.002,.003,.008);gl_FragColor=vec4(color,1.0);
          #include <colorspace_fragment> }`}/>
    </mesh>
    <points visible={options.stars} geometry={stars} renderOrder={-90}>
      <shaderMaterial ref={starMaterial} uniforms={starUniforms} transparent depthWrite={false} toneMapped={false}
        vertexShader={`attribute vec3 color;attribute float starSize;uniform float pixelRatio;varying vec3 starColor;
          void main(){starColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=max(1.0,starSize*pixelRatio);}`}
        fragmentShader={`varying vec3 starColor;void main(){float r=length(gl_PointCoord-.5)*2.;float alpha=(1.-smoothstep(.2,1.,r))*.7;if(alpha<.005)discard;gl_FragColor=vec4(starColor,alpha);
          #include <colorspace_fragment> }`}/>

    </points>
    <group ref={meteor} visible={false} renderOrder={-80}>
      <lineSegments geometry={trailGeometry}><lineBasicMaterial ref={trail} color="#bfd7ef" vertexColors transparent opacity={0} depthWrite={false} toneMapped={false}/></lineSegments>
    </group>
  </group>
}
