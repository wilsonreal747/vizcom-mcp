import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const module = await import('../src/client.mjs').catch(()=>({}));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function fixture(t,handler){
 const server=createServer(async(req,res)=>{try{await handler(req,res);}catch(e){res.statusCode=500;res.end(String(e));}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
 return `http://127.0.0.1:${server.address().port}`;
}
test('client exists',()=>assert.equal(typeof module.VizcomClient,'function'));
test('missing auth stops before network',async()=>{
 const client=new module.VizcomClient({token:'',fetchImpl:()=>{throw Error('network touched');}});
 await assert.rejects(()=>client.currentUser(),/AUTH_REQUIRED/);
});
test('create workbench uses the verified nested input envelope',async()=>{
 const client=new module.VizcomClient({token:'fixture'});
 client.operation=async(name,{input})=>{
  assert.equal(name,'CreateWorkbench');assert.equal(input.startInStudio,false);
  assert.equal(input.workbench.folderId,'folder');assert.equal(input.workbench.name,'test');
  assert.match(input.workbench.id,/^[a-f0-9-]{36}$/);
  return {createWorkbench:{workbench:{id:input.workbench.id}}};
 };
 await client.createWorkbench({folderId:'folder',name:'test'});
});
test('multipart upload, generation, poll and credential-free download',async t=>{
 const calls=[];let polls=0;let base;
 base=await fixture(t,async(req,res)=>{
  if(req.url==='/result.png'){assert.equal(req.headers.authorization,undefined);res.setHeader('Content-Type','image/png');return res.end(png);}
  assert.equal(req.headers.authorization,'Bearer fixture-token');
  const body=Buffer.concat(await Array.fromAsync(req));
  let op,form;
  if(req.headers['content-type'].startsWith('multipart/')){
   form=await new Request(base,{method:'POST',headers:{'content-type':req.headers['content-type']},body}).formData();op=JSON.parse(form.get('operations'));
   const map=JSON.parse(form.get('map'));assert.ok(Object.values(map).flat().some(x=>x.endsWith('.image')||x.endsWith('.data')));
   assert.deepEqual(Buffer.from(await form.get('0').arrayBuffer()),png);
  }else op=JSON.parse(body);
  calls.push(op.operationName);assert.match(op.extensions.persistedQuery.sha256Hash,/^[a-f0-9]{64}$/);
  let data;
  if(op.operationName==='CreateDrawings')data={createDrawings:{drawings:[{id:op.variables.input[0].id}]}};
  else if(op.operationName==='CreatePrompt'){assert.equal(op.variables.input.outputsCount,1);data={createPrompt:{prompt:{id:op.variables.input.id}}};}
  else if(op.operationName==='prompts')data={prompts:{nodes:[{id:op.variables.ids[0],outputs:{nodes:++polls===1?[]:[{id:'out',imagePath:base+'/result.png',failureReason:null}]}}]}};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data}));
 });
 const root=await mkdtemp(join(tmpdir(),'vizcom-test-'));const file=join(root,'sketch.png');await writeFile(file,png);
 const client=new module.VizcomClient({token:'fixture-token',endpoint:base+'/graphql',allowLocalTestServer:true});
 const drawing=await client.uploadSketch({file,workbenchId:'11111111-1111-4111-8111-111111111111'});
 const prompt=await client.render({file,drawingId:drawing.id,prompt:'test'});
 const output=await client.waitForResult(prompt.id,{intervalMs:1,timeoutMs:1000});
 const saved=await client.download(output.imagePath,join(root,'output.png'));
 assert.deepEqual(await readFile(saved.path),png);
 assert.deepEqual(calls,['CreateDrawings','CreatePrompt','prompts','prompts']);
});
test('failed billable submission is never retried and token is not in error',async t=>{
 let calls=0;const base=await fixture(t,(req,res)=>{calls++;res.statusCode=503;res.end('fixture-token');});
 const client=new module.VizcomClient({token:'fixture-token',endpoint:base,allowLocalTestServer:true});
 await assert.rejects(()=>client.operation('CreatePrompt',{input:{}}),e=>e.message.includes('HTTP_503')&&!e.message.includes('fixture-token'));
 assert.equal(calls,1);
});
test('generation failure and timeout are distinct',async()=>{
 const client=new module.VizcomClient({token:'fixture'});
 client.getResult=async()=>({outputs:{nodes:[{failureReason:'failed'}]}});
 await assert.rejects(()=>client.waitForResult('id',{timeoutMs:10,intervalMs:1}),/GENERATION_FAILED/);
 client.getResult=async()=>({outputs:{nodes:[]}});
 await assert.rejects(()=>client.waitForResult('id',{timeoutMs:5,intervalMs:1}),/POLL_TIMEOUT/);
});
test('downloads retain actual WebP format instead of a misleading PNG extension',async t=>{
 const bytes=Buffer.from('RIFF1234WEBPfixture');
 const base=await fixture(t,(req,res)=>{res.setHeader('Content-Type','image/webp');res.end(bytes);});
 const root=await mkdtemp(join(tmpdir(),'vizcom-format-'));
 const client=new module.VizcomClient({token:'fixture',endpoint:base,allowLocalTestServer:true});
 const saved=await client.download(base+'/output',join(root,'result.png'));
 assert.equal(saved.path,join(root,'result.webp'));assert.deepEqual(await readFile(saved.path),bytes);
});
