import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { descriptions, schemaFor, toolNames } from '@maze/core';
import type { MazeService } from './service.ts';
export const RESOURCE_URI='ui://maze/app-v1.html';
export function createMcpServer(service:MazeService,html:string) {
  const server=new McpServer({name:'webmcp-maze',version:'1.0.0'},{instructions:'Initialize with start_game(rows,cols,items). Keep mazeId. Solve through look/move/pickup/drop/use only; explore and backtrack using observations. Do not invent a solution or restart an active maze. Stop when atExit=true. The UI shows discovered cells only.'});
  registerAppResource(server,'maze-app',RESOURCE_URI,{},async()=>({contents:[{uri:RESOURCE_URI,mimeType:RESOURCE_MIME_TYPE,text:html,_meta:{ui:{csp:{connectDomains:[],resourceDomains:[]}},'openai/widgetDescription':'Interactive maze showing fog of war, player, inventory and agent tool activity.'}}]}));
  for(const name of toolNames)registerAppTool(server,name,{
    title:name==='start_game'?'Create a maze':name[0].toUpperCase()+name.slice(1),description:descriptions[name],inputSchema:schemaFor(name).shape,
    annotations:{readOnlyHint:name==='look',destructiveHint:false,idempotentHint:name==='look',openWorldHint:false},
    _meta:{ui:{resourceUri:RESOURCE_URI,visibility:['model','app']},'openai/outputTemplate':RESOURCE_URI,'openai/toolInvocation/invoking':name==='start_game'?'Carving your maze…':'Exploring the maze…','openai/toolInvocation/invoked':name==='start_game'?'Maze ready':'Maze updated'},
  },async (args:Record<string,unknown>)=>{try{return await service.call(name,args);}catch(error){return {isError:true,content:[{type:'text' as const,text:error instanceof Error?error.message:'Tool failed'}]};}});
  return server;
}
