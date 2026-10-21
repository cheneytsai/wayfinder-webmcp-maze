import { z } from 'zod';
import { Game } from './game/Game.ts';
import { MazeBoard } from './game/MazeBoard.ts';
import { RecursiveBacktracker } from './generation/RecursiveBacktracker.ts';
import { Direction, CollectibleType, BlockerType, OPPOSITE_DIRECTION, type Position, type Cell, type Collectible, type Blocker } from './types/index.ts';
import { createLookTool } from './webmcp/tools/LookTool.ts';
import { createMoveTool } from './webmcp/tools/MoveTool.ts';
import { createPickupTool } from './webmcp/tools/PickupTool.ts';
import { createDropTool } from './webmcp/tools/DropTool.ts';
import { createUseTool } from './webmcp/tools/UseTool.ts';
export { Direction, OPPOSITE_DIRECTION } from './types/index.ts';
export const startSchema = z.object({ rows: z.number().int().min(2).max(40).default(10), cols: z.number().int().min(2).max(40).default(10), items: z.boolean().default(false) }).strict();
export const actionSchema = z.object({ mazeId: z.string().uuid(), expectedVersion: z.number().int().min(0).optional() });
export const directionSchema = actionSchema.extend({ direction: z.nativeEnum(Direction) }).strict();
export const toolNames = ['start_game','look','move','pickup','drop','use'] as const;
export type ToolName = typeof toolNames[number];
export const descriptions: Record<ToolName,string> = {
  start_game: 'Create a new maze with rows and cols (each 2–40, defaults 10). Set items=true for keys, doors and rocks. Keep the returned mazeId for every subsequent call. Never start a new maze when asked to continue or solve the current one.',
  look: 'Inspect the current cell: position, open directions, blockers, collectible, inventory, and atExit. To solve, explore with look and move, remember visited cells and backtrack at dead ends. Stop when atExit is true. No hidden map or solver is provided.',
  move: 'Move exactly one cell north, south, east or west using this maze\'s WebMCP handler. Check success and atExit; walls and blockers cannot be bypassed. Optional expectedVersion prevents stale writes.',
  pickup: 'Pick up the current cell\'s key or dynamite. Inventory holds one item. Use look to inspect first.',
  drop: 'Drop the held item on an empty cell; remember where you left it.',
  use: 'Use a held key on a matching colored door, or dynamite on a rock in the given direction. Clears the passage in both directions and consumes the item.'
};
export function schemaFor(name: ToolName) { return name === 'start_game' ? startSchema : name === 'move' || name === 'use' ? directionSchema : actionSchema.strict(); }
export type SavedGame = { rows:number; cols:number; cells:Cell[]; revealed:Position[]; collectibles:Collectible[]; blockers:Blocker[]; position:Position; inventory:CollectibleType|null; moveCount:number; version:number; items:boolean };
export type VisibleState = { mazeId:string; rows:number; cols:number; version:number; cells:(Cell & { collectible:string|null; blockers:Partial<Record<Direction,string>> })[]; position:Position; inventory:string|null; moveCount:number; atExit:boolean; explored:number; items:boolean };
export function createGame(rows:number, cols:number, items=false): Game {
  startSchema.parse({rows,cols,items});
  const board = new MazeBoard(rows,cols);
  new RecursiveBacktracker().generate(board);
  if(items) placeItems(board);
  board.revealFrom({row:0,col:0});
  return new Game(board);
}
// Modified placement: successive matching items on the unique start-to-exit path.
// Each item lies after the previous blocker and before its own; one-slot inventory always suffices.
function placeItems(board:MazeBoard) {
  const parents = new Map<string,{pos:Position; dir:Direction}>();
  const queue:Position[]=[{row:0,col:0}]; const seen=new Set(['0,0']);
  for(let i=0;i<queue.length;i++) for(const dir of board.openDirections(queue[i])) {
    const next=board.neighbor(queue[i],dir)!; const k=`${next.row},${next.col}`;
    if(!seen.has(k)){ seen.add(k); parents.set(k,{pos:queue[i],dir});queue.push(next); }
  }
  const path:{pos:Position;dir:Direction}[]=[]; let p=board.exit;
  while(p.row||p.col){const parent=parents.get(`${p.row},${p.col}`)!;path.unshift(parent);p=parent.pos;}
  const pairs = [[CollectibleType.KeyRed,BlockerType.DoorRed],[CollectibleType.Dynamite,BlockerType.Rock],[CollectibleType.KeyBlue,BlockerType.DoorBlue],[CollectibleType.KeyGreen,BlockerType.DoorGreen]] as const;
  const count=Math.min(4,Math.floor(path.length/3));
  for(let i=0;i<count;i++){
    const begin=Math.floor(i*path.length/count), end=Math.floor((i+1)*path.length/count)-1;
    const [item,blocker]=pairs[i]; const edge=path[end];
    board.addCollectible({type:item,position:{...path[begin].pos}});
    board.addBlocker({type:blocker,position:{...edge.pos},direction:edge.dir});
    board.addBlocker({type:blocker,position:board.neighbor(edge.pos,edge.dir)!,direction:OPPOSITE_DIRECTION[edge.dir]});
  }
}
export function gameTools(game:Game) { return [createLookTool(game),createMoveTool(game),createPickupTool(game),createDropTool(game),createUseTool(game)]; }
export async function execute(game:Game,name:Exclude<ToolName,'start_game'>,args:Record<string,unknown>={}) {
  const tool=gameTools(game).find(t=>t.name===name)!;
  return await tool.execute(args,{} as WebMCP.ToolExecuteCallbackOptions) as Record<string,unknown>;
}
export function saveGame(game:Game,version:number,items:boolean):SavedGame {
  const b=game.board; const cells:Cell[]=[],revealed:Position[]=[];
  for(let row=0;row<b.rows;row++)for(let col=0;col<b.cols;col++){ const p={row,col}; cells.push(b.getCell(p)!); if(b.isRevealed(p))revealed.push(p); }
  return {rows:b.rows,cols:b.cols,cells,revealed,collectibles:b.getAllCollectibles(),blockers:b.getAllBlockers(),position:game.player.position,inventory:game.player.inventory,moveCount:game.player.moveCount,version,items};
}
export function loadGame(s:SavedGame):Game {
  const b=new MazeBoard(s.rows,s.cols);
  for(const c of s.cells)for(const d of Object.values(Direction))if(!c.walls[d])b.removeWall(c,d);
  s.revealed.forEach(p=>b.revealCell(p));s.collectibles.forEach(c=>b.addCollectible(c));s.blockers.forEach(c=>b.addBlocker(c));
  const game=new Game(b); game.player.position={...s.position};game.player.inventory=s.inventory;game.player.moveCount=s.moveCount; return game;
}
export function visibleState(id:string,s:SavedGame):VisibleState {
  const revealed=new Set(s.revealed.map(p=>`${p.row},${p.col}`));
  return {mazeId:id,rows:s.rows,cols:s.cols,version:s.version,position:s.position,inventory:s.inventory,moveCount:s.moveCount,atExit:s.position.row===s.rows-1&&s.position.col===s.cols-1,explored:s.revealed.length,items:s.items,
    cells:s.cells.filter(c=>revealed.has(`${c.row},${c.col}`)).map(c=>({...c,collectible:s.collectibles.find(i=>i.position.row===c.row&&i.position.col===c.col)?.type??null,blockers:Object.fromEntries(s.blockers.filter(b=>b.position.row===c.row&&b.position.col===c.col).map(b=>[b.direction,b.type]))}))};
}
