import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createGame, execute, saveGame, loadGame, visibleState, schemaFor, type ToolName, type SavedGame } from '@maze/core';
export class MazeService {
  private db:DatabaseSync;
  private queue:Promise<unknown>=Promise.resolve();
  constructor(path='data/mazes.sqlite') {
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
    this.db=new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS mazes (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL)');
  }
  close(){this.db.close();}
  call(name:ToolName,raw:unknown):Promise<any> {
    const work=this.queue.then(()=>this.perform(name,raw));this.queue=work.catch(()=>{});return work;
  }
  private async perform(name:ToolName,raw:unknown) {
    const args=schemaFor(name).parse(raw) as Record<string,any>;
    let id=args.mazeId as string, saved:SavedGame, result:Record<string,unknown>;
    if(name==='start_game') {
      this.db.prepare('DELETE FROM mazes WHERE updated < ?').run(Date.now()-86400000);
      const count=this.db.prepare('SELECT COUNT(*) AS n FROM mazes').get() as {n:number};
      if(count.n>=1000)throw new Error('Maze capacity reached. Try again later.');
      id=randomUUID();const game=createGame(args.rows,args.cols,args.items);saved=saveGame(game,0,args.items);
      result={success:true,...await execute(game,'look')};
    }else {
      const row=this.db.prepare('SELECT state FROM mazes WHERE id=? AND updated >= ?').get(id,Date.now()-86400000) as {state:string}|undefined;
      if(!row)throw new Error('Maze not found or expired. Initialize a new maze with start_game.');
      saved=JSON.parse(row.state);
      if(args.expectedVersion!==undefined&&args.expectedVersion!==saved.version)throw new Error('Stale maze version. Call look and retry using its version.');
      const game=loadGame(saved);
      if(name!=='look'&&game.board.isExit(game.player.position))result={success:false,reason:'Maze already completed. Start a new maze to play again.'};
      else result=await execute(game,name,args);
      saved=saveGame(game,saved.version+(name!=='look'&&result.success!==false?1:0),saved.items);
      result={...await execute(game,'look'),...result};
    }
    this.db.prepare('INSERT INTO mazes(id,state,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated=excluded.updated').run(id,JSON.stringify(saved),Date.now());
    const structuredContent={mazeId:id,version:saved.version,...result};
    return {content:[{type:'text' as const,text:JSON.stringify(structuredContent)}],structuredContent,_meta:{state:visibleState(id,saved)}};
  }
}
