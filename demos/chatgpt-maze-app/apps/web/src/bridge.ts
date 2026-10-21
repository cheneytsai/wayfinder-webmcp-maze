import { App } from '@modelcontextprotocol/ext-apps';
import { descriptions, toolNames, type ToolName, type VisibleState } from '@maze/core';
export type ToolResult={isError?:boolean;content?:{type:string;text?:string}[];structuredContent?:Record<string,unknown>;_meta?:{state?:VisibleState}};
const embedded=window.parent!==window;
let current:VisibleState|undefined;
let connected=false;
const listeners=new Set<(r:ToolResult,name:string)=>void>();
export const app=embedded?new App({name:'wayfinder-maze',version:'1.0.0'},{tools:{}}):undefined;
function receive(r:ToolResult,name='agent tool') {
  const state=r._meta?.state;
  // Ignore stale delivery from an earlier request within the same maze.
  if(state&&current?.mazeId===state.mazeId&&state.version<current.version)return;
  if(state)current=state;
  listeners.forEach(l=>l(r,name));
}
if(app)app.ontoolresult=params=>receive(params as ToolResult);
export const ready=app?app.connect().then(()=>{connected=true;}).catch(error=>{throw new Error(`ChatGPT connection failed: ${error instanceof Error?error.message:String(error)}`);}):Promise.resolve();
// Prevent an unhandled rejection before React attaches its status listener.
void ready.catch(()=>{});
export function subscribe(listener:(r:ToolResult,name:string)=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function getCurrent(){return current;}
export function isEmbedded(){return embedded;}
export async function callTool(name:ToolName,args:Record<string,unknown>={}) {
  const payload=name==='start_game'?args:{mazeId:current?.mazeId,...args};
  let result:ToolResult;
  if(app){await ready;result=await app.callServerTool({name,arguments:payload}) as ToolResult;}
  else {
    const response=await fetch(`/api/tools/${name}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'Tool request failed');result=data;
  }
  receive(result,name);
  if(result.isError)throw new Error(result.content?.map(c=>c.text??'').join('\n')??'Tool failed');
  return result;
}
export async function askAgent(){
  if(!app||!connected)throw new Error('Connect this app in ChatGPT to ask its agent to solve the maze.');
  if(!current)throw new Error('Create a maze first.');
  await app.sendMessage({role:'user',content:[{type:'text',text:`Solve my current maze ${current.mazeId} using look, move, pickup, drop and use tools. Remember visited cells and backtrack. Keep going until atExit is true; do not start another maze.`}]});
}
// Browser agents use the same remote authoritative handlers as ChatGPT.
// API location has changed during WebMCP preview; support both live variants.
export function registerWebMcp(){
  const context=(navigator as unknown as {modelContext?:WebMCP.ModelContext}).modelContext??document.modelContext;
  if(!context)return false;
  for(const name of toolNames){
    const inputSchema=name==='start_game'?{type:'object',properties:{rows:{type:'integer',minimum:2,maximum:40},cols:{type:'integer',minimum:2,maximum:40},items:{type:'boolean'}},additionalProperties:false}
      :{type:'object',properties:{...(['move','use'].includes(name)?{direction:{type:'string',enum:['north','south','east','west']}}:{})},...(['move','use'].includes(name)?{required:['direction']}:{ }),additionalProperties:false};
    context.registerTool({name,description:descriptions[name],inputSchema,annotations:{readOnlyHint:name==='look'},execute:async args=>{
      const result=await callTool(name,args);
      return result.structuredContent;
    }});
  }
  return true;
}
window.gameTools={async executeTool(name,args){if(!toolNames.includes(name as ToolName))throw new Error('Unknown game tool');return (await callTool(name as ToolName,args)).structuredContent;}};
