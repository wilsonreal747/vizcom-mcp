import test from 'node:test';
import assert from 'node:assert/strict';
const m=await import('../src/session.mjs').catch(()=>({}));
test('only exact Vizcom token keys are selected and latest deletion wins',()=>{
 assert.equal(typeof m.selectToken,'function');
 const key=Buffer.from('_https://app.vizcom.com\0\x01access_token');
 const other=Buffer.from('_https://unrelated.example\0\x01access_token');
 const entries=[{key:other,value:Buffer.from('\x01unrelated'),sequence:99n,type:1},{key,value:Buffer.from('\x01old'),sequence:1n,type:1},{key,value:Buffer.from('\x01current'),sequence:2n,type:1}];
 assert.equal(m.selectToken(entries),'current');
 assert.equal(m.selectToken([...entries,{key,sequence:3n,type:0}]),null);
});
test('malformed LevelDB data fails closed',()=>{
 assert.equal(typeof m.readTable,'function');
 assert.throws(()=>m.readTable(Buffer.alloc(50)),/TABLE_FORMAT/);
});
