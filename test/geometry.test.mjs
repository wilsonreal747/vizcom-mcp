import test from 'node:test';
import assert from 'node:assert/strict';
import {bounds,fromTopLeft,contains,overlaps} from '../src/geometry.mjs';
test('Vizcom center coordinates and Y-up containment prevent frame escape',()=>{
 const frame=fromTopLeft(100,0,1000,500);assert.deepEqual(frame,{x:600,y:-250,width:1000,height:500});
 assert.deepEqual(bounds(frame),{left:100,right:1100,top:0,bottom:-500});
 assert.equal(contains(frame,{x:600,y:-250,width:800,height:300},50),true);
 assert.equal(contains(frame,{x:1050,y:-250,width:200,height:100}),false);
 assert.equal(contains(frame,{x:600,y:0,width:100,height:100}),false);
 assert.equal(overlaps(frame,fromTopLeft(1300,0,500,500)),false);
});
