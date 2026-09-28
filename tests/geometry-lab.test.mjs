import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGIN,INITIAL_GEOMETRY,geometryValues,changeGeometry} from '../src/geometry-lab.js';
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
   const s=changeGeometry(INITIAL_GEOMETRY,part,delta,delta);assert.ok(s.x>=90&&s.y>=24);assert.ok(s.x+s.width<=570&&s.y+s.height<=282);assert.ok(s.width>=84&&s.height>=44);assert.ok(geometryValues(s).near>0);
 }
});
test('extension uses limits along the approach and retains the finite rectangle',()=>{
 const state={...INITIAL_GEOMETRY,unbounded:true},v=geometryValues(state);assert.equal(v.distance,Infinity);assert.equal(v.width,Infinity);assert.equal(v.ratio,.5);assert.equal(v.shannon,Math.log2(1.5));assert.equal(v.fitts,0);assert.equal(v.welford,0);
 assert.deepEqual(changeGeometry(state,'target',100,100),state);assert.equal(v.near,geometryValues(INITIAL_GEOMETRY).near);
});
