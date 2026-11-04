import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {dirname,basename,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
const {hashes}=JSON.parse(readFileSync(new URL('../evidence/operations.json',import.meta.url),'utf8'));
const allowedOperations=new Set(['currentUser','CreateWorkbench','CreateDrawings','CreatePrompt','prompts','recentlyViewedWorkbenches','workbenchContent','UpdateDrawing','CreateEditPrompt','CreateWorkbenchElements','UpdateMultiWorkbenchElements','TriggerMagicPromptCustomPrompt','drawingById','UpdateMagicPromptWithCustomPromptData','UpdateWorkbenchElementSection','DeleteWorkbenchElements']);
export class VizcomClient {
 constructor({token=process.env.VIZCOM_ACCESS_TOKEN??'',organizationId=process.env.VIZCOM_ORGANIZATION_ID??'',endpoint='https://app.vizcom.com/api/v1/graphql',fetchImpl=fetch,allowLocalTestServer=false}={}){
  const url=new URL(endpoint);
  if(endpoint!=='https://app.vizcom.com/api/v1/graphql'&&!(allowLocalTestServer&&url.hostname==='127.0.0.1'))throw Error('ENDPOINT_NOT_ALLOWED');
  Object.assign(this,{token,organizationId,endpoint,fetchImpl,allowLocalTestServer});
 }
 async operation(name,variables,{files=[]}={}){
  if(!this.token)throw Error('AUTH_REQUIRED: supply VIZCOM_ACCESS_TOKEN locally; never paste it in chat.');
  if(!allowedOperations.has(name)||!hashes[name])throw Error('OPERATION_NOT_ALLOWED');
  const payload={operationName:name,variables:{...variables,...(name.startsWith('Create')&&this.organizationId?{organizationId:this.organizationId}:{})},extensions:{persistedQuery:{version:1,sha256Hash:hashes[name]}}};
  const headers={authorization:`Bearer ${this.token}`,...(this.organizationId?{'x-organization-id':this.organizationId}:{})};
  let body;
  if(files.length){
   body=new FormData();body.append('operations',JSON.stringify(payload));body.append('map',JSON.stringify(Object.fromEntries(files.map((f,i)=>[String(i),f.paths]))));
   files.forEach((f,i)=>body.append(String(i),f.blob,f.name));
  }else {headers['content-type']='application/json';body=JSON.stringify(payload);}
  let response;
  try{response=await this.fetchImpl(this.endpoint,{method:'POST',headers,body,redirect:'error',signal:AbortSignal.timeout(60000)});}catch{throw Error(`REQUEST_UNCERTAIN:${name}: do not automatically resubmit a mutation`);}
  if(!response.ok)throw Error(`HTTP_${response.status}:${name}: not retried`);
  const result=await response.json();
  if(result.errors?.length){const message=result.errors.map(x=>x.message).join('; ').split(this.token).join('[redacted]');throw Error(`GRAPHQL_ERROR:${name}:${message.slice(0,1000)}`);}
  if(!result.data)throw Error(`EMPTY_RESPONSE:${name}`);
  return result.data;
 }
 async currentUser(){const {currentUser}=await this.operation('currentUser',{});if(!currentUser)throw Error('AUTH_REQUIRED: token not accepted');return {id:currentUser.id};}
 async createWorkbench({folderId,name='MCP smoke test'}){return (await this.operation('CreateWorkbench',{input:{workbench:{id:randomUUID(),folderId,name},startInStudio:false}})).createWorkbench.workbench;}
 async readPng(file){
  const info=await stat(file);if(info.size>20*1024*1024)throw Error('IMAGE_TOO_LARGE');
  const bytes=await readFile(file);
  if(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('PNG_REQUIRED');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||width*height>16777216)throw Error('IMAGE_DIMENSIONS_UNSUPPORTED');
  return {width,height,blob:new Blob([bytes],{type:'image/png'}),name:basename(file)};
 }
 async uploadSketch({file,workbenchId,name='MCP sketch',x=0,y=0,zIndex=0,id=randomUUID()}){
  const image=await this.readPng(file);
  const input={id,name,workbenchId,width:image.width,height:image.height,x,y,zIndex,image:null,thumbnailPath:null,backgroundColor:'#ffffff',backgroundVisible:true};
  const result=await this.operation('CreateDrawings',{input:[input]},{files:[{...image,paths:['variables.input.0.image','variables.input.0.thumbnailPath']}]});
  const drawing=result.createDrawings?.drawings?.find(x=>x.id===id);if(!drawing)throw Error(`UPLOAD_RESPONSE_MISSING:${id}`);return drawing;
 }
 async render({file,drawingId,prompt,style='generalV2',influence=1}){
  if(typeof prompt!=='string'||!prompt.trim())throw Error('PROMPT_REQUIRED');
  if(!Number.isFinite(influence)||influence<0||influence>1)throw Error('INFLUENCE_OUT_OF_RANGE');
  const image=await this.readPng(file),id=randomUUID();
  const input={id,data:null,prompt,sourceImageInfluence:influence,paletteInfluence:1,colorCoherence:false,drawingId,imageInferenceType:'RENDER',outputsCount:1,publicPaletteId:style};
  const result=await this.operation('CreatePrompt',{input},{files:[{...image,paths:['variables.input.data']}]});
  if(!result.createPrompt?.prompt?.id)throw Error(`SUBMISSION_RESPONSE_MISSING:${id}: do not resubmit blindly`);
  return result.createPrompt.prompt;
 }
 async getResult(id){return (await this.operation('prompts',{ids:[id]})).prompts?.nodes?.find(x=>x.id===id)??null;}
 async edit({file,maskFile,drawingId,prompt}){
  const image=await this.readPng(file),mask=await this.readPng(maskFile),id=randomUUID();
  if(image.width!==mask.width||image.height!==mask.height)throw Error('MASK_DIMENSIONS_MUST_MATCH');
  const input={id,data:null,mask:null,drawingId,outputsCount:1,prompt,qualityMode:'standard',fromSuggestion:false};
  const result=await this.operation('CreateEditPrompt',{input},{files:[{...image,paths:['variables.input.data']},{...mask,paths:['variables.input.mask']}]});
  return result.createEditPrompt.prompt;
 }
 async waitForResult(id,{timeoutMs=180000,intervalMs=2000}={}){
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
   const result=await this.getResult(id);const nodes=result?.outputs?.nodes??[];
   if(nodes.some(x=>x.failureReason))throw Error(`GENERATION_FAILED:${id}`);
   const output=nodes.find(x=>x.imagePath);if(output)return output;
   await sleep(Math.min(intervalMs,Math.max(0,deadline-Date.now())));
  }
  throw Error(`POLL_TIMEOUT:${id}: resume polling this id instead of submitting again`);
 }
 async download(url,path){
  const target=new URL(url);const extra=(process.env.VIZCOM_ASSET_HOSTS??'').split(',').filter(Boolean);
  const allowed=target.protocol==='https:'&&['vizcom.com','vizcom.ai'].some(h=>target.hostname===h||target.hostname.endsWith('.'+h));
  const local=this.allowLocalTestServer&&target.hostname==='127.0.0.1'&&target.origin===new URL(this.endpoint).origin;
  if(!allowed&&!local&&!(target.protocol==='https:'&&extra.includes(target.hostname)))throw Error(`ASSET_HOST_NOT_VERIFIED:${target.hostname}`);
  const r=await this.fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw Error(`DOWNLOAD_HTTP_${r.status}`);
  if(!/^image\/(png|jpeg|webp)(;|$)/i.test(r.headers.get('content-type')??''))throw Error('DOWNLOAD_NOT_IMAGE');
  const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>32*1024*1024)throw Error('DOWNLOAD_TOO_LARGE');chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);if(bytes.length<8)throw Error('DOWNLOAD_EMPTY');
  const extension=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'.png':bytes[0]===255&&bytes[1]===216?'.jpg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'.webp':null;
  if(!extension)throw Error('DOWNLOAD_IMAGE_SIGNATURE_INVALID');
  path=path.slice(0,path.length-extname(path).length)+extension;
  await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:'wx'});return {path,bytes:bytes.length};
 }
}
