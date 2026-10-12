/** Bounded probing compares bytes per wall-clock second at 4/6/8 requests. */
export class AdaptiveDownloads {
 limit=4;private successes=0;private bytes=0;private started=0;private trials=new Map<number,number>();private settled=false;private blockedUntil=0
 get pauseUntil(){return this.blockedUntil}
 success(bytes:number,now:number){
  if(!this.started)this.started=now
  this.bytes+=bytes;this.successes++
  if(this.successes<24||this.settled)return
  const rate=this.bytes/Math.max(.001,(now-this.started)/1000);this.trials.set(this.limit,rate)
  if(this.limit<8)this.limit+=2;else{this.limit=[...this.trials].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0][0];this.settled=true}
  this.started=now;this.bytes=0;this.successes=0
 }
 failure(now:number,retryMs=0){this.limit=Math.max(2,this.limit-2);this.settled=false;this.successes=0;this.bytes=0;this.started=now;this.trials.clear();this.blockedUntil=Math.max(this.blockedUntil,now+retryMs)}
}
export function retryDelay(attempt:number,retryAfter:string|null,now=Date.now()) {
 const parsed=retryAfter===null?0:Number.isFinite(Number(retryAfter))?Number(retryAfter)*1000:Date.parse(retryAfter)-now
 return Math.max(Math.min(60000,1000*2**Math.min(attempt,6)),Number.isFinite(parsed)?Math.max(0,parsed):0)
}

/** Do not start detail that crosses the view faster than a response can arrive.
 * This limits new work only; the final view and saved textures retain full quality. */
export function motionDetailLevel(rootSpanDegrees:number,maxLevel:number,speed:number,responseMs:number,moving:boolean) {
 if(!moving||speed<0.02)return maxLevel
 const dwell=Math.max(0.12,Math.min(3,responseMs/1000))*1.8
 return Math.max(4,Math.min(maxLevel,Math.floor(Math.log2(rootSpanDegrees*Math.PI/180/Math.max(.0001,speed*dwell)))))
}

/** The point and its timestamp always advance together, independently of idle frames. */
export class MotionObservation {
 private point:{x:number;y:number;z:number};private distance:number;private pointAt:number;private speedAt:number;speed=0
 constructor(point:{x:number;y:number;z:number},distance:number,now:number){this.point={...point};this.distance=distance;this.pointAt=now;this.speedAt=now}
 observe(point:{x:number;y:number;z:number},distance:number,now:number){
  const dt=Math.max(.001,(now-this.pointAt)/1000),dot=this.point.x*point.x+this.point.y*point.y+this.point.z*point.z
  const rate=Math.max(Math.acos(Math.max(-1,Math.min(1,dot)))/dt,Math.abs(Math.log(distance/this.distance))/dt)
  const alpha=1-Math.exp(-Math.max(0,now-this.speedAt)/80)
  this.speed=this.speed*(1-alpha)+rate*alpha;this.point={...point};this.distance=distance;this.pointAt=now;this.speedAt=now;return this.speed
 }
 decay(now:number){this.speed*=Math.exp(-Math.max(0,now-this.speedAt)/100);this.speedAt=now;return this.speed}
}
