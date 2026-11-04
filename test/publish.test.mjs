import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {preserveOutsideMask} from '../src/publish.mjs';
test('masked publication preserves every outside pixel even if model changes the entire image',async t=>{
 const d=await mkdtemp(join(tmpdir(),'mask-test-'));t.after(()=>rm(d,{recursive:true,force:true}));
 const source=join(d,'s.png'),generated=join(d,'g.png'),mask=join(d,'m.png'),path=join(d,'r.png');
 await sharp({create:{width:4,height:4,channels:3,background:'#112233'}}).png().toFile(source);
 await sharp({create:{width:4,height:4,channels:3,background:'#ff0000'}}).png().toFile(generated);
 const pixels=Buffer.alloc(16);pixels[5]=255;await sharp(pixels,{raw:{width:4,height:4,channels:1}}).png().toFile(mask);
 const r=await preserveOutsideMask({source,generated,mask,path});assert.equal(r.selectedPixels,1);
 const out=await sharp(path).removeAlpha().raw().toBuffer();
 for(let i=0;i<16;i++)assert.deepEqual([...out.subarray(i*3,i*3+3)],i===5?[255,0,0]:[17,34,51]);
});
