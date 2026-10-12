import { MeshBasicMaterial, type Texture } from 'three'
import { solarUniforms } from './solarUniforms'

/** Direct source imagery; visual night lift keeps navigation readable. */
export function earthMaterial(map: Texture) {
  const material = new MeshBasicMaterial({map, toneMapped:false})
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, solarUniforms)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 earthNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nearthNormal=normal;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 earthNormal; uniform vec3 sunDirection; uniform float daylightEnabled; uniform float atmosphereEnabled;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float incidence=dot(normalize(earthNormal),sunDirection);
        // The old bright plateau at the horizon flattened the sphere. Direct
        // illumination now falls continuously to zero at the geometric horizon.
        float direct=pow(max(incidence,0.0),0.82);
        float sky=0.028*smoothstep(-0.10,0.16,incidence)*atmosphereEnabled;
        float illumination=0.036+0.964*direct+sky;
        float airMass=1.0/max(0.09,incidence+0.025);
        vec3 transmission=exp(-vec3(0.047,0.109,0.267)*airMass);
        vec3 sunsetTint=mix(vec3(1.0),mix(vec3(0.70),transmission,0.65),
          atmosphereEnabled*(1.0-smoothstep(0.0,0.32,incidence))*smoothstep(0.0,0.06,incidence));
        diffuseColor.rgb*=mix(vec3(1.0),illumination*sunsetTint,daylightEnabled);`)
  }
  material.customProgramCacheKey=()=> 'earth-solar-daynight-v02-natural-v3'
  return material
}
