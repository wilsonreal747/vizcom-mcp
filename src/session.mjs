// Read-only Chromium LevelDB decoding. Never opens the DB engine or copies a profile.
// Only exact Vizcom access_token records survive parsing. Tokens are never logged/saved.
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import snappy from 'snappyjs';
const keys=['https://app.vizcom.com','https://app.vizcom.ai'].map(origin=>Buffer.from(`_${origin}\0\x01access_token`));
const wanted=key=>keys.some(k=>k.equals(key));
function varint(b,p){let n=0,shift=0;while(p.i<b.length&&shift<49){const x=b[p.i++];n+=(x&127)*2**shift;if(!(x&128))return n;shift+=7;}throw Error('TABLE_FORMAT: varint');}
function crc(b){let n=0xffffffff;for(const byte of b){n^=byte;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0x82f63b78:0);}return (n^0xffffffff)>>>0;}
function checksum(b,expected){const n=crc(b);return ((((n>>>15)|(n<<17))>>>0)+0xa282ead8)>>>0===expected;}
function entries(b){
 const count=b.readUInt32LE(b.length-4),end=b.length-4-count*4,p={i:0},out=[];let last=Buffer.alloc(0);
 if(end<0)throw Error('TABLE_FORMAT: restart array');
 while(p.i<end){const shared=varint(b,p),unique=varint(b,p),size=varint(b,p);if(shared>last.length||p.i+unique+size>end)throw Error('TABLE_FORMAT: entry');
  const key=Buffer.concat([last.subarray(0,shared),b.subarray(p.i,p.i+unique)]);p.i+=unique;
  out.push({key,value:b.subarray(p.i,p.i+size)});p.i+=size;last=key;
 }return out;
}
export function readTable(b){
 if(b.length<48||b.readBigUInt64LE(b.length-8)!==0xdb4775248b80fb57n)throw Error('TABLE_FORMAT: footer');
 const p={i:b.length-48};varint(b,p);varint(b,p);const index={offset:varint(b,p),size:varint(b,p)};
 function block({offset,size}){if(offset+size+5>b.length)throw Error('TABLE_FORMAT: block bounds');const type=b[offset+size];
  if(!checksum(b.subarray(offset,offset+size+1),b.readUInt32LE(offset+size+1)))throw Error('TABLE_FORMAT: checksum');
  const data=b.subarray(offset,offset+size);if(type===0)return data;if(type===1)return Buffer.from(snappy.uncompress(data));throw Error('TABLE_FORMAT: compression');
 }
 const out=[];
 for(const entry of entries(block(index))){const h={i:0};const data=block({offset:varint(entry.value,h),size:varint(entry.value,h)});
  for(const e of entries(data)){if(e.key.length<8)continue;const key=e.key.subarray(0,-8);if(!wanted(key))continue;
   const tag=e.key.readBigUInt64LE(e.key.length-8);out.push({key,value:e.value,sequence:tag>>8n,type:Number(tag&255n)});
  }
 }return out;
}
function readLog(b){
 const out=[];let pieces=[];
 function batch(v){if(v.length<12)return;const sequence=v.readBigUInt64LE(0),count=v.readUInt32LE(8),p={i:12};
  for(let i=0;i<count;i++){const type=v[p.i++];if(type!==0&&type!==1)throw Error('TABLE_FORMAT: log type');const len=varint(v,p),key=v.subarray(p.i,p.i+len);p.i+=len;let value;
   if(type===1){const n=varint(v,p);value=v.subarray(p.i,p.i+n);p.i+=n;}if(p.i>v.length)throw Error('TABLE_FORMAT: log bounds');if(wanted(key))out.push({key,value,sequence:sequence+BigInt(i),type});
  }
 }
 for(let base=0;base<b.length;base+=32768){const end=Math.min(b.length,base+32768);let p=base;
  while(p+7<=end){const len=b.readUInt16LE(p+4),type=b[p+6];if(!type&&!len)break;if(p+7+len>end)break;
   const data=b.subarray(p+7,p+7+len);if(!checksum(b.subarray(p+6,p+7+len),b.readUInt32LE(p)))throw Error('TABLE_FORMAT: log checksum');
   if(type===1)batch(data);else if(type===2)pieces=[data];else if(type===3)pieces.push(data);else if(type===4){pieces.push(data);batch(Buffer.concat(pieces));pieces=[];}p+=7+len;
  }
 }return out;
}
export function selectToken(records){
 // Prefer the current .com origin. Honor tombstones instead of resurrecting older tokens.
 for(const key of keys){const found=records.filter(e=>e.key.equals(key)).sort((a,b)=>a.sequence>b.sequence?-1:a.sequence<b.sequence?1:0)[0];
  if(!found)continue;if(found.type===0)return null;const v=found.value;
  if(v?.[0]===1)return v.subarray(1).toString('latin1');if(v?.[0]===0)return v.subarray(1).toString('utf16le');throw Error('SESSION_ENCODING_UNSUPPORTED');
 }return null;
}
export async function existingSession(source='edge'){
 const directory=source==='edge'?join(process.env.LOCALAPPDATA,'Microsoft','Edge','User Data','Default','Local Storage','leveldb'):source==='desktop'?join(process.env.APPDATA,'vizcom','Local Storage','leveldb'):null;
 if(!directory)throw Error('SESSION_SOURCE_NOT_ALLOWED');
 const records=[];
 for(const file of (await readdir(directory)).filter(f=>/^\d+\.(ldb|log)$/.test(f))){
  const b=await readFile(join(directory,file));records.push(...(file.endsWith('.ldb')?readTable(b):readLog(b)));
 }
 const token=selectToken(records);if(!token)throw Error('VIZCOM_SESSION_NOT_FOUND');return token;
}
