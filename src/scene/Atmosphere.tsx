import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Vector3, type ShaderMaterial } from 'three'
import { solarUniforms } from './solarUniforms'

/** Low-sample single scattering, Earth-radius units. No weather, clouds or
 * multiple scattering. Scale heights approximate 8 km Rayleigh / 1.2 km Mie. */
export default function Atmosphere() {
  const root=useRef<Group>(null),material=useRef<ShaderMaterial>(null)
  const uniforms=useMemo(()=>({...solarUniforms,eye:{value:new Vector3()}}),[])
  const eye=useMemo(()=>new Vector3(),[])
  useFrame(({camera})=>{
    if(!root.current||!material.current)return
    root.current.updateWorldMatrix(true,false)
    camera.getWorldPosition(eye);root.current.worldToLocal(eye)
    material.current.uniforms.eye.value.copy(eye)
    material.current.uniforms.sunDirection.value.copy(solarUniforms.sunDirection.value)
  })
  return <group ref={root}><mesh renderOrder={110}>
    <sphereGeometry args={[1.0125,192,96]}/>
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthTest={false} depthWrite={false} toneMapped={false}
      vertexShader={`varying vec3 point;void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
      fragmentShader={`uniform vec3 eye;uniform vec3 sunDirection;varying vec3 point;
        const float TOP=1.0125;
        const float HR=0.0012557;const float HM=0.0001884;
        const vec3 BR=vec3(36.954,85.982,210.879);
        const vec3 BM=vec3(5.0);
        vec2 sphere(vec3 origin,vec3 ray,float radius){float b=dot(origin,ray);
          float d=b*b-dot(origin,origin)+radius*radius;if(d<0.0)return vec2(1.0,-1.0);
          float h=sqrt(max(d,0.0));return vec2(-b-h,-b+h);}
        float column(float height,float mu,float scale){
          // Chapman-style grazing-angle approximation, avoiding the singular 1/cos.
          float effective=0.5*(mu+sqrt(mu*mu+4.0*scale));
          return exp(-height/scale)*scale/max(effective,0.008);
        }
        void main(){
          vec3 ray=normalize(point-eye);vec2 atmosphere=sphere(eye,ray,TOP);
          float start=max(0.0,atmosphere.x),finish=atmosphere.y;
          vec2 ground=sphere(eye,ray,1.0);
          if(ground.x>0.0)finish=min(finish,ground.x);
          if(finish<=start)discard;
          // Surface imagery already has aerial perspective. Restrict the extra
          // scattering to a narrow, smoothly fading limb, before costly integration.
          float surfaceStrength=1.0;
          if(ground.x>0.0){float facing=max(dot(normalize(eye+ray*finish),-ray),0.0);
            surfaceStrength=(1.0-smoothstep(0.0,0.28,facing))*pow(1.0-facing,3.0);}
          if(surfaceStrength<=0.00001)discard;
          float span=finish-start;
          float cosine=dot(ray,sunDirection);
          float phaseR=0.0596831*(1.0+cosine*cosine);
          float g=0.76;float phaseM=0.0795775*(1.0-g*g)/pow(max(0.06,1.0+g*g-2.0*g*cosine),1.5);
          vec2 depth=vec2(0.0);vec3 light=vec3(0.0);
          // Fixed eight intervals; denser samples close to the ground on surface rays.
          for(int i=0;i<8;i++){
            float a=float(i)/8.0,b=float(i+1)/8.0;
            if(ground.x>0.0){a=1.0-(1.0-a)*(1.0-a);b=1.0-(1.0-b)*(1.0-b);}
            float stepLength=(b-a)*span;
            vec3 samplePoint=eye+ray*(start+(a+b)*0.5*span);
            float radius=length(samplePoint),height=max(0.0,radius-1.0);
            vec2 density=exp(-height/vec2(HR,HM));
            vec2 midpointDepth=depth+density*stepLength*0.5;
            float mu=dot(samplePoint/radius,sunDirection);
            float horizon=-sqrt(max(0.0,1.0-1.0/(radius*radius)));
            // Integrate the visibility across this interval instead of sampling a
            // hard shadow at its midpoint (which produced six visible bands).
            float radial=dot(samplePoint/radius,ray);
            float shadowSlope=abs((dot(ray,sunDirection)-mu*radial)/radius)
              +abs(radial)/max(0.01,radius*radius*radius*(-horizon));
            float shadowWidth=0.00465+min(0.045,0.5*stepLength*shadowSlope);
            float sunlightFraction=smoothstep(horizon-shadowWidth,horizon+shadowWidth,mu);
            {
              vec2 sunlight=vec2(column(height,mu,HR),column(height,mu,HM));
              vec3 transmittance=exp(-BR*(midpointDepth.x+sunlight.x)-BM*(midpointDepth.y+sunlight.y));
              light+=sunlightFraction*transmittance*(BR*density.x*phaseR+BM*density.y*phaseM)*stepLength;
            }
            depth+=density*stepLength;
          }
          vec3 extinction=exp(-BR*depth.x-BM*depth.y);
          float alpha=clamp(1.0-dot(extinction,vec3(0.333333)),0.0,0.85);
          vec3 radiance=vec3(1.0)-exp(-light*2.8);
          // Bound straight-alpha color before display conversion, preventing
          // radiance/alpha from producing an overexposed rim. The smooth weight
          // scales opacity only, leaving the limb hue stable as it fades.
          vec3 color=clamp(radiance/max(alpha,0.001),0.0,1.0);
          float litFade=smoothstep(0.0,0.003,max(radiance.r,max(radiance.g,radiance.b)));
          alpha*=surfaceStrength*litFade;
          if(alpha<=0.00001)discard;
          gl_FragColor=vec4(color,alpha);
          #include <colorspace_fragment>
        }`}/>
  </mesh></group>
}
