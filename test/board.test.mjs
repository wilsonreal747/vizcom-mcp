import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BoardClient} from '../src/board.mjs';
test('shared-board stale timestamp stops before mutation and successful layout journals undo',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'vizcom-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const b={id:'board',isEditable:true,drawings:{nodes:[{id:'image',x:4,y:5,updatedAt:'now'}]}};let mutations=0;
 const api={operation:async(name,v)=>{if(name==='workbenchContent')return {workbench:b};mutations++;Object.assign(b.drawings.nodes[0],v.input.newElementData[0]);return {};}};
 const c=new BoardClient(api,dir);
 await assert.rejects(c.layout({workbenchId:'board',changes:[{id:'image',x:50,expectedUpdatedAt:'old'}]}),/NODE_CHANGED/);assert.equal(mutations,0);
 const r=await c.layout({workbenchId:'board',changes:[{id:'image',x:50,expectedUpdatedAt:'now'}]});assert.equal(r.verified,true);
 const j=JSON.parse(await readFile(r.journal));assert.deepEqual(j.restore,[{id:'image',x:4}]);
});
test('failed board batch has durable output ids and is never retried',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'vizcom-'));t.after(()=>rm(dir,{recursive:true,force:true}));let calls=0;
 const b={isEditable:true,magicPrompts:{nodes:[{id:'node',customPromptData:{promptText:'keep proportions'},sourceDrawings:{edges:[{sortOrder:1,node:{id:'two'}},{sortOrder:0,node:{id:'one'}}]}}]}};
 const api={operation:async(name,v)=>{if(name==='workbenchContent')return {workbench:b};calls++;assert.deepEqual(v.input.sourceDrawingIds,['one','two']);assert.equal(v.input.placeholders.length,2);throw Error('REQUEST_UNCERTAIN');}};
 const c=new BoardClient(api,dir);
 await assert.rejects(c.generate({workbenchId:'board',nodeId:'node',count:2,x:0,y:0}),/outputIds=.*do not resubmit/);assert.equal(calls,1);
 await assert.rejects(c.generate({count:5}),/BATCH_COUNT/);assert.equal(calls,1);
});
