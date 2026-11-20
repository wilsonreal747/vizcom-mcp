import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export const rows=x=>Array.isArray(x)?x:x?.nodes??[];
export const ASPECT_RATIOS=['auto','21:9','16:9','4:3','1:1','3:4','9:16'];
export function validateSettings(s){
 if(!['animate_lite','animate_hd'].includes(s.model))throw Error('MODEL_MUST_BE_FAST_OR_PRO');
 if(!ASPECT_RATIOS.includes(s.aspectRatio))throw Error('UNSUPPORTED_ASPECT_RATIO');
 if(typeof s.generateAudio!=='boolean')throw Error('AUDIO_BOOLEAN_REQUIRED');
 const min=s.model==='animate_lite'?5:4;if(!Number.isInteger(s.duration)||s.duration<min||s.duration>15)throw Error(`DURATION_${min}_TO_15_INTEGER_SECONDS`);
 return s.model==='animate_lite'&&!s.generateAudio?['Provider UI describes Fast as always including audio, but a live false-flag output had no audio track. Verify the downloaded streams; do not infer effective audio from the flag alone.']:[];
}
export function inspect(b){return {id:b.id,animates:rows(b.animates),videos:rows(b.videos).map(({videoPath,...v})=>({...v,hasVideo:!!videoPath})),placeholders:rows(b.placeholders)};}
export class AnimateClient {
 constructor(board){this.board=board;this.api=board.api;}
 async sources(b,sources){
  if(!sources.length||sources.length>4)throw Error('SOURCE_COUNT_1_TO_4');
  const seen=new Set();return sources.map(s=>{if(!!s.drawingId===!!s.videoId)throw Error('ONE_MEDIA_ID_REQUIRED');const id=s.drawingId??s.videoId;if(seen.has(id))throw Error('DUPLICATE_SOURCE');seen.add(id);if(!rows(s.drawingId?b.drawings:b.videos).some(n=>n.id===id))throw Error('SOURCE_NOT_ON_BOARD');return {id:randomUUID(),drawingId:s.drawingId??null,videoId:s.videoId??null,role:s.videoId?'source_video':'reference',label:s.label??null};});
 }
 async create({workbenchId,prompt,workflow='custom',duration=5,model='animate_lite',aspectRatio='auto',generateAudio=true,x,y}){
  const warnings=validateSettings({duration,model,aspectRatio,generateAudio});
  const b=await this.board.board(workbenchId);if(!b.isEditable)throw Error('BOARD_NOT_EDITABLE');
  const input={id:randomUUID(),workbenchId,x,y,width:300,height:300,zIndex:500200,prompt,sourceDrawingId:null,endDrawingId:null,animateType:'STANDARD_V2',duration,generateAudio,aspectRatio,model,keyframeSlots:[],workflow,sources:[],preset:null,presetPreview:false};
  const journal=await this.board.record('animate-create',input);
  try{await this.board.createElements({createAnimatesInput:[input]});}catch(e){throw Error(`${e.message}; nodeId=${input.id}; journal=${journal}; reconcile before retry`);}
  const after=await this.board.board(workbenchId);const node=rows(after.animates).find(n=>n.id===input.id);if(!node)throw Error(`CREATE_UNCONFIRMED:${input.id}:${journal}`);return {node,journal,warnings};
 }
 async update({workbenchId,nodeId,expectedUpdatedAt,...patch}){
  if(!Object.keys(patch).length)throw Error('EMPTY_PATCH');
  if(Object.keys(patch).some(k=>!['prompt','model','aspectRatio','generateAudio','duration'].includes(k)))throw Error('UNSUPPORTED_SETTING');
  const b=await this.board.board(workbenchId),n=rows(b.animates).find(n=>n.id===nodeId);if(!b.isEditable||!n||n.updatedAt!==expectedUpdatedAt)throw Error('NODE_MISSING_CHANGED_OR_NOT_EDITABLE');
  const warnings=validateSettings({...n,...patch}),input={id:nodeId,patch};
  const journal=await this.board.record('animate-settings',{workbenchId,nodeId,before:n,input});
  try{await this.api.operation('UpdateWorkbenchElementAnimate',{input});}catch(e){throw Error(`${e.message}; nodeId=${nodeId}; journal=${journal}; reread before retry`);}
  const after=await this.board.board(workbenchId),node=rows(after.animates).find(n=>n.id===nodeId);if(!node||Object.entries(patch).some(([k,v])=>node[k]!==v))throw Error(`SETTINGS_UNCONFIRMED:${nodeId}:${journal}`);
  return {node,verified:true,journal,warnings};
 }
 async connect({workbenchId,nodeId,expectedUpdatedAt,sources}){
  const b=await this.board.board(workbenchId),n=rows(b.animates).find(n=>n.id===nodeId);if(!b.isEditable||!n||n.updatedAt!==expectedUpdatedAt)throw Error('NODE_MISSING_CHANGED_OR_NOT_EDITABLE');
  const media=await this.sources(b,sources);const input={elementId:nodeId,sources:media,sourceDrawingId:media.find(s=>s.label==='start')?.drawingId??null,endDrawingId:media.find(s=>s.label==='end')?.drawingId??null};
  const journal=await this.board.record('animate-connect',{workbenchId,before:n,input});await this.api.operation('UpdateWorkbenchElementAnimateSources',{input});
  const after=await this.board.board(workbenchId),node=rows(after.animates).find(n=>n.id===nodeId);
  const actual=rows(node?.sources).toSorted((a,b)=>a.sortOrder-b.sortOrder);
  if(actual.length!==media.length||media.some((s,i)=>['id','drawingId','videoId','role','label'].some(k=>actual[i][k]!==s[k])))throw Error(`CONNECTION_UNCONFIRMED:${nodeId}:${journal}`);
  return {node,journal,verified:true};
 }
 async generate({workbenchId,nodeId,expectedUpdatedAt,x,y}){
  const b=await this.board.board(workbenchId),n=rows(b.animates).find(n=>n.id===nodeId);if(!b.isEditable||!n||n.updatedAt!==expectedUpdatedAt)throw Error('NODE_MISSING_CHANGED_OR_NOT_EDITABLE');
  if(!rows(n.sources).length)throw Error('MEDIA_REQUIRED');
  const warnings=n.model==='animate_lite'&&n.generateAudio===false?['Fast audio behavior differs between UI wording and observed output; inspect downloaded streams.']:[];
  const placeholder={id:randomUUID(),workbenchId,x,y,width:800,height:450,zIndex:500201,type:'inference'};
  const input={id:nodeId,placeholder,model:n.model,animateV1NoPromptExpansion:false};
  const journal=await this.board.record('animate-submit',{workbenchId,nodeId,outputId:placeholder.id,input});
  try{const result=await this.api.operation('TriggerWorkbenchElementAnimate',{input});return {outputId:placeholder.id,journal,result,warnings};}catch(e){throw Error(`${e.message}; outputId=${placeholder.id}; journal=${journal}; do not resubmit`);}
 }
 async download({workbenchId,videoId}){
  const b=await this.board.board(workbenchId),v=rows(b.videos).find(v=>v.id===videoId);if(!v?.videoPath)throw Error('VIDEO_NOT_READY');
  const u=new URL(v.videoPath);if(u.protocol!=='https:'||!['vizcom.com','vizcom.ai'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw Error('ASSET_HOST_NOT_VERIFIED');
  const r=await this.api.fetchImpl(u,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`DOWNLOAD_HTTP_${r.status}`);
  if(!/^video\/mp4(?:;|$)/i.test(r.headers.get('content-type')??''))throw Error('MP4_CONTENT_TYPE_REQUIRED');
  const chunks=[];let size=0;for await(const c of r.body){size+=c.length;if(size>256*1024*1024)throw Error('VIDEO_TOO_LARGE');chunks.push(c);}const bytes=Buffer.concat(chunks);if(bytes.toString('ascii',4,8)!=='ftyp')throw Error('MP4_SIGNATURE_REQUIRED');
  const path=join(this.board.outputRoot,`video-${videoId}-${randomUUID()}.mp4`);await writeFile(path,bytes,{flag:'wx'});return {path,bytes:size,duration:v.duration,width:v.pixelWidth,height:v.pixelHeight};
 }
}
