import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGIN,INITIAL_GEOMETRY,geometryValues,changeGeometry,boundedPointer} from '../src/geometry-lab.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('2D geometry uses the approach chord and all three difficulty formulations',()=>{
 const s={x:300,y:ORIGIN.y-40,width:160,height:80},v=geometryValues(s);
 assert.equal(v.distance,344);assert.equal(v.width,160);close(v.shannon,Math.log2(1+344/160));close(v.fitts,Math.log2(2*344/160));close(v.welford,Math.log2(344/160+.5));
 const diagonal=geometryValues({...s,y:24,height:44});assert.notEqual(diagonal.width,44);assert.ok(diagonal.width<160);
 const taller=geometryValues({...s,y:24,height:160});assert.ok(taller.width>diagonal.width);
 const scaled=geometryValues({x:ORIGIN.x+2*(s.x-ORIGIN.x),y:ORIGIN.y+2*(s.y-ORIGIN.y),width:s.width*2,height:s.height*2});close(v.shannon,scaled.shannon);
});
test('2D dragging preserves dimensions; edge resizing anchors the opposite edge',()=>{
 const moved=changeGeometry(INITIAL_GEOMETRY,'target',20,-30);assert.equal(moved.x,350);assert.equal(moved.y,100);assert.equal(moved.width,140);assert.equal(moved.height,90);
 const left=changeGeometry(INITIAL_GEOMETRY,'left',40);assert.equal(left.x+left.width,470);
 const top=changeGeometry(INITIAL_GEOMETRY,'top',20,30);assert.equal(top.y+top.height,220);assert.equal(top.height,60);
 const corner=changeGeometry(INITIAL_GEOMETRY,'corner',30,40);assert.equal(corner.width,170);assert.equal(corner.height,130);
 for(const part of ['target','left','right','top','bottom','corner'])for(const delta of [-10000,10000]){
   const s=changeGeometry(INITIAL_GEOMETRY,part,delta,delta);assert.ok(s.x>=90&&s.y>=48);assert.ok(s.x+s.width<=570&&s.y+s.height<=282);assert.ok(s.width>=84&&s.height>=44);assert.ok(geometryValues(s).near>0);
 }
});
test('window edges constrain only their own axis, leaving finite geometry unchanged',()=>{
 const s=INITIAL_GEOMETRY,p={x:590,y:20};
 assert.deepEqual(boundedPointer(s,p),p);
 assert.deepEqual(boundedPointer({...s,topEdge:true},p),{x:590,y:130});
 assert.deepEqual(boundedPointer({...s,rightEdge:true},p),{x:470,y:20});
 const corner={...s,topEdge:true,rightEdge:true};
 assert.deepEqual(boundedPointer(corner,p),{x:470,y:130});
 assert.deepEqual(boundedPointer(corner,ORIGIN),ORIGIN);
 assert.deepEqual(boundedPointer(corner,{x:400,y:170}),{x:400,y:170});
 assert.deepEqual(geometryValues(corner),geometryValues(s));
 const moved=changeGeometry(corner,'target',20,-30);
 assert.deepEqual(boundedPointer(moved,p),{x:490,y:100});
 const resized=changeGeometry(corner,'corner',30,40);
 assert.deepEqual(boundedPointer(resized,p),{x:500,y:130});
 assert.equal(resized.topEdge,true);assert.equal(resized.rightEdge,true);
});
