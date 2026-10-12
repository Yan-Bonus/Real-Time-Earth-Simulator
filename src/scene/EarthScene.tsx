import {traceRender} from '../engine/renderTrace'
import CosmicBackground, { type CosmicOptions } from './CosmicBackground'
import { simulationClock } from '../engine/time/simulation'
import { memo, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { NoToneMapping, Vector3, Quaternion } from 'three'
import RegionalImagery, { type OnlineStatus } from './RegionalImagery'
import RotatingEarth, { type SceneDiagnostics } from './RotatingEarth'
import EarthGuides from './EarthGuides'
import SolarEffects, { type SolarOptions } from './SolarEffects'
import { solarPosition } from '../engine/astronomy/solar'
import { earthRotationAngle } from '../engine/astronomy/rotation'
import { surfacePoint, type ImagerySource } from '../imagery/tiles'
import { renderPixelRatio } from '../imagery/quality'

import CityLayer, {CityMarkers} from './CityLayer'
import type {City} from '../cities/catalog'
import {isWindowActive} from '../engine/windowActivity'
export interface CityFocus {city:City;token:number}
function geographicView(lon:number,lat:number,distance:number):[number,number,number] {
  return new Vector3(...surfacePoint(lon,lat)).applyAxisAngle(new Vector3(0,1,0),earthRotationAngle(simulationClock.now())).multiplyScalar(distance).toArray()
}
function RenderQuality({highest,onRatio}:{highest:boolean;onRatio:(ratio:number)=>void}) {
  const {gl,size,setDpr,invalidate}=useThree()
  useEffect(()=>{
    const viewport=gl.getContext().getParameter(gl.getContext().MAX_VIEWPORT_DIMS) as Int32Array
    const ratio=renderPixelRatio(window.devicePixelRatio,highest,size.width,size.height,Math.min(viewport[0],viewport[1],gl.capabilities.maxTextureSize))
    setDpr(ratio);onRatio(ratio);invalidate()
  },[gl,size.width,size.height,highest,setDpr,invalidate,onRatio])
  return null
}
function CameraControls({resetToken,regionToken,sunToken,hasView,cityFocus,returnToken,onReturnAvailable}:{resetToken:number;regionToken:number;sunToken:number;hasView:boolean;cityFocus:CityFocus|null;returnToken:number;onReturnAvailable:(available:boolean)=>void}) {
  const controls=useRef<ComponentRef<typeof OrbitControls>>(null)
  const {camera,invalidate,gl}=useThree()
  const flight=useRef<{start:Vector3;distance:number;elapsed:number;last:number;city:Pick<City,'longitude'|'latitude'>;endDistance:number}|null>(null)
  const previousView=useRef<{longitude:number;latitude:number;distance:number}|null>(null),lastCity=useRef<string|null>(null)
  const clearPrevious=useCallback(()=>{previousView.current=null;lastCity.current=null;onReturnAvailable(false)},[onReturnAvailable])
  const scratch=useRef({end:new Vector3(),rotation:new Quaternion(),identity:new Quaternion()})
  const stop=useCallback(()=>{if(flight.current){flight.current=null;gl.domElement.setAttribute('data-city-focus','canceled');if(controls.current)controls.current.enableDamping=true}},[gl])
  useEffect(()=>{const control=controls.current;if(!control)return;const start=()=>stop();control.addEventListener('start',start);return()=>control.removeEventListener('start',start)},[stop,hasView])
  useEffect(()=>{if(!cityFocus){stop();lastCity.current=null;return}stop();if(lastCity.current!==cityFocus.city.id){const position=camera.position.clone().applyAxisAngle(new Vector3(0,1,0),-earthRotationAngle(simulationClock.now())),distance=position.length();previousView.current={longitude:Math.atan2(-position.z,position.x)*180/Math.PI,latitude:Math.asin(position.y/distance)*180/Math.PI,distance};lastCity.current=cityFocus.city.id;onReturnAvailable(true)}const control=controls.current;if(control){control.enableDamping=false;control.update()}flight.current={start:camera.position.clone().normalize(),distance:camera.position.length(),elapsed:0,last:performance.now(),city:cityFocus.city,endDistance:1.5};gl.domElement.setAttribute('data-city-focus','moving');invalidate()},[cityFocus,stop,camera,invalidate,gl,onReturnAvailable])
  useEffect(()=>{if(!returnToken||!previousView.current)return;const view=previousView.current;stop();const control=controls.current;if(control){control.enableDamping=false;control.update()}flight.current={start:camera.position.clone().normalize(),distance:camera.position.length(),elapsed:0,last:performance.now(),city:view,endDistance:view.distance};clearPrevious();gl.domElement.setAttribute('data-city-focus','moving');invalidate()},[returnToken,stop,camera,invalidate,gl,clearPrevious])
  useFrame(()=>{const move=flight.current;if(!move||!isWindowActive())return;const now=performance.now();move.elapsed+=Math.min(50,now-move.last);move.last=now;const t=Math.min(1,move.elapsed/950),e=t*t*(3-2*t),s=scratch.current;s.end.set(...geographicView(move.city.longitude,move.city.latitude,1)).normalize();s.rotation.setFromUnitVectors(move.start,s.end);s.identity.identity().slerp(s.rotation,e);camera.position.copy(move.start).applyQuaternion(s.identity).multiplyScalar(move.distance+(move.endDistance-move.distance)*e);camera.lookAt(0,0,0);controls.current?.target.set(0,0,0);controls.current?.update();if(t===1){flight.current=null;gl.domElement.setAttribute('data-city-focus','idle');if(controls.current)controls.current.enableDamping=true}else invalidate()},-1.5)
  const moveTo=useCallback((lon:number,lat:number,distance:number)=>{
    stop()
    const control=controls.current
    // Flush remaining gesture inertia before an explicit reset/region jump.
    if(control){control.enableDamping=false;control.update()}
    camera.position.set(...geographicView(lon,lat,distance));control?.target.set(0,0,0);control?.update()
    if(control)control.enableDamping=true
    invalidate()
  },[camera,invalidate,stop])
  useEffect(()=>{clearPrevious();moveTo(105,0,3.8)},[resetToken,moveTo,clearPrevious])
  useEffect(()=>{if(regionToken){clearPrevious();moveTo(116,37,1.5)}},[regionToken,moveTo,clearPrevious])
  useEffect(()=>{if(sunToken){clearPrevious();const sun=solarPosition(simulationClock.now());moveTo(sun.longitude,sun.latitude,3.8)}},[sunToken,moveTo,clearPrevious])
  useEffect(()=>{
    // A cancelable event lets native fullscreen Escape use the same cancellation path.
    const cancel=(event:Event)=>{if(flight.current){event.preventDefault();stop()}}
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('#viewer-settings')&&flight.current){event.preventDefault();stop()}}
    window.addEventListener('earth:cancel-flight',cancel);window.addEventListener('keydown',escape)
    return()=>{window.removeEventListener('earth:cancel-flight',cancel);window.removeEventListener('keydown',escape)}
  },[camera,gl,hasView,stop])
  // Camera input never waits for the network. The complete online globe covers every direction.
  return <OrbitControls onChange={()=>traceRender('camera.change')} ref={controls} enabled={hasView} enablePan={false} enableDamping dampingFactor={0.12} zoomSpeed={0.8} minDistance={1.5} maxDistance={8}/>
}
function EarthScene({resetToken,regionToken,onRegionStatus,axis,equator,grid,onDiagnostics,source,highest,retryToken,solar,sunToken,cosmic,cities,selectedCity,cityFocus,onSelectCity,returnToken,onReturnAvailable}:{
  returnToken:number;onReturnAvailable:(available:boolean)=>void;cities:boolean;selectedCity:City|null;cityFocus:CityFocus|null;onSelectCity:(city:City)=>void
  cosmic:CosmicOptions;solar:SolarOptions;sunToken:number;source:ImagerySource;highest:boolean;retryToken:number;resetToken:number;regionToken:number;onRegionStatus:(status:OnlineStatus)=>void;axis:boolean;equator:boolean;grid:boolean;onDiagnostics?:(value:SceneDiagnostics)=>void
}) {
  useEffect(()=>traceRender('scene.reactCommit'))
  const [pixelRatio,setPixelRatio]=useState(1),[hasView,setHasView]=useState(false)
  const [cameraOptions]=useState(()=>({position:geographicView(105,0,3.8),fov:45,near:0.1,far:100}))
  const cityLayer=useRef<HTMLDivElement>(null)
  const onUsable=useCallback(()=>setHasView(true),[])
  return <div className="scene" aria-label="3D 地球预览">
    <Canvas frameloop="demand" dpr={pixelRatio} gl={{toneMapping:NoToneMapping}} camera={cameraOptions} fallback={<p className="scene-fallback" role="alert">当前设备无法启用 3D 渲染，请检查显卡驱动。</p>}>
      <color attach="background" args={['#080e19']}/>
      <CosmicBackground options={cosmic}/>
      <RenderQuality highest={highest} onRatio={setPixelRatio}/>
      <RotatingEarth onDiagnostics={onDiagnostics}>
        <RegionalImagery source={source} highest={highest} pixelRatio={pixelRatio} retryToken={retryToken} onStatus={onRegionStatus} onUsable={onUsable}/>
        <SolarEffects options={solar}/>
        <CityLayer layer={cityLayer} enabled={hasView&&cities} selected={selectedCity} onSelect={onSelectCity}/>
        <EarthGuides axis={hasView&&axis} equator={hasView&&equator} grid={hasView&&grid}/>
      </RotatingEarth>
      <CameraControls resetToken={resetToken} regionToken={regionToken} sunToken={sunToken} hasView={hasView} cityFocus={cityFocus} returnToken={returnToken} onReturnAvailable={onReturnAvailable}/>
    </Canvas>
    <CityMarkers layer={cityLayer} selected={selectedCity} onSelect={onSelectCity}/>
  </div>
}

export default memo(EarthScene)
