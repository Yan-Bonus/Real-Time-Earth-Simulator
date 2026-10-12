import test from 'node:test'
import assert from 'node:assert/strict'
import {solarPosition} from '../src/engine/astronomy/solar.ts'
const sun=date=>solarPosition(Date.parse(date))
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0)
test('Solar declination follows equinoxes and solstices independently of the camera',()=>{
 for(const date of ['2026-03-20T14:46Z','2026-09-23T00:05Z'])assert.ok(Math.abs(sun(date).latitude)<0.1)
 assert.ok(Math.abs(sun('2026-06-21T08:25Z').latitude-23.44)<0.03)
 assert.ok(Math.abs(sun('2026-12-21T20:50Z').latitude+23.44)<0.03)
})
test('Solar noon includes equation of time; subsolar longitude moves west with UTC',()=>{
 const noon=sun('2026-10-01T12:00Z');assert.ok(Math.abs(noon.longitude+2.58)<0.05)
 const next=sun('2026-10-01T12:01Z');assert.ok(Math.abs((next.longitude-noon.longitude)+0.25)<0.002)
 assert.ok(Math.abs(sun('2026-10-01T00:00Z').longitude)>175)
})
test('Earth-fixed vectors are unit length; ecliptic normal gives physical axial tilt',()=>{
 for(let month=1;month<=12;month++){
  const s=solarPosition(Date.UTC(2026,month-1,15,3))
  assert.ok(Math.abs(dot(s.direction,s.direction)-1)<1e-12)
  assert.ok(Math.abs(dot(s.eclipticNormal,s.eclipticNormal)-1)<1e-12)
  assert.ok(Math.abs(dot(s.direction,s.eclipticNormal))<0.00015)
  assert.ok(Math.abs(Math.acos(s.eclipticNormal[1])*180/Math.PI-s.obliquity)<1e-10)
  assert.ok(s.longitude>=-180&&s.longitude<180)
 }
 assert.throws(()=>solarPosition(NaN),RangeError)
})
test('Subsolar, antipodal and terminator points give day, night and zero incidence',()=>{
 const s=sun('2026-10-01T00:00Z'),t=[-s.direction[2],0,s.direction[0]]
 assert.ok(dot(s.direction,s.direction)>.999)
 assert.ok(dot(s.direction,s.direction.map(n=>-n))<-.999)
 assert.ok(Math.abs(dot(s.direction,t))<1e-12)
})
