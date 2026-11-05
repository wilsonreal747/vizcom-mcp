import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {AssetClient} from '../src/assets.mjs';
import {BoardClient,summarize,noteHTML} from '../src/board.mjs';

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'vizcom-assets-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const board={id:'board',isEditable:true,drawings:{nodes:[{id:'source',__typename:'Drawing',x:0,y:0,updatedAt:'now',drawingWidth:640,drawingHeight:360,workbenchSizeRatio:1,thumbnailPath:'https://files.vizcom.com/test.png'}]},stickyNotes:{nodes:[]},sections:{nodes:[]},magicPrompts:{nodes:[]}};
 const calls=[],assets=new Map();
 const api={operation:async(name,v)=>{
  calls.push({name,v});
  if(name==='workbenchContent')return {workbench:board};
  if(name==='CreateWorkbenchImage'){const a={...v.input.workbenchAssetImage,updatedAt:'now',userByCreatedBy:{email:'private@example.test'}};assets.set(a.id,a);return {createWorkbenchAssetImage:{workbenchAssetImage:a}};}
  if(name==='workbenchAssetImageById')return {workbenchAssetImage:assets.get(v.id)};
  if(name==='CreateDrawings'){board.drawings.nodes.push(...v.input.map(n=>({...n,__typename:'Drawing',drawingWidth:n.width,drawingHeight:n.height,updatedAt:'now'})));return {createDrawings:{drawings:v.input}};}
  if(name==='CreateWorkbenchElements'){board.stickyNotes.nodes.push(...v.createWorkbenchElementsStickyNoteInput.map(n=>({...n,__typename:'WorkbenchElementStickyNote',updatedAt:'now'})));return {};}
  if(name==='UpdateWorkbenchElementStickyNote'){Object.assign(board.stickyNotes.nodes.find(n=>n.id===v.input.id),v.input.patch);return {};}
  if(name==='updateWorkbenchElementMagicPromptWithDrawings'){board.magicPrompts.nodes[0].sourceDrawings={edges:v.input.sources.map((s,sortOrder)=>({sortOrder,node:{id:s.drawingId}}))};return {};}
  throw Error('unexpected '+name);
 },download:async(url,file)=>{const path=file.replace(/\.png$/,'.webp');await sharp({create:{width:640,height:360,channels:3,background:'white'}}).webp().toFile(path);return {path};}};
 const b=new BoardClient(api,dir),a=new AssetClient(api,b);return {dir,board,api,b,a,calls,assets};
}
test('asset scope paths, pagination and folder filters remain explicit',async()=>{
 const calls=[],page={nodes:[{id:'asset',name:'base',imagePath:'url'}],pageInfo:{hasNextPage:true,endCursor:'next'}};
 const api={operation:async(name,v)=>{calls.push({name,v});const c={id:'container',folderAssetImages:page,workbenchAssetImages:page,folderAssetFolders:page};return {workbench:{...c,team:{rootFolder:c},folder:{organization:{currentUserDraftFolder:c,globalTeam:{rootFolder:c}}}}};}};
 const a=new AssetClient(api,{});
 for(const scope of ['workbench','personal','organization','team']){const r=await a.list({workbenchId:'b',scope,after:'cursor'});assert.equal(r.items[0].id,'asset');assert.equal(r.pageInfo.endCursor,'next');assert.deepEqual(calls.at(-1).v.assetFolderFilter,{});assert.equal(calls.at(-1).v.after,'cursor');}
 await a.list({workbenchId:'b',assetFolderId:null});assert.deepEqual(calls.at(-1).v.assetFolderFilter,{isNull:true});
 await a.list({workbenchId:'b',scope:'personal',assetFolderId:'folder'},true);assert.deepEqual(calls.at(-1).v.parentFilter,{equalTo:'folder'});
 api.operation=async()=>({workbench:{id:'b',team:null}});assert.equal((await a.list({workbenchId:'b',scope:'team'})).available,false);
});
test('save snapshot creates distinct asset, excludes creator PII, retries use receipt',async t=>{
 const {a,calls,assets}=await fixture(t),args={workbenchId:'board',drawingId:'source',name:'Base V01',version:'V01',requestId:randomUUID()};
 const saved=await a.save(args);assert.equal(saved.verified,true);assert.equal(saved.asset.userByCreatedBy,undefined);assert.equal(saved.metadata.representation,'board-preview');
 assert.equal((await a.save({...args})).reusedReceipt,true);assert.equal(calls.filter(c=>c.name==='CreateWorkbenchImage').length,1);
 await assert.rejects(a.save({...args,name:'different'}),/DIFFERENT_ARGUMENTS/);
 const second=await a.save({...args,name:'Base V02',version:'V02',parentAsset:{assetId:saved.asset.id,storage:'workbench'},requestId:randomUUID()});assert.notEqual(second.asset.id,saved.asset.id);assert.equal(assets.size,2);
});
test('uncertain asset creation is never submitted twice and has durable recovery ID',async t=>{
 const {a,api,dir}=await fixture(t),orig=api.operation;let mutations=0;
 api.operation=async(n,v)=>{if(n==='CreateWorkbenchImage'){mutations++;throw Error('timeout');}return orig(n,v);};
 const args={workbenchId:'board',drawingId:'source',name:'Base',version:'V1',requestId:randomUUID()};
 await assert.rejects(a.save(args),/recoveryId=.*do not resubmit/);await assert.rejects(a.save(args),/PREVIOUS_REQUEST_UNCERTAIN/);assert.equal(mutations,1);
 const j=JSON.parse(await readFile(join(dir,`asset-save-${args.requestId}.json`)));assert.ok(j.assetId);assert.equal(j.input.workbenchAssetImage.id,j.assetId);
});
test('asset placement uses hosted URL, keeps proportions and rejects stale/read-only inputs',async t=>{
 const {a,board,calls}=await fixture(t);const s=await a.save({workbenchId:'board',drawingId:'source',name:'Base',version:'V1',requestId:randomUUID()});
 const args={workbenchId:'board',assetId:s.asset.id,expectedUpdatedAt:'old',x:50,y:80,displayWidth:320,requestId:randomUUID()};
 await assert.rejects(a.place(args),/ASSET_CHANGED/);assert.equal(calls.filter(c=>c.name==='CreateDrawings').length,0);
 const r=await a.place({...args,expectedUpdatedAt:'now'});assert.equal(r.verified,true);assert.equal(r.uploaded,false);
 const input=calls.find(c=>c.name==='CreateDrawings').v.input[0];assert.equal(input.image,s.asset.imagePath);assert.equal(input.workbenchSizeRatio,.5);assert.equal(input.height,360);
 assert.equal((await a.place({...args,expectedUpdatedAt:'now'})).reusedReceipt,true);
 board.isEditable=false;await assert.rejects(a.place({...args,expectedUpdatedAt:'now',requestId:randomUUID()}),/BOARD_NOT_EDITABLE/);
});
test('plain text note is escaped, updated with stale detection, and shown in summary',async t=>{
 const {b,board,calls}=await fixture(t);const n=await b.createNote({workbenchId:'board',text:'A < B & C\nNext',x:0,y:0});assert.equal(n.verified,true);
 assert.equal(noteHTML('A < B & C\nNext'),'<p>A &lt; B &amp; C</p><p>Next</p>');
 await assert.rejects(b.updateNote({workbenchId:'board',nodeId:n.nodeId,expectedUpdatedAt:'old',text:'x'}),/NODE_CHANGED/);
 assert.equal(calls.filter(c=>c.name==='UpdateWorkbenchElementStickyNote').length,0);
 assert.equal((await b.updateNote({workbenchId:'board',nodeId:n.nodeId,expectedUpdatedAt:'now',text:'next'})).verified,true);
 const s=summarize(board);assert.equal(s.elements.find(e=>e.id===n.nodeId).content,'<p>next</p>');assert.equal(s.elements[0].workbenchSizeRatio,1);
});
test('rewiring preserves order/prompt and refuses duplicate, foreign, stale and 3D sources',async t=>{
 const {b,board,calls,api}=await fixture(t);board.drawings.nodes.push({id:'other'});
 const n={id:'prompt',__typename:'WorkbenchElementMagicPrompt',x:0,y:0,updatedAt:'now',magicPromptType:'CUSTOM_PROMPT',customPromptData:{promptText:'keep this'},sourceDrawings:{edges:[]},mediaSources:{nodes:[]}};board.magicPrompts.nodes.push(n);
 const args={workbenchId:'board',nodeId:'prompt',expectedUpdatedAt:'now',sourceDrawingIds:['other','source']};
 assert.equal((await b.setSources(args)).verified,true);assert.equal(n.customPromptData.promptText,'keep this');
 const count=calls.filter(c=>c.name==='updateWorkbenchElementMagicPromptWithDrawings').length;
 for(const sourceDrawingIds of [['source','source'],['foreign']])await assert.rejects(b.setSources({...args,sourceDrawingIds}));
 await assert.rejects(b.setSources({...args,expectedUpdatedAt:'old'}),/NODE_CHANGED/);
 n.mediaSources.nodes=[{workbenchElementScene3DId:'scene'}];await assert.rejects(b.setSources(args),/MIXED_3D/);
 assert.equal(calls.filter(c=>c.name==='updateWorkbenchElementMagicPromptWithDrawings').length,count);
 n.mediaSources.nodes=[];const original=api.operation;
 api.operation=async(name,v)=>{const r=await original(name,v);if(name==='updateWorkbenchElementMagicPromptWithDrawings')n.customPromptData.promptText='unexpected drift';return r;};
 const drift=await b.setSources(args);assert.equal(drift.sourcesVerified,true);assert.equal(drift.settingsPreserved,false);assert.equal(drift.verified,false);
});
