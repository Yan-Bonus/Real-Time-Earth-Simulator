import {traceRender} from '../engine/renderTrace'
import { isWindowActive, subscribeActivity } from '../engine/windowActivity'
import { simulationClock, captureSimulationFrame } from '../engine/time/simulation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Group } from 'three'
import { earthRotationAngle } from '../engine/astronomy/rotation'
import { toJulianDate } from '../engine/time/clock'

export interface SceneDiagnostics {
  epoch: number; angleDegrees: number; julianDate: number; cameraDistance: number
  drawCalls: number; triangles: number; textures: number; geometries: number
  longitude: number; latitude: number; resolution: number; pixelRatio: number; renderHz: number
}

export default function RotatingEarth({ children, onDiagnostics }: {
  children: React.ReactNode; onDiagnostics?: (value: SceneDiagnostics) => void
}) {
  const earth = useRef<Group>(null)
  const [initialAngle] = useState(() => earthRotationAngle(simulationClock.now()))
  const lastReport = useRef({ time: 0, frame: 0 })
  const { gl, camera, invalidate } = useThree()
  useEffect(() => {
    let timer: number | undefined
    const schedule = () => {
      window.clearTimeout(timer)
      if (!isWindowActive()) return
      traceRender(simulationClock.rate===0?'time.wakeup':'time.timer');invalidate()
      if (simulationClock.rate !== 0 && Math.abs(simulationClock.rate) <= 1) {
        timer = window.setTimeout(schedule, 100)
      }
    }
    const unsubscribe = simulationClock.subscribe(schedule)
    window.addEventListener('focus', schedule)
    const unsubscribeActivity=subscribeActivity(schedule)
    schedule()
    return () => {
      window.clearTimeout(timer); unsubscribe()
      window.removeEventListener('focus', schedule)
      unsubscribeActivity()
    }
  }, [invalidate])
  useFrame(() => {
    // Uploads/settings can leave a demand frame pending after the native window hides.
    if (!isWindowActive()) return
    const epoch = captureSimulationFrame()
    if (isWindowActive() && Math.abs(simulationClock.rate) > 1){traceRender('time.playback');invalidate()}
    const angle = earthRotationAngle(epoch)
    if (earth.current) earth.current.rotation.y = angle
    const now = performance.now()
    if (onDiagnostics && now - lastReport.current.time >= 1000) {
      const localCamera=camera.position.clone().applyAxisAngle(new Vector3(0,1,0),-angle).normalize()
      onDiagnostics({
        longitude:Math.atan2(-localCamera.z,localCamera.x)*180/Math.PI,latitude:Math.asin(localCamera.y)*180/Math.PI,
        epoch, angleDegrees: angle * 180 / Math.PI, julianDate: toJulianDate(epoch), cameraDistance: camera.position.length(),
        drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles,
        textures: gl.info.memory.textures, geometries: gl.info.memory.geometries,
        resolution: gl.capabilities.maxTextureSize,
        pixelRatio: gl.getPixelRatio(), renderHz: (gl.info.render.frame - lastReport.current.frame) * 1000 / (now - lastReport.current.time),
      })
      lastReport.current = { time: now, frame: gl.info.render.frame }
    } else if (!onDiagnostics) lastReport.current = { time: now, frame: gl.info.render.frame }
  }, -2)
  return <group ref={earth} rotation={[0, initialAngle, 0]}><Suspense fallback={null}>{children}</Suspense></group>
}
