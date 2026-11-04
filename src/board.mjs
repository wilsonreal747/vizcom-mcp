import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'graphql';

export function elements(board){return Object.entries(board).filter(([k])=>k!=='drawingThumbnails').flatMap(([,v])=>v?.nodes??[]).filter(n=>Number.isFinite(n.x));}
export function summarize(board){return {id:board.id,name:board.name,editable:board.isEditable,elements:elements(board).map(n=>({id:n.id,type:n.__typename,name:n.name??n.title,x:n.x,y:n.y,width:n.drawingWidth?n.drawingWidth*n.workbenchSizeRatio:n.width,height:n.drawingHeight?n.drawingHeight*n.workbenchSizeRatio:n.height,updatedAt:n.updatedAt,sourceDrawingIds:n.sourceDrawings?.edges?.toSorted((a,b)=>a.sortOrder-b.sortOrder).map(e=>e.node.id),prompt:n.customPromptData?.promptText,failureReason:n.failureReason}))};}
export class BoardClient{
 constructor(client,outputRoot){this.api=client;this.outputRoot=outputRoot;}
 async board(id){const b=(await this.api.operation('workbenchContent',{id})).workbench;if(!b)throw Error('BOARD_NOT_FOUND');return b;}
 async record(prefix,data){await mkdir(this.outputRoot,{recursive:true});const path=join(this.outputRoot,`${prefix}-${randomUUID()}.json`);await writeFile(path,JSON.stringify(data,null,2),{flag:'wx'});return path;}
 async createElements(variables){
  const doc=parse(await readFile(new URL('../evidence/operations/CreateWorkbenchElements.graphql',import.meta.url),'utf8'));
  const defaults=Object.fromEntries(doc.definitions[0].variableDefinitions.filter(v=>v.type.kind==='NonNullType'&&v.type.type.kind==='ListType').map(v=>[v.variable.name.value,[]]));
  return this.api.operation('CreateWorkbenchElements',{...defaults,...variables});
 }
 async section({workbenchId,title,x,y,width,height}){
  const id=randomUUID();const input={id,workbenchId,title,x,y,width,height,zIndex:-100,color:'#DCE6F2'};
  const journal=await this.record('section-request',input);
  const data=await this.createElements({createWorkbenchElementsSectionInput:[input]});return {id,journal,section:data.createWorkbenchElementsSection?.sections?.find(n=>n.id===id)};
 }
 async layout({workbenchId,changes}){
  const before=await this.board(workbenchId);if(!before.isEditable)throw Error('BOARD_NOT_EDITABLE');
  const all=elements(before);const ids=new Set();
  for(const c of changes){const n=all.find(n=>n.id===c.id);if(!n||ids.has(c.id))throw Error('UNKNOWN_OR_DUPLICATE_NODE');ids.add(c.id);if(n.__typename==='Drawing'&&(c.width!==undefined||c.height!==undefined))throw Error('DRAWING_RESIZE_USE_WORKBENCH_SIZE_RATIO');if(c.expectedUpdatedAt!==n.updatedAt)throw Error(`NODE_CHANGED:${c.id}: reread board`);}
  const patch=changes.map(({expectedUpdatedAt,...c})=>c);
  const restore=changes.map(c=>Object.fromEntries(Object.keys(c).filter(k=>k!=='expectedUpdatedAt').map(k=>[k,all.find(n=>n.id===c.id)[k]])));
  const journal=await this.record('layout',{workbenchId,before,patch,restore});
  await this.api.operation('UpdateMultiWorkbenchElements',{input:{newElementData:patch}});
  const after=await this.board(workbenchId);
  const actual=elements(after);
  const verified=patch.every(c=>Object.entries(c).every(([k,v])=>{const a=actual.find(n=>n.id===c.id)?.[k];return typeof v==='number'?Math.abs(a-v)<0.01:a===v;}));
  await writeFile(journal,JSON.stringify({workbenchId,before,patch,restore,after,verified},null,2));
  return {journal,verified,count:changes.length};
 }
 async createPromptNode({workbenchId,sourceDrawingIds,prompt,x,y}){
  const b=await this.board(workbenchId);for(const id of sourceDrawingIds)if(!b.drawings.nodes.some(d=>d.id===id))throw Error('SOURCE_NOT_ON_BOARD');
  const id=randomUUID();const input={id,workbenchId,x,y,width:300,height:260,zIndex:500100,magicPromptType:'CUSTOM_PROMPT',sourceDrawings:sourceDrawingIds,customPromptData:{promptText:prompt,qualityMode:'standard',contentHeight:260}};
  const journal=await this.record('prompt-node-request',input);
  const data=await this.createElements({createMagicPromptsInput:[input]});
  return {id,journal,data:data.createWorkbenchElementsMagicPrompt??data.createMagicPrompts};
 }
 async generate({workbenchId,nodeId,count=1,x,y,width=800,height=450,resolution='2k'}){
  if(!Number.isInteger(count)||count<1||count>4)throw Error('BATCH_COUNT_1_TO_4');
  const b=await this.board(workbenchId),n=b.magicPrompts.nodes.find(n=>n.id===nodeId);
  if(!n?.customPromptData?.promptText)throw Error('CUSTOM_PROMPT_NODE_REQUIRED');
  const placeholders=Array.from({length:count},(_,i)=>({id:randomUUID(),workbenchId,x:x+i*(width+70),y,width,height,zIndex:500110+i,type:'inference'}));
  const input={id:nodeId,customPrompt:n.customPromptData.promptText,qualityMode:'standard',resolution,sourceDrawingIds:n.sourceDrawings.edges.sort((a,b)=>a.sortOrder-b.sortOrder).map(e=>e.node.id),placeholders};
  const journal=await this.record('generation-request',input);
  try{const data=await this.api.operation('TriggerMagicPromptCustomPrompt',{input});await writeFile(journal,JSON.stringify({input,result:data},null,2));return {outputIds:placeholders.map(p=>p.id),journal,result:data.triggerMagicPromptCustomPrompt};}
  catch(e){throw Error(`${e.message}; journal=${journal}; outputIds=${placeholders.map(p=>p.id).join(',')}; do not resubmit blindly`);}
 }
}
