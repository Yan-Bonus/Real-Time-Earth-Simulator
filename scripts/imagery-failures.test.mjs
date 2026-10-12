import test from 'node:test'
import assert from 'node:assert/strict'
import {blockingFailure,httpFailure,classifyFailure,failureMessage,failureDelay,affectsThroughput,sharedRetryDelay,TileFailure} from '../src/imagery/failures.ts'
const target={source:'eox',id:{z:6,row:20,col:104}},parent='eox/4/5/26'
test('An unrequested target reports its failed required ancestor, without prefetch false positives',()=>{
 assert.equal(blockingFailure([target],()=>false,k=>k===parent),parent)
 assert.equal(blockingFailure([target],()=>false,k=>k==='eox/4/5/27'),undefined)
 assert.equal(blockingFailure([target],k=>k==='eox/5/10/52',k=>k===parent),undefined)
 assert.equal(blockingFailure([target],k=>k==='eox/6/20/104',()=>true),undefined)
})
test('Retry-After and distinct errors survive classification, with transport-only downgrade',()=>{
 for(const [status,kind] of [[429,'rate-limit'],[503,'service'],[404,'not-found'],[500,'http']]){const f=httpFailure(status,'30');assert.equal(classifyFailure(f).kind,kind);assert.equal(failureDelay(f,3),30000);assert.match(failureMessage(f),new RegExp(String(status)))}
 assert.equal(classifyFailure(Object.assign(Error('timeout'),{name:'TimeoutError'})).kind,'timeout')
 assert.equal(classifyFailure(Object.assign(Error('cancel'),{name:'AbortError'})).kind,'canceled')
 assert.equal(affectsThroughput(new TileFailure('invalid')),false);assert.equal(affectsThroughput(httpFailure(404,null)),false);assert.equal(affectsThroughput(httpFailure(429,null)),true)
})

import {MotionObservation} from '../src/imagery/scheduling.ts'
test('Idle frames do not shorten the displacement observation interval',()=>{
 const m=new MotionObservation({x:1,y:0,z:0},3.8,0);for(let t=10;t<1000;t+=10)m.decay(t)
 const measured=m.observe({x:Math.cos(.01),y:Math.sin(.01),z:0},3.8,1000)
 assert.ok(measured<.011,'One second of movement must not be divided by one frame')
 assert.ok(measured>0)
 const zoom=new MotionObservation({x:1,y:0,z:0},3.8,0);zoom.observe({x:1,y:0,z:0},3.8*Math.exp(.1),1000);assert.ok(Math.abs(zoom.speed-.1)<.001)
 for(const rate of [.004375,-.004375,.2625,-.2625]){const x=new MotionObservation({x:1,y:0,z:0},3.8,0);for(let t=10;t<=1000;t+=10)x.observe({x:Math.cos(rate*t/1000),y:Math.sin(rate*t/1000),z:0},3.8,t);assert.ok(Math.abs(x.speed-Math.abs(rate))<.0001);x.decay(2000);assert.ok(x.speed<.0001)}
})

test('An ordinary failed prefetch cannot pause useful requests, while 429/503 retain service retry delay',()=>{
 for(const kind of ['network','timeout','invalid','canceled'])assert.equal(sharedRetryDelay(new TileFailure(kind),30000),0)
 for(const status of [429,503]){const f=httpFailure(status,'30');assert.equal(sharedRetryDelay(f,failureDelay(f,3)),30000)}
})

import {loadingPhase} from '../src/imagery/failures.ts'
test('Necessary failures override limited; stale source and moving views cannot report ready',()=>{assert.equal(loadingPhase(true,true,true,false,false),'error');assert.equal(loadingPhase(true,false,true,false,false),'limited');assert.equal(loadingPhase(true,false,false,true,false,false),'loading');assert.equal(loadingPhase(true,false,false,true,true),'loading');assert.equal(loadingPhase(true,false,false,true,false),'ready')})
