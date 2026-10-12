import test from 'node:test'
import assert from 'node:assert/strict'
import { SimulationClock } from '../src/engine/time/simulation.ts'
test('pause, speed and reverse keep one continuous instant independent of wall changes', () => {
 let wall=100000, tick=0; const clock=new SimulationClock(()=>wall,()=>tick)
 clock.setRate(0); tick+=500; wall+=900000; assert.equal(clock.now(),100000)
 clock.setRate(60); tick+=1000; assert.equal(clock.now(),160000)
 clock.setRate(-60); assert.equal(clock.now(),160000); tick+=1000; assert.equal(clock.now(),100000)
 clock.reset(); assert.equal(clock.now(),wall); assert.equal(clock.isRealTime,true)
})
test('invalid rates cannot poison the timeline', () => {
 const clock=new SimulationClock(()=>0,()=>0)
 for(const value of [NaN,Infinity,3601]) assert.throws(()=>clock.setRate(value),RangeError)
 assert.equal(clock.now(),0)
})

test('resume retains backward multiplier and switches remain continuous', () => {
 let tick=0; const clock=new SimulationClock(()=>Date.UTC(2026,9,5),()=>tick)
 clock.setRate(-3600);tick=1000;const epoch=clock.now()
 clock.pause();tick=5000;assert.equal(clock.now(),epoch)
 clock.resume();assert.equal(clock.rate,-3600);assert.equal(clock.now(),epoch)
 tick=6000;assert.equal(clock.now(),epoch-3600000)
 clock.setRate(60);assert.equal(clock.now(),epoch-3600000)
 tick=7000;assert.equal(clock.now(),epoch-3540000)
 clock.reset();clock.pause();clock.resume();assert.equal(clock.rate,1)
})

import {parseUTCDate, seasonalDate} from '../src/engine/time/exploration.ts'
import {MIN_EPOCH, MAX_EPOCH} from '../src/engine/time/simulation.ts'
test('UTC dates validate leap days, bounds and malformed input', () => {
 assert.equal(parseUTCDate('2024-02-29T12:30'),Date.UTC(2024,1,29,12,30))
 for(const value of ['2023-02-29T12:00','1899-12-31T23:59','2101-01-01T00:00','2026-01-01',''])assert.throws(()=>parseUTCDate(value),RangeError)
 for(let i=0;i<4;i++)assert.equal(new Date(seasonalDate(2026,i)).getUTCHours(),12)
 assert.throws(()=>seasonalDate(2101,0),RangeError)
 assert.throws(()=>seasonalDate(2026,4),RangeError)
})
test('date jumps retain multiplier and boundary pauses retain direction', () => {
 let tick=0;const clock=new SimulationClock(()=>Date.UTC(2026,9,5),()=>tick)
 clock.setRate(-3600);clock.pause();clock.setDate(MIN_EPOCH+3600000);clock.resume()
 tick=2000;clock.stopAtBoundary();assert.equal(clock.rate,0);assert.equal(clock.now(),MIN_EPOCH)
 assert.equal(clock.resumeRate,-3600)
 clock.setDate(MAX_EPOCH-3600000);clock.setRate(3600);tick=4000;clock.stopAtBoundary()
 assert.equal(clock.now(),MAX_EPOCH);assert.equal(clock.rate,0)
 assert.throws(()=>clock.setDate(NaN),RangeError)
})

test('Paused direction and multiplier edits change the remembered rate without advancing time',()=>{
 let tick=0;const c=new SimulationClock(()=>Date.UTC(2026,0,1),()=>tick)
 c.setRate(-3600);tick=10;c.pause();const epoch=c.now()
 c.setPlaybackRate(60);tick=10000;assert.equal(c.rate,0);assert.equal(c.now(),epoch)
 assert.equal(c.resumeRate,60);c.resume();assert.equal(c.rate,60);assert.equal(c.now(),epoch)
 c.setPlaybackRate(-1);assert.equal(c.now(),epoch);assert.equal(c.rate,-1)
})
