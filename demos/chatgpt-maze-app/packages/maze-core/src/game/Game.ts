/** Headless adapter replacing upstream PixiJS orchestration. Modified for MCP Apps. */
import { MazeBoard } from './MazeBoard.ts';
import { Player } from './Player.ts';
export class Game {
  player = new Player();
  renderer = {
    animatePlayerMove: async (..._args: unknown[]) => {},
    updateFog: (..._args: unknown[]) => {},
    updateCollectibles: (..._args: unknown[]) => {},
    updateBlockers: (..._args: unknown[]) => {},
  };
  gameplayState = undefined as undefined | {
    updateMoveCount(n: number): void; updateExploredCount(): void; updateInventory(): void;
  };
  constructor(public board: MazeBoard) {}
}
