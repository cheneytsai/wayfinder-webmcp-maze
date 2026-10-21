import { createServer, type IncomingMessage } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { toolNames, type ToolName } from '@maze/core';
import { MazeService } from './service.ts';
import { createMcpServer } from './mcp.ts';
async function body(req:IncomingMessage) {const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw new Error('Request too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
export function createHttpServer({service=new MazeService(process.env.DB_PATH),html=readFileSync(resolve('apps/web/dist/index.html'),'utf8')}={}) {
  const publicOrigin=process.env.PUBLIC_ORIGIN;
  const allowedHosts=new Set(['localhost','127.0.0.1','[::1]',...(publicOrigin?[new URL(publicOrigin).hostname]:[]),...(process.env.ALLOWED_HOSTS?.split(',')??[])]);
  let requests=0,creates=0,windowStart=Date.now();
  const server=createServer(async(req,res)=>{
    const headers={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
    const json=(status:number,value:unknown)=>{res.writeHead(status,headers);res.end(JSON.stringify(value));};
    try{
      const host=new URL(`http://${req.headers.host??'localhost'}`).hostname;
      if(!allowedHosts.has(host))return json(403,{error:'Host not allowed. Configure PUBLIC_ORIGIN or ALLOWED_HOSTS.'});
      if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host&&req.headers.origin!==publicOrigin&&!['https://chatgpt.com','https://chat.openai.com'].includes(req.headers.origin))return json(403,{error:'Origin not allowed'});}
      const url=new URL(req.url??'/',`http://${req.headers.host??'localhost'}`);
      if(Date.now()-windowStart>60000){requests=0;creates=0;windowStart=Date.now();}
      if(++requests>2400){res.setHeader('retry-after','60');return json(429,{error:'Rate limit exceeded'});}
      if(req.method==='GET'&&url.pathname==='/health')return json(200,{status:'ok',name:'webmcp-maze'});
      if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});return res.end(html);}
      if(url.pathname==='/mcp'){
        if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':req.headers.origin??'https://chatgpt.com','access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'Content-Type,Mcp-Session-Id,MCP-Protocol-Version','access-control-expose-headers':'Mcp-Session-Id','vary':'Origin'});return res.end();}
        if(!['POST','GET','DELETE'].includes(req.method??''))return json(405,{error:'Method not allowed'});
        // Limit maze creation for either MCP or browser callers inside the shared service via capacity;
        // the endpoint also has a global request budget.
        const mcp=createMcpServer(service,html);
        const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
        res.on('close',()=>{void transport.close();void mcp.close();});
        await mcp.connect(transport);await transport.handleRequest(req,res);return;
      }
      if(req.method==='POST'&&url.pathname.startsWith('/api/tools/')){
        if(!req.headers['content-type']?.includes('application/json'))return json(415,{error:'Use application/json'});
        const name=url.pathname.slice('/api/tools/'.length) as ToolName;
        if(!toolNames.includes(name))return json(404,{error:'Unknown tool'});
        if(name==='start_game'&&++creates>60)return json(429,{error:'Maze creation rate exceeded'});
        return json(200,await service.call(name,await body(req)));
      }
      json(404,{error:'Not found'});
    }catch(error){if(!res.headersSent)json(400,{error:error instanceof Error?error.message:'Invalid request'});else res.end();}
  });
  return {server,service};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const {server,service}=createHttpServer();const port=Number(process.env.PORT??8787);
  server.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`Maze app: http://localhost:${port} · MCP: http://localhost:${port}/mcp`));
  for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{server.close(()=>{service.close();process.exit(0);});server.closeIdleConnections();});
}
