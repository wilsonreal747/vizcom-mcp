import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
export async function preserveOutsideMask({source,generated,mask,path}){
 const a=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height,channels}=a.info;
 const m=await sharp(mask).greyscale().raw().toBuffer({resolveWithObject:true});
 if(m.info.width!==width||m.info.height!==height)throw Error('MASK_DIMENSIONS_MUST_MATCH');
 const b=await sharp(generated).resize(width,height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 let selected=0;
 for(let i=0;i<width*height;i++)if(m.data[i*m.info.channels]>128){selected++;for(let c=0;c<channels;c++)a.data[i*channels+c]=b[i*channels+c];}
 if(!selected)throw Error('EMPTY_MASK');
 await sharp(a.data,{raw:{width,height,channels}}).png().toFile(path);
 return {width,height,selectedPixels:selected,outsideMaskPreserved:true};
}
export async function publishResult(api,boards,root,{promptId,workbenchId,name,x,y,sourceFile,maskFile}){
 await mkdir(root,{recursive:true});
 const receipt=join(root,`published-${workbenchId}-${promptId}.json`);
 let existing;try{existing=JSON.parse(await readFile(receipt,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(existing){const b=await boards.board(workbenchId);if(b.drawings.nodes.some(n=>n.id===existing.drawingId))return {...existing,reused:true};throw Error(`PUBLICATION_UNCERTAIN: inspect drawing ${existing.drawingId} before retry`);}
 const p=await api.getResult(promptId);const output=p?.outputs?.nodes?.find(o=>o.imagePath);if(!output)throw Error('RESULT_NOT_READY');
 const suffix=randomUUID();const downloaded=await api.download(output.imagePath,join(root,`${promptId}-${suffix}.png`));
 const png=join(root,`${promptId}-${suffix}-board.png`);
 let protection;
 if(sourceFile&&maskFile)protection=await preserveOutsideMask({source:sourceFile,generated:downloaded.path,mask:maskFile,path:png});
 else await sharp(downloaded.path).png().toFile(png);
 const drawingId=randomUUID();const record={promptId,workbenchId,drawingId,path:png,downloaded:downloaded.path,protection,status:'pending'};
 await writeFile(receipt,JSON.stringify(record,null,2),{flag:'wx'});
 const drawing=await api.uploadSketch({id:drawingId,file:png,workbenchId,name,x,y});
 record.status='published';await writeFile(receipt,JSON.stringify(record,null,2));return {...record,drawing:{id:drawing.id,name:drawing.name},receipt};
}
