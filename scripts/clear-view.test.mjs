import test from 'node:test'
import assert from 'node:assert/strict'
import { Matrix4, PerspectiveCamera, Raycaster, Sphere, Vector2, Vector3 } from 'three'
import { selectClearView } from '../src/imagery/view.ts'
import { surfacePoint,tileBounds,validTile } from '../src/imagery/tiles.ts'
for(const [lon,lat,distance,width,height]of [[105,0,3.8,3200,1900],[116,37,1.5,3200,1960],[-179,20,1.5,2560,1600],[80,85,3.8,2560,1600],[0,-85,8,1080,1920]]) {
  test('Visible image density and coverage at '+[lon,lat,distance,width,height].join('/'),()=>{
    const camera=new PerspectiveCamera(45,width/height,0.1,100);camera.position.set(...surfacePoint(lon,lat)).multiplyScalar(distance);camera.lookAt(0,0,0);camera.updateMatrixWorld()
    const view=selectClearView(camera,new Matrix4(),width,height,'eox')
    assert.equal(view.limited,false);assert.ok(view.tiles.length<=640);assert.ok(view.maxTexelRatio<=0.9);assert.ok(view.tiles.every(id=>validTile(id,'eox')))
    const bounds=view.tiles.map(id=>tileBounds(id,'eox')),ray=new Raycaster(),sphere=new Sphere(new Vector3(),1)
    for(let y=-0.95;y<=0.95;y+=0.1)for(let x=-0.95;x<=0.95;x+=0.1){
      ray.setFromCamera(new Vector2(x,y),camera)
      const p=ray.ray.intersectSphere(sphere,new Vector3());if(!p)continue
      const longitude=Math.atan2(-p.z,p.x)*180/Math.PI,latitude=Math.asin(p.y)*180/Math.PI
      assert.ok(bounds.some(b=>longitude>=b.west-1e-8&&longitude<=b.east+1e-8&&latitude>=b.south-1e-8&&latitude<=b.north+1e-8),'Missing surface at '+longitude+'/'+latitude)
    }
  })
}
test('Insufficient detail budget must refuse the view rather than declare a blurry result ready',()=>{
  const camera=new PerspectiveCamera(45,1.6,0.1,100);camera.position.set(...surfacePoint(116,37)).multiplyScalar(1.5);camera.lookAt(0,0,0)
  const view=selectClearView(camera,new Matrix4(),3200,2000,'eox',true,4)
  assert.equal(view.limited,true);assert.ok(view.maxTexelRatio>0.9)
})
