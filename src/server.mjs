import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {realpath,readFile,mkdir,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {VizcomClient} from './client.mjs';
import {existingSession} from './session.mjs';
import {BoardClient,summarize} from './board.mjs';
import {publishResult} from './publish.mjs';
import {contains,overlaps} from './geometry.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const inputRoot=resolve(process.env.VIZCOM_INPUT_ROOT??join(root,'inputs'));
const outputRoot=resolve(process.env.VIZCOM_OUTPUT_ROOT??join(root,'outputs'));
const client=new VizcomClient();
const boardClient=new BoardClient(client,outputRoot);
if(!client.token&&process.env.VIZCOM_SESSION_SOURCE)client.token=await existingSession(process.env.VIZCOM_SESSION_SOURCE);
const server=new McpServer({name:'wilson-vizcom-mcp',version:'0.1.0'});
function within(root,file){const rel=relative(root,file);return rel!== '..'&&!rel.startsWith('..\\')&&!rel.startsWith('../')&&!isAbsolute(rel);}
async function inputPath(file){
 const path=resolve(inputRoot,file);const allowedRoot=within(inputRoot,path)?inputRoot:within(outputRoot,path)?outputRoot:null;if(!allowedRoot)throw Error('INPUT_OUTSIDE_ROOT');
 const [actualRoot,actualPath]=await Promise.all([realpath(allowedRoot),realpath(path)]);
 if(!within(actualRoot,actualPath))throw Error('INPUT_OUTSIDE_ROOT');return actualPath;
}
function register(name,description,inputSchema,fn,readOnly=false){server.registerTool(name,{description,inputSchema,annotations:{readOnlyHint:readOnly,destructiveHint:false,idempotentHint:readOnly,openWorldHint:true}},async args=>{
 try{return {content:[{type:'text',text:JSON.stringify(await fn(args))}]};}
 catch(error){return {isError:true,content:[{type:'text',text:String(error.message).split(client.token||'\u0000').join('[redacted]')}]};}
});}
const id=z.string().uuid();
const renderSchema={file:z.string(),drawingId:id,prompt:z.string().min(1).max(8000),style:z.enum(['generalV2','carExterior_v2','carDesignRender_v2','realisticProduct_v2']).default('generalV2'),influence:z.number().min(0).max(1).default(1)};
register('vizcom_status','Check API authentication. No browser or desktop control.',{},()=>client.currentUser(),true);
register('vizcom_create_workbench','Create an isolated test file in a specified existing folder.',{folderId:id,name:z.string().min(1).max(120)},args=>client.createWorkbench(args));
register('vizcom_upload_sketch','Upload a PNG inside VIZCOM_INPUT_ROOT into the specified workbench as a visible editable image.',{file:z.string(),workbenchId:id,name:z.string().default('MCP sketch'),x:z.number().finite().default(0),y:z.number().finite().default(0)},async args=>client.uploadSketch({...args,file:await inputPath(args.file)}));
register('vizcom_render_sketch','Submit exactly one render; consumes Vizcom credits. Never retries submission. Save the returned prompt id.',renderSchema,async args=>client.render({...args,file:await inputPath(args.file)}));
register('vizcom_get_result','Read an existing prompt and generated output URLs; does not submit a new generation.',{promptId:id},args=>client.getResult(args.promptId),true);
register('vizcom_download_result','Download completed output for a prompt to a new local file; never overwrites existing output.',{promptId:id},async args=>{
 const result=await client.getResult(args.promptId);const output=result?.outputs?.nodes?.find(x=>x.imagePath);
 if(!output)throw Error('RESULT_NOT_READY');
 return client.download(output.imagePath,join(outputRoot,`${args.promptId}-${Date.now()}.png`));
});
register('vizcom_render_pipeline','Upload PNG and submit exactly one render, returning drawing and prompt ids. Poll with vizcom_get_result and download with vizcom_download_result. Consumes credits.',{file:z.string(),workbenchId:id,prompt:renderSchema.prompt,style:renderSchema.style,influence:renderSchema.influence},async args=>{
 const file=await inputPath(args.file);const drawing=await client.uploadSketch({file,workbenchId:args.workbenchId});
 try{const prompt=await client.render({...args,file,drawingId:drawing.id});return {drawingId:drawing.id,promptId:prompt.id,next:'vizcom_get_result'};}
 catch(e){throw Error(`${e.message}; drawingId=${drawing.id}; upload succeeded, do not rerun full pipeline blindly`);}
});
const position={x:z.number().finite(),y:z.number().finite()};
register('vizcom_list_boards','List the last 20 recently viewed boards in the organization.',{organizationId:id},async a=>{
 const d=await client.operation('recentlyViewedWorkbenches',a);return d.organization.recentlyViewedWorkbenches.nodes.map(b=>({id:b.id,name:b.name,editable:b.isEditable}));
},true);
register('vizcom_read_board','Read image positions, prompt nodes and ordered source links. IMPORTANT: every x/y is the CENTER; positive Y is UP. Bounds: left=x-width/2, right=x+width/2, top=y+height/2, bottom=y-height/2. Refresh before editing shared boards.',{workbenchId:id},async a=>summarize(await boardClient.board(a.workbenchId)),true);
register('vizcom_create_section','Create a visible board section. x/y denotes its CENTER, positive Y is UP. Does not automatically place existing nodes inside; verify with vizcom_check_layout.',{workbenchId:id,title:z.string().min(1).max(160),...position,width:z.number().positive(),height:z.number().positive()},a=>boardClient.section(a));
register('vizcom_arrange_nodes','Move or resize selected nodes with a local recovery journal. x/y are CENTERS; positive Y is UP. Drawings resize via workbenchSizeRatio; other nodes use width/height. Requires current updatedAt. Conflict detection is best effort, not atomic.',{workbenchId:id,changes:z.array(z.object({id,expectedUpdatedAt:z.string(),x:z.number().finite().optional(),y:z.number().finite().optional(),workbenchSizeRatio:z.number().positive().optional(),width:z.number().positive().optional(),height:z.number().positive().optional()})).min(1).max(200)},a=>boardClient.layout(a));
register('vizcom_create_prompt_node','Create a visible editable prompt node connected to 1–4 existing board images. Refer to images as @1, @2 in source order. Does not generate or charge credits.',{workbenchId:id,sourceDrawingIds:z.array(id).min(1).max(4),prompt:z.string().min(1).max(8000),...position},a=>boardClient.createPromptNode(a));
register('vizcom_generate_board','Generate 1–4 images from an existing prompt node directly onto its board. Consumes credits. Submission is never retried. Default 2k avoids Match source unexpectedly selecting 4k. Poll output IDs using vizcom_read_board.',{workbenchId:id,nodeId:id,count:z.number().int().min(1).max(4).default(1),resolution:z.enum(['1k','2k','4k','source']).default('2k'),...position,width:z.number().positive().default(800),height:z.number().positive().default(450)},a=>boardClient.generate(a));
register('vizcom_edit_region','Submit one masked local edit. PNG source and mask must have identical dimensions; white selects edits and black protects. Model may still change unselected areas; review output. Consumes credits; poll returned prompt id.',{file:z.string(),maskFile:z.string(),drawingId:id,prompt:z.string().min(1).max(8000)},async a=>client.edit({...a,file:await inputPath(a.file),maskFile:await inputPath(a.maskFile)}));
register('vizcom_download_drawing','Download the board drawing preview as currently stored by Vizcom. This is not a full-resolution layered Studio export.',{drawingId:id},async a=>{
 const d=(await client.operation('drawingById',{id:a.drawingId})).drawing;if(!d?.thumbnailPath)throw Error('DRAWING_NOT_READY');return client.download(d.thumbnailPath,join(outputRoot,`${d.id}-${Date.now()}.png`));
});
register('vizcom_publish_result','Place a completed Studio render/edit onto a board as a visible image. Idempotent per prompt/board. Optionally provide original PNG and mask to preserve all outside-mask pixels exactly.',{promptId:id,workbenchId:id,name:z.string().default('MCP generated result'),...position,sourceFile:z.string().optional(),maskFile:z.string().optional()},async a=>{
 if(!!a.sourceFile!==!!a.maskFile)throw Error('PROVIDE_BOTH_SOURCE_AND_MASK');
 return publishResult(client,boardClient,outputRoot,{...a,sourceFile:a.sourceFile?await inputPath(a.sourceFile):undefined,maskFile:a.maskFile?await inputPath(a.maskFile):undefined});
});
register('vizcom_update_prompt_node','Update the text of a visible custom prompt node with best-effort stale-edit detection. Does not generate.',{workbenchId:id,nodeId:id,expectedUpdatedAt:z.string(),prompt:z.string().min(1).max(8000)},async a=>{
 const b=await boardClient.board(a.workbenchId),n=b.magicPrompts.nodes.find(n=>n.id===a.nodeId);
 if(!n||n.updatedAt!==a.expectedUpdatedAt)throw Error('NODE_CHANGED_OR_MISSING');
 const journal=await boardClient.record('prompt-update',{workbenchId:a.workbenchId,before:n,newPrompt:a.prompt});
 await client.operation('UpdateMagicPromptWithCustomPromptData',{input:{elementId:n.id,magicPromptId:n.customPromptData.id,promptText:a.prompt}});return {journal,nodeId:n.id};
});
register('vizcom_restore_layout','Restore positions from an MCP layout journal. Stops if any affected node was subsequently moved. Leaves added nodes and sections intact.',{journalName:z.string().regex(/^layout-[a-f0-9-]{36}\.json$/)},async a=>{
 const j=JSON.parse(await readFile(join(outputRoot,a.journalName),'utf8'));const b=await boardClient.board(j.workbenchId);const current=summarize(b).elements;
 for(const p of j.patch){const n=current.find(n=>n.id===p.id),raw=b.drawings?.nodes?.find(n=>n.id===p.id)??n;if(!raw||Object.entries(p).some(([k,v])=>k!=='id'&&(typeof v==='number'?Math.abs(raw[k]-v)>0.01:raw[k]!==v)))throw Error('LAYOUT_CHANGED_SINCE_JOURNAL');}
 return boardClient.layout({workbenchId:j.workbenchId,changes:j.restore.map(p=>({...p,expectedUpdatedAt:current.find(n=>n.id===p.id).updatedAt}))});
});
register('vizcom_import_image','Import local PNG, JPEG or WebP into a board. Normalizes EXIF rotation and uploads PNG, leaving the source file unchanged.',{file:z.string(),workbenchId:id,name:z.string().min(1).max(200),...position},async a=>{
 const source=await inputPath(a.file);if((await stat(source)).size>20*1024*1024)throw Error('IMAGE_TOO_LARGE');
 const meta=await sharp(source,{limitInputPixels:16777216}).metadata();if(!['png','jpeg','webp'].includes(meta.format))throw Error('PNG_JPEG_WEBP_REQUIRED');
 await mkdir(outputRoot,{recursive:true});const file=join(outputRoot,`import-${randomUUID()}.png`);await sharp(source).rotate().png().toFile(file);
 const d=await client.uploadSketch({...a,file});return {id:d.id,name:d.name,workbenchId:d.workbenchId,normalizedFile:file};
});
register('vizcom_make_region_mask','Create a PNG selection mask matching a source PNG. Rectangle coordinates are normalized 0–1, white selected / black protected. No generation.',{file:z.string(),rectangles:z.array(z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().positive().max(1),height:z.number().positive().max(1)})).min(1).max(20)},async a=>{
 const source=await inputPath(a.file),{width,height}=await client.readPng(source);
 if(a.rectangles.some(r=>r.x+r.width>1||r.y+r.height>1))throw Error('RECTANGLE_OUTSIDE_IMAGE');
 const rects=a.rectangles.map(r=>`<rect x="${r.x*width}" y="${r.y*height}" width="${r.width*width}" height="${r.height*height}" fill="white"/>`).join('');
 const svg=Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/>${rects}</svg>`);
 await mkdir(outputRoot,{recursive:true});const maskFile=join(outputRoot,`mask-${randomUUID()}.png`);await sharp(svg).png().toFile(maskFile);return {maskFile,width,height};
});
register('vizcom_check_layout','Check actual center-based/Y-up bounds: nodes outside all sections, overlapping content, overlapping sections. Does not move anything. Use after board organization.',{workbenchId:id,padding:z.number().min(0).default(20)},async a=>{
 const b=summarize(await boardClient.board(a.workbenchId)),sections=b.elements.filter(n=>n.type==='WorkbenchElementSection'),nodes=b.elements.filter(n=>n.type!=='WorkbenchElementSection');
 const pairs=items=>items.flatMap((n,i)=>items.slice(i+1).filter(m=>overlaps(n,m)).map(m=>[n.id,m.id]));
 return {coordinateSystem:'center x/y, positive Y up',sectionCount:sections.length,nodeCount:nodes.length,outsideSections:nodes.filter(n=>!sections.some(s=>contains(s,n,a.padding))).map(n=>({id:n.id,name:n.name})),overlappingNodes:pairs(nodes),overlappingSections:pairs(sections)};
},true);
await server.connect(new StdioServerTransport());
