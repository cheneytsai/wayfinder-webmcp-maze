/** Reference agent: observations and primitive tool calls only. No engine or hidden-map access. */
export type Call=(name:string,args:Record<string,unknown>)=>Promise<any>;
const delta:Record<string,[number,number]>={north:[-1,0],south:[1,0],east:[0,1],west:[0,-1]};
const opposite:Record<string,string>={north:'south',south:'north',east:'west',west:'east'};
const matches:Record<string,string>={door_red:'key_red',door_blue:'key_blue',door_green:'key_green',rock:'dynamite'};
export async function explore(call:Call,mazeId:string,maxCalls=100000){
 const graph=new Map<string,Map<string,string>>(),observations=new Map<string,any>();
 let count=0,obs:any;
 const act=async(name:string,args:Record<string,unknown>={})=>{
  if(++count>maxCalls)throw new Error('Agent call budget exhausted');
  const r=await call(name,{mazeId,...args});if(r.isError)throw new Error(JSON.stringify(r.content));
  const o=r.structuredContent;if(!o?.position)throw new Error('Missing observation');obs=o;
  const key=`${o.position.row},${o.position.col}`;observations.set(key,o);if(!graph.has(key))graph.set(key,new Map());
  for(const d of o.openDirections){const [dr,dc]=delta[d],next=`${o.position.row+dr},${o.position.col+dc}`;graph.get(key)!.set(d,next);if(!graph.has(next))graph.set(next,new Map());graph.get(next)!.set(opposite[d],key);}
  return o;
 };
 await act('look');
 const route=(target:string)=>{
  const start=`${obs.position.row},${obs.position.col}`;const queue=[start],prev=new Map<string,{key:string;d:string}>(),seen=new Set([start]);
  for(let i=0;i<queue.length;i++){if(queue[i]===target){const steps:string[]=[];let k=target;while(k!==start){const p=prev.get(k)!;steps.unshift(p.d);k=p.key;}return steps;}
   for(const[d,n]of graph.get(queue[i])??[]){if(!seen.has(n)){seen.add(n);prev.set(n,{key:queue[i],d});queue.push(n);}}
  }return null;
 };
 const travel=async(steps:string[])=>{for(const direction of steps){const o=await act('move',{direction});if(o.success===false)throw new Error(`Agent route blocked: ${JSON.stringify(o)}`);if(o.atExit)return;}};
 while(!obs.atExit){
  const frontier=[...graph.keys()].find(k=>!observations.has(k)&&route(k)!==null);
  if(frontier){await travel(route(frontier)!);continue;}
  // All currently reachable territory is mapped. Fetch a matching item for a known blocker.
  let plan:{key:string;direction:string;item:string;itemKey:string}|undefined;
  for(const[key,o]of observations)for(const[direction,blocker]of Object.entries(o.blockedDirections??{})){
   const item=matches[blocker as string];
   const found=[...observations].find(([k,v])=>v.collectibleHere===item&&route(k)!==null);
   if(found&&route(key)!==null){plan={key,direction,item,itemKey:found[0]};break;}
  }
  if(!plan)throw new Error('No reachable frontier or matching item');
  if(obs.inventory)await act('drop');
  await travel(route(plan.itemKey)!);if(obs.atExit)break;
  await act('pickup');await travel(route(plan.key)!);if(obs.atExit)break;
  const used=await act('use',{direction:plan.direction});if(!used.success)throw new Error('Could not clear blocker');
  // Refresh both sides of a removed blocker as those cached observations may be stale.
  for(const o of observations.values())for(const d of Object.keys(o.blockedDirections??{})){
    if(o.position.row===used.position.row&&o.position.col===used.position.col)delete o.blockedDirections[d];
  }
 }
 return {calls:count,moves:obs.moveCount,atExit:obs.atExit};
}
