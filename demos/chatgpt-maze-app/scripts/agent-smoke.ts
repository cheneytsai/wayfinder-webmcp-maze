import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {explore} from './explore.ts';
const client=new Client({name:'maze-reference-agent',version:'1.0.0'});
try{
 await client.connect(new StreamableHTTPClientTransport(new URL(process.env.MCP_URL??'http://127.0.0.1:8787/mcp')));
 const start=await client.callTool({name:'start_game',arguments:{rows:Number(process.env.ROWS??8),cols:Number(process.env.COLS??10),items:process.env.ITEMS==='true'}});
 if(start.isError)throw new Error(JSON.stringify(start.content));
 const id=(start.structuredContent as any).mazeId;
 console.log(JSON.stringify({mazeId:id,...await explore((name,args)=>client.callTool({name,arguments:args}),id)},null,2));
}finally{await client.close();}
