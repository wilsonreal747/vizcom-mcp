import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {isDeepStrictEqual} from 'node:util';

const scopes=['workbench','personal','organization','team'];
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const imageKeys=['id','assetFolderId','folderId','name','imagePath','description','createdAt','updatedAt'];
function container(data,scope){
 const w=data.workbench;
 if(!w)throw Error('BOARD_NOT_FOUND');
 if(scope==='workbench')return w;
 if(scope==='personal')return w.folder?.organization?.currentUserDraftFolder;
 if(scope==='organization')return w.folder?.organization?.globalTeam?.rootFolder;
 return w.team?.rootFolder;
}
// An absent filter means all folders; null means the root, a UUID means one folder.
const filter=value=>value===undefined?{}:value===null?{isNull:true}:{equalTo:value};
export class AssetClient{
 constructor(api,boards){this.api=api;this.boards=boards;}
 async list({workbenchId,scope='workbench',assetFolderId,after},folders=false){
  if(!scopes.includes(scope))throw Error('INVALID_ASSET_SCOPE');
  const kind=folders?'Folders':'Images',key=(scope==='workbench'?'workbench':'folder')+'Asset'+kind;
  const data=await this.api.operation(scope+'Asset'+kind,{workbenchId,after,...(folders?{parentFilter:filter(assetFolderId)}:{assetFolderFilter:filter(assetFolderId)})});
  const c=container(data,scope),page=c?.[key];
  if(!page)return {scope,available:false,items:[],pageInfo:null};
  return {scope,available:true,containerId:c.id,items:page.nodes.map(n=>pick(n,folders?['id','name','description','parentAssetFolderId','workbenchId','folderId','assetsCount']:imageKeys)),pageInfo:page.pageInfo};
 }
 async search({workbenchId,query,limit=30}){
  if(!query.trim())throw Error('SEARCH_QUERY_REQUIRED');
  const data=await this.api.operation('MentionableAssetsSearch',{workbenchId,searchQuery:query,first:limit,includeFolders:true});
  return {items:data.mentionableAssetsSearch??[],limit,mayHaveMore:(data.mentionableAssetsSearch?.length??0)===limit};
 }
 async read({assetId,storage='workbench'}){
  if(!['workbench','folder'].includes(storage))throw Error('INVALID_ASSET_STORAGE');
  const key=storage==='workbench'?'workbenchAssetImage':'folderAssetImage';
  const asset=(await this.api.operation(storage==='workbench'?'workbenchAssetImageById':'folderAssetImage',{id:assetId}))[key];
  if(!asset)throw Error('ASSET_NOT_FOUND');
  return {storage,...pick(asset,imageKeys)};
 }
 async save(args){
  const {workbenchId,drawingId,name,version,description='',parentAsset,requestId}=args;
  const previous=await this.receipt(requestId,'save',args);if(previous)return previous;
  const b=await this.boards.board(workbenchId);if(!b.isEditable)throw Error('BOARD_NOT_EDITABLE');
  const drawing=b.drawings?.nodes.find(n=>n.id===drawingId);if(!drawing?.thumbnailPath)throw Error('DRAWING_NOT_READY_ON_BOARD');
  if(parentAsset)await this.read(parentAsset);
  // Save an immutable snapshot entry. This is workflow versioning, not native asset history.
  const id=randomUUID(),metadata={sourceDrawingId:drawingId,sourceWorkbenchId:workbenchId,version,parentAsset:parentAsset??null,representation:'board-preview'};
  const input={workbenchAssetImage:{id,workbenchId,name,description:[description,JSON.stringify(metadata)].filter(Boolean).join('\n'),imagePath:drawing.thumbnailPath}};
  return this.mutateOnce(requestId,'save',{args,assetId:id,input,metadata},async()=>{
   const d=await this.api.operation('CreateWorkbenchImage',{input});
   if(d.createWorkbenchAssetImage?.workbenchAssetImage?.id!==id)throw Error('ASSET_RESPONSE_MISSING');
   const asset=await this.read({assetId:id});
   return {asset,metadata,verified:asset.imagePath===drawing.thumbnailPath};
  });
 }
 async place(args){
  const {workbenchId,assetId,storage='workbench',expectedUpdatedAt,x,y,displayWidth=800,requestId}=args;
  const previous=await this.receipt(requestId,'place',args);if(previous)return previous;
  const b=await this.boards.board(workbenchId);if(!b.isEditable)throw Error('BOARD_NOT_EDITABLE');
  const asset=await this.read({assetId,storage});
  if(asset.updatedAt!==expectedUpdatedAt)throw Error('ASSET_CHANGED: reread asset');
  // Download solely to measure raster dimensions. CreateDrawings reuses the hosted image URL,
  // never multipart uploads these pixels. Existing URL restrictions apply in api.download.
  const local=join(this.boards.outputRoot,`asset-measure-${randomUUID()}.png`);
  const downloaded=await this.api.download(asset.imagePath,local);
  const {width,height}=await sharp(await readFile(downloaded.path),{limitInputPixels:16777216}).metadata();
  if(!width||!height)throw Error('ASSET_DIMENSIONS_UNKNOWN');
  const id=randomUUID(),input={id,workbenchId,name:asset.name,width,height,x,y,zIndex:0,workbenchSizeRatio:displayWidth/width,image:asset.imagePath,thumbnailPath:asset.imagePath,backgroundColor:'#ffffff',backgroundVisible:false};
  return this.mutateOnce(requestId,'place',{args,drawingId:id,assetId,storage,assetUpdatedAt:asset.updatedAt,input},async()=>{
   const d=await this.api.operation('CreateDrawings',{input:[input]});
   if(!d.createDrawings?.drawings?.some(n=>n.id===id))throw Error('DRAWING_RESPONSE_MISSING');
   const drawing=(await this.boards.board(workbenchId)).drawings?.nodes.find(n=>n.id===id);
   return {drawingId:id,assetId,storage,workbenchId,verified:!!drawing&&drawing.thumbnailPath===asset.imagePath,uploaded:false};
  });
 }
 async receipt(requestId,kind,args){
  if(!/^[a-f0-9-]{36}$/i.test(requestId))throw Error('REQUEST_UUID_REQUIRED');
  const path=join(this.boards.outputRoot,`asset-${kind}-${requestId}.json`);
  let r;try{r=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
  if(!isDeepStrictEqual(r.args,JSON.parse(JSON.stringify(args))))throw Error('REQUEST_ID_REUSED_WITH_DIFFERENT_ARGUMENTS');
  if(r.result)return {...r.result,journal:path,reusedReceipt:true};
  throw Error(`PREVIOUS_REQUEST_UNCERTAIN: inspect journal=${path}; do not resubmit`);
 }
 async mutateOnce(requestId,kind,data,fn){
  // Exclusive creation prevents concurrent submission under the same request ID.
  const path=join(this.boards.outputRoot,`asset-${kind}-${requestId}.json`);
  await mkdir(this.boards.outputRoot,{recursive:true});
  await writeFile(path,JSON.stringify(data,null,2),{flag:'wx'});
  try{const result=await fn();await writeFile(path,JSON.stringify({...data,result},null,2));return {...result,journal:path};}
  catch(e){throw Error(`${e.message}; journal=${path}; recoveryId=${data.drawingId??data.assetId}; do not resubmit blindly`);}
 }
}
