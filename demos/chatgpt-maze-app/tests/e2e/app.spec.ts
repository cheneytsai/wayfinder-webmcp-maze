import {test,expect} from '@playwright/test';
import {explore} from '../../scripts/explore';
test('creates rectangular maze, registers real WebMCP callbacks, and solves through browser tools',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const tools:Record<string,unknown>={};Object.defineProperty(navigator,'modelContext',{value:{registerTool(tool:any){tools[tool.name]=tool;}}});(window as any).__registered=tools;});
 await page.goto('/');await expect(page.getByText('WebMCP active')).toBeVisible();
 expect(await page.evaluate(()=>Object.keys((window as any).__registered).sort())).toEqual(['drop','look','move','pickup','start_game','use']);
 await page.getByLabel('Rows',{exact:true}).fill('6');await page.getByLabel('Columns',{exact:true}).fill('9');await page.getByText('Add keys, doors & rocks').click();
 await page.getByRole('button',{name:'Create maze'}).click();await expect(page.getByRole('img',{name:/6 by 9 maze/})).toBeVisible();
 const start=await page.evaluate(async()=>await (window as any).__registered.look.execute({}));
 const result=await explore(async(name,args)=>({structuredContent:await page.evaluate(async({name,args})=>await (window as any).__registered[name].execute(args),{name,args})}),start.mazeId);
 expect(result.atExit).toBe(true);await expect(page.getByRole('status')).toContainText('Exit reached');await expect(page.getByRole('button',{name:'Ask agent to explore'})).toBeDisabled();
 expect(errors).toEqual([]);
});
test('validates grid input, handles failed requests, and keeps layout within mobile viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByLabel('Rows',{exact:true}).fill('41');await expect(page.getByRole('button',{name:'Create maze'})).toBeDisabled();
 await page.getByLabel('Rows',{exact:true}).fill('4');await page.getByLabel('Columns',{exact:true}).fill('8');
 await page.route('**/api/tools/start_game',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Temporary server failure'})}));
 await page.getByRole('button',{name:'Create maze'}).click();await expect(page.getByRole('alert')).toHaveText('Temporary server failure');await expect(page.getByRole('button',{name:'Create maze'})).toBeEnabled();await page.unroute('**/api/tools/start_game');
 await page.getByRole('button',{name:'Create maze'}).click();await expect(page.getByRole('img',{name:/4 by 8 maze/})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile-maze.png',fullPage:true});
});
test('shows reusable component gallery',async({page})=>{await page.goto('/?gallery');await expect(page.getByRole('heading',{name:'Wayfinder component library'})).toBeVisible();await expect(page.getByRole('button',{name:'Primary action'})).toBeVisible();});
test('MCP Apps iframe initializes, accepts agent results, calls host tools and sends an agent prompt',async({page,request})=>{
 const initial=await (await request.post('/api/tools/start_game',{data:{rows:8,cols:12}})).json();
 await page.goto('/health');
 // Host shim implements the documented MCP Apps JSON-RPC handshake. No ChatGPT account required.
 await page.evaluate(({initial})=>{
  document.body.innerHTML='<iframe title="Maze MCP App" style="width:1100px;height:1200px;border:0" src="/"></iframe>';
  (window as any).__hostCalls=[];(window as any).__messages=[];
  window.addEventListener('message',async event=>{
   const frame=document.querySelector('iframe')!;if(event.source!==frame.contentWindow)return;
   const m=event.data;if(m?.jsonrpc!=='2.0')return;
   const respond=(result:any)=>frame.contentWindow!.postMessage({jsonrpc:'2.0',id:m.id,result},location.origin);
   if(m.method==='ui/initialize')respond({protocolVersion:m.params.protocolVersion,hostInfo:{name:'test-host',version:'1.0.0'},hostCapabilities:{serverTools:{},message:{text:{}}},hostContext:{theme:'light',displayMode:'inline'}});
   else if(m.method==='ui/notifications/initialized')frame.contentWindow!.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:initial},location.origin);
   else if(m.method==='tools/call'){(window as any).__hostCalls.push(m.params);const r=await fetch(`/api/tools/${m.params.name}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(m.params.arguments)});respond(await r.json());}
   else if(m.method==='ui/message'){(window as any).__messages.push(m.params);respond({});}
   else if(m.id!==undefined)respond({});
  });
 },{initial});
 const frame=page.frameLocator('iframe');await expect(frame.getByRole('img',{name:/8 by 12 maze/})).toBeVisible();
 await frame.getByRole('button',{name:'Ask agent to explore'}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__messages.length)).toBe(1);
 const messages=await page.evaluate(()=>(window as any).__messages);expect(messages[0].content[0].text).toContain(initial.structuredContent.mazeId);
 await frame.getByLabel('Rows',{exact:true}).fill('4');await frame.getByLabel('Columns',{exact:true}).fill('6');await frame.getByRole('button',{name:'Create a new maze'}).click();await expect(frame.getByRole('img',{name:/4 by 6 maze/})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__hostCalls[0])).toMatchObject({name:'start_game',arguments:{rows:4,cols:6}});
 // Agent-initiated tool result updates the same mounted view.
 const fresh=await page.evaluate(()=>(window as any).__hostCalls[0]);expect(fresh).toBeTruthy();
 await page.setViewportSize({width:1280,height:1000});await page.screenshot({path:'test-results/mcp-app-desktop.png',fullPage:true});
});
