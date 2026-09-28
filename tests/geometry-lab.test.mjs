import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL_GEOMETRY,geometryValues,changeGeometry} from '../src/geometry-lab.js';
test('geometry readout derives centre distance and all indices from target endpoints',()=>{
 const v=geometryValues(INITIAL_GEOMETRY);assert.equal(v.distance,300);assert.equal(v.width,120);assert.equal(v.ratio,2.5);assert.equal(v.shannon,Math.log2(3.5));assert.equal(v.fitts,Math.log2(5));assert.equal(v.welford,Math.log2(3));
 const scaled=geometryValues({near:480,width:240});assert.equal(v.shannon,scaled.shannon);
});
test('moving preserves width; resizing the near edge preserves the far edge and positive width',()=>{
 const moved=changeGeometry(INITIAL_GEOMETRY,'target',100);assert.equal(moved.width,120);assert.equal(moved.near,340);
 const resized=changeGeometry(INITIAL_GEOMETRY,'near',50);assert.equal(resized.near+resized.width,360);assert.equal(resized.width,70);
 assert.equal(changeGeometry(INITIAL_GEOMETRY,'near',1000).width,1);
 assert.equal(changeGeometry(INITIAL_GEOMETRY,'target',-1000).near,0);
 assert.equal(changeGeometry(INITIAL_GEOMETRY,'far',-1000).width,1);
});
test('unbounded target uses algebraic limits and can still move its near edge',()=>{
 const state={...INITIAL_GEOMETRY,unbounded:true},v=geometryValues(state);assert.equal(v.distance,Infinity);assert.equal(v.width,Infinity);assert.equal(v.ratio,.5);assert.equal(v.shannon,Math.log2(1.5));assert.equal(v.fitts,0);assert.equal(v.welford,0);
 assert.equal(changeGeometry(state,'near',1000).near,1240);
});
