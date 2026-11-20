import {readFile,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {basename} from 'node:path';
import {parse} from 'graphql';
import {rows} from './animate.mjs';
// Bounded ISO-BMFF metadata reader. No external executables or browser needed.
export function mp4Metadata(bytes){
 function boxes(start,end){const out=[];for(let p=start;p<end;){if(p+8>end)throw Error('MP4_TRUNCATED');let size=bytes.readUInt32BE(p),head=8;const type=bytes.toString('ascii',p+4,p+8);if(size===1){if(p+16>end)throw Error('MP4_TRUNCATED');const n=bytes.readBigUInt64BE(p+8);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('MP4_SIZE_INVALID');size=Number(n);head=16;}if(size===0)size=end-p;if(size<head||p+size>end)throw Error('MP4_SIZE_INVALID');out.push({type,start:p+head,end:p+size});p+=size;}return out;}
 const children=b=>boxes(b.start,b.end),one=(b,t)=>{const n=children(b).find(n=>n.type===t);if(!n)throw Error('MP4_MISSING_'+t);return n;};
 const top=boxes(0,bytes.length);if(top[0]?.type!=='ftyp'||!top.some(b=>b.type==='mdat'))throw Error('MP4_REQUIRED');if(top.some(b=>b.type==='moof'))throw Error('FRAGMENTED_MP4_UNSUPPORTED');
 const moov=top.find(b=>b.type==='moov');if(!moov)throw Error('MP4_MISSING_moov');
 const videos=[];for(const trak of children(moov).filter(b=>b.type==='trak')){const mdia=one(trak,'mdia'),h=one(mdia,'hdlr');if(h.end-h.start<12)throw Error('MP4_TRUNCATED');if(bytes.toString('ascii',h.start+8,h.start+12)!=='vide')continue;
  const mdhd=one(mdia,'mdhd'),v=bytes[mdhd.start];if(v!==0&&v!==1)throw Error('MP4_VERSION_UNSUPPORTED');const timeOffset=v===1?20:12, durOffset=v===1?24:16;if(mdhd.start+durOffset+(v===1?8:4)>mdhd.end)throw Error('MP4_TRUNCATED');const timescale=bytes.readUInt32BE(mdhd.start+timeOffset),ticks=v===1?Number(bytes.readBigUInt64BE(mdhd.start+durOffset)):bytes.readUInt32BE(mdhd.start+durOffset);
  const stbl=one(one(mdia,'minf'),'stbl'),stsd=one(stbl,'stsd');if(stsd.end-stsd.start<8||bytes.readUInt32BE(stsd.start+4)!==1)throw Error('VIDEO_TRACK_FORMAT_UNSUPPORTED');const sample=boxes(stsd.start+8,stsd.end)[0];if(!sample||!['avc1','avc3'].includes(sample.type)||sample.end-sample.start<28)throw Error('H264_MP4_REQUIRED');const width=bytes.readUInt16BE(sample.start+24),height=bytes.readUInt16BE(sample.start+26);
  const stts=one(stbl,'stts');if(stts.end-stts.start<8)throw Error('MP4_TRUNCATED');const count=bytes.readUInt32BE(stts.start+4);if(stts.start+8+count*8>stts.end)throw Error('MP4_TRUNCATED');let frames=0,total=0;for(let i=0;i<count;i++){const p=stts.start+8+i*8,n=bytes.readUInt32BE(p),delta=bytes.readUInt32BE(p+4);frames+=n;total+=n*delta;}
  const duration=ticks/timescale,frameRate=frames*timescale/total;if(!Number.isFinite(duration)||duration<=0||duration>30||!Number.isFinite(frameRate)||frameRate<=0||!width||!height||width>4096||height>4096)throw Error('VIDEO_LIMITS: H264 MP4, <=30s, <=4096px');videos.push({width,height,duration,frameRate});
 }if(videos.length!==1)throw Error('ONE_VIDEO_TRACK_REQUIRED');return videos[0];
}
export async function uploadVideo(board,{file,workbenchId,name,x,y}){
 const info=await stat(file);if(!info.isFile()||info.size>256*1024*1024)throw Error('VIDEO_LIMIT_256MB');const bytes=await readFile(file);if(bytes.length>256*1024*1024)throw Error('VIDEO_LIMIT_256MB');const meta=mp4Metadata(bytes);
 const b=await board.board(workbenchId);if(!b.isEditable)throw Error('BOARD_NOT_EDITABLE');const id=randomUUID();
 const input={id,workbenchId,x,y,width:800,height:800*meta.height/meta.width,zIndex:500200,videoPath:null,name:name??basename(file),prompt:null,preset:null,sourceImagePath:null,endSourceImagePath:null,model:null,duration:meta.duration,audioModel:null,pixelWidth:meta.width,pixelHeight:meta.height,frameRate:meta.frameRate,workflow:null,sourceImages:[]};
 const journal=await board.record('video-upload',{workbenchId,videoId:id,input,bytes:bytes.length});
 const doc=parse(await readFile(new URL('../evidence/operations/CreateWorkbenchElements.graphql',import.meta.url),'utf8'));
 const defaults=Object.fromEntries(doc.definitions[0].variableDefinitions.filter(v=>v.type.kind==='NonNullType'&&v.type.type.kind==='ListType').map(v=>[v.variable.name.value,[]]));
 try{await board.api.operation('CreateWorkbenchElements',{...defaults,createVideosInput:[input]},{files:[{name:basename(file),blob:new Blob([bytes],{type:'video/mp4'}),paths:['variables.createVideosInput.0.videoPath']}]});}catch(e){throw Error(`${e.message}; videoId=${id}; journal=${journal}; reconcile before retry`);}
 const after=await board.board(workbenchId),video=rows(after.videos).find(v=>v.id===id);if(!video?.videoPath)throw Error(`UPLOAD_UNCONFIRMED:${id}:${journal}`);return {videoId:id,journal,metadata:meta,verified:true};
}
