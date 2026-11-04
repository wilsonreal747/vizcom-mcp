import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
test('stdio MCP discovery and explicit unauthenticated status',async t=>{
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/server.mjs',import.meta.url))],env:{VIZCOM_ACCESS_TOKEN:''},stderr:'pipe'});
 const client=new Client({name:'smoke-test',version:'1.0'});t.after(()=>client.close());
 await client.connect(transport);
 const {tools}=await client.listTools();assert.equal(tools.length,21);
 const result=await client.callTool({name:'vizcom_status',arguments:{}});
 assert.equal(result.isError,true);assert.match(result.content[0].text,/AUTH_REQUIRED/);
 const traversal=await client.callTool({name:'vizcom_upload_sketch',arguments:{file:'../package.json',workbenchId:'11111111-1111-4111-8111-111111111111'}});
 assert.equal(traversal.isError,true);assert.match(traversal.content[0].text,/INPUT_OUTSIDE_ROOT/);
});
