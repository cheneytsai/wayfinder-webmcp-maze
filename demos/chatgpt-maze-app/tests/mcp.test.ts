import { it,expect } from 'vitest';
import {request as httpRequest} from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MazeService } from '../apps/server/src/service.ts';
import { createHttpServer } from '../apps/server/src/index.ts';
import { explore } from '../scripts/explore.ts';
it('serves MCP discovery, inline UI and complete tool-driven games over Streamable HTTP',async()=>{
 const service=new MazeService(':memory:');const {server}=createHttpServer({service});await new Promise<void>((r,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',r);});const address=server.address() as {port:number};
 const base=`http://127.0.0.1:${address.port}`;const client=new Client({name:'test-agent',version:'1.0.0'});
 try{
 await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
 const tools=await client.listTools();expect(tools.tools.map(t=>t.name).sort()).toEqual(['start_game','look','move','pickup','drop','use'].sort());
 for(const t of tools.tools)expect(t._meta?.ui).toMatchObject({resourceUri:'ui://maze/app-v1.html'});
 const resource=await client.readResource({uri:'ui://maze/app-v1.html'});expect(resource.contents[0].mimeType).toBe('text/html;profile=mcp-app');expect((resource.contents[0] as {text:string}).text).toContain('wayfinder');expect((resource.contents[0] as {text:string}).text).not.toContain('src="/src/');
 for(const items of [false,true]){const start=await client.callTool({name:'start_game',arguments:{rows:7,cols:9,items}});const id=(start.structuredContent as any).mazeId;const solved=await explore((name,args)=>client.callTool({name,arguments:args}),id);expect(solved.atExit).toBe(true);}
 const invalid=await client.callTool({name:'start_game',arguments:{rows:10000}});expect(invalid.isError).toBe(true);
 expect((await fetch(`${base}/health`)).status).toBe(200);
 expect((await fetch(`${base}/api/tools/start_game`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({rows:2,cols:3})})).status).toBe(200);
 expect((await fetch(`${base}/api/tools/start_game`,{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'})).status).toBe(403);
 expect((await fetch(`${base}/api/tools/start_game`,{method:'POST',body:'{}'})).status).toBe(415);
 expect((await fetch(`${base}/api/tools/start_game`,{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(17000)})).status).toBe(400);
 const rejectedHost=await new Promise<number|undefined>((resolve,reject)=>{const req=httpRequest(`${base}/mcp`,{method:'POST',headers:{host:'evil.example','content-type':'application/json'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end('{}');});expect(rejectedHost).toBe(403);
 }finally{await client.close();await new Promise<void>(r=>server.close(()=>r()));service.close();}
},60000);
