import {describe,it,expect,afterEach} from 'vitest';
import { MazeService } from '../apps/server/src/service.ts';
import { explore } from '../scripts/explore.ts';
import { createGame,saveGame,loadGame,execute,visibleState,Direction } from '@maze/core';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const services:MazeService[]=[];
function service(path=':memory:'){const s=new MazeService(path);services.push(s);return s;}
afterEach(()=>{services.splice(0).forEach(s=>s.close());});
describe('maze configuration and privacy',()=>{
 it.each([{rows:1},{rows:41},{cols:0},{cols:2.5},{rows:'10'},{rows:Infinity},{items:'yes'},{seed:'unrecognized'}])('rejects invalid config %j',async args=>{await expect(service().call('start_game',args)).rejects.toThrow();});
 it('defaults dimensions and exposes only discovered cells in UI metadata',async()=>{const r=await service().call('start_game',{});expect(r.structuredContent.mazeSize).toEqual({rows:10,cols:10});expect(r._meta.state.cells.length).toBeLessThan(100);expect(r.structuredContent).not.toHaveProperty('cells');expect(r.content[0].text).not.toContain('walls');});
 it.each([[2,2],[2,40],[40,2],[40,40]])('creates valid %ix%i grids',async(rows,cols)=>{const r=await service().call('start_game',{rows,cols});expect(r._meta.state.rows).toBe(rows);expect(r._meta.state.cols).toBe(cols);});
 it('rejects unknown IDs and invalid moves',async()=>{const s=service();await expect(s.call('look',{mazeId:'6d88ef3c-d1a4-44a0-b74b-42ec2c13ee16'})).rejects.toThrow('not found');const r=await s.call('start_game',{});await expect(s.call('move',{mazeId:r.structuredContent.mazeId,direction:'teleport'})).rejects.toThrow();});
});
describe('persistence and concurrency',()=>{
 it('preserves progress across process store reopen',async()=>{const dir=mkdtempSync(join(tmpdir(),'maze-test-'));const path=join(dir,'maze.sqlite');const s=new MazeService(path);const start=await s.call('start_game',{rows:8,cols:6,items:true});const id=start.structuredContent.mazeId;const moved=await s.call('move',{mazeId:id,direction:start.structuredContent.openDirections[0]});s.close();const reopened=new MazeService(path);try{expect((await reopened.call('look',{mazeId:id}))._meta.state).toEqual(moved._meta.state);}finally{reopened.close();rmSync(dir,{recursive:true});}});
 it('isolates multiple mazes',async()=>{const s=service(),a=await s.call('start_game',{}),b=await s.call('start_game',{});await s.call('move',{mazeId:a.structuredContent.mazeId,direction:a.structuredContent.openDirections[0]});expect((await s.call('look',{mazeId:b.structuredContent.mazeId})).structuredContent.moveCount).toBe(0);});
 it('rejects stale simultaneous writes without losing progress',async()=>{const s=service();const a=(await s.call('start_game',{})).structuredContent;const args={mazeId:a.mazeId,expectedVersion:0,direction:a.openDirections[0]};const results=await Promise.allSettled([s.call('move',args),s.call('move',args)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await s.call('look',{mazeId:a.mazeId})).structuredContent.moveCount).toBe(1);});
 it('roundtrips engine walls, inventory, fog and blockers',()=>{const game=createGame(12,8,true);const saved=saveGame(game,4,true);expect(saveGame(loadGame(saved),4,true)).toEqual(saved);expect(visibleState('id',saved).cells.length).toBeLessThan(96);});
 it('blocked movement does not increment version or count',async()=>{const s=service();const a=(await s.call('start_game',{})).structuredContent;const r=await s.call('move',{mazeId:a.mazeId,direction:'north'});expect(r.structuredContent.success).toBe(false);expect(r.structuredContent.version).toBe(0);expect(r.structuredContent.moveCount).toBe(0);});
});
describe('observation-only agent runs',()=>{
 it('solves 60 randomized classic and item mazes through real primitive handlers',async()=>{const s=service();for(let i=0;i<60;i++){const rows=2+(i*7)%17,cols=2+(i*11)%17;const r=await s.call('start_game',{rows,cols,items:i%2===0});const result=await explore((name,args)=>s.call(name as any,args),r.structuredContent.mazeId);expect(result.atExit,`maze ${i}: ${rows}x${cols}`).toBe(true);const final=await s.call('look',{mazeId:r.structuredContent.mazeId});const blocked=await s.call('move',{mazeId:r.structuredContent.mazeId,direction:'north'});expect(blocked.structuredContent.success).toBe(false);expect(blocked.structuredContent.moveCount).toBe(final.structuredContent.moveCount);}});
 it('preserves pickup, drop and wrong-item behavior',async()=>{const g=createGame(4,4);g.board.addCollectible({type:'key_red' as any,position:{row:0,col:0}});expect((await execute(g,'pickup')).success).toBe(true);expect((await execute(g,'use',{direction:Direction.East})).success).toBe(false);expect((await execute(g,'drop')).success).toBe(true);expect((await execute(g,'drop')).success).toBe(false);expect((await execute(g,'pickup')).success).toBe(true);});
});
