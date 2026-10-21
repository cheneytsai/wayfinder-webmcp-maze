/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type MazeBoard } from "../game/MazeBoard.ts";
import {
  type Position,
  Direction,
  CollectibleType,
  BlockerType,
  canUnlock,
  DIRECTION_OFFSETS,
  OPPOSITE_DIRECTION,
} from "../types/index.ts";

/** A passage between two cells identified by position and direction. */
interface Passage {
  pos: Position;
  dir: Direction;
}

/** Pairs a blocker type with the collectible that clears it. */
interface BlockerPair {
  blockerType: BlockerType;
  collectibleType: CollectibleType;
}

/** All possible blocker/collectible pairings. */
const BLOCKER_PAIRS: BlockerPair[] = [
  { blockerType: BlockerType.DoorRed, collectibleType: CollectibleType.KeyRed },
  {
    blockerType: BlockerType.DoorBlue,
    collectibleType: CollectibleType.KeyBlue,
  },
  {
    blockerType: BlockerType.DoorGreen,
    collectibleType: CollectibleType.KeyGreen,
  },
  { blockerType: BlockerType.Rock, collectibleType: CollectibleType.Dynamite },
];

/** Maximum placement attempts before falling back to no items. */
const MAX_ATTEMPTS = 20;

/**
 * Places collectibles and blockers on an already-generated maze.
 * Ensures the maze remains solvable after placement.
 */
export class ItemPlacer {
  /**
   * Places blockers and their matching collectibles on the board.
   * Falls back to no items if a solvable configuration cannot be found.
   * @param board - A fully-generated maze board.
   */
  place(board: MazeBoard): void {
    const totalCells = board.rows * board.cols;
    const blockerCount = Math.min(4, Math.max(2, Math.floor(totalCells / 30)));

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      this.clearItems(board);

      if (this.tryPlace(board, blockerCount)) {
        return;
      }
    }

    // Fallback: no items
    this.clearItems(board);
  }

  /**
   * Attempts a single placement of blockers and collectibles.
   * @returns `true` if the placement is solvable.
   */
  private tryPlace(board: MazeBoard, blockerCount: number): boolean {
    const start: Position = { row: 0, col: 0 };
    const distances = this.bfsDistances(board, start);
    const shortestPath = this.findShortestPath(board, start, board.exit);
    if (!shortestPath) return false;

    // Get passages along the shortest path as blocker candidates
    const pathPassages = this.pathToPassages(shortestPath);
    // Exclude first and last passage to not block start/exit cells directly
    const candidates =
      pathPassages.length > 2
        ? pathPassages.slice(1, -1)
        : pathPassages.slice();

    if (candidates.length === 0) return false;

    // Shuffle and pick blockerCount passages
    shuffle(candidates);
    const selected = candidates.slice(
      0,
      Math.min(blockerCount, candidates.length),
    );

    // Assign blocker types — ensure at least one door and one rock if possible
    const pairs = this.assignBlockerTypes(selected.length);

    for (let i = 0; i < selected.length; i++) {
      const passage = selected[i];
      const pair = pairs[i];

      // Place blocker on both sides of passage
      const neighborPos = board.neighbor(passage.pos, passage.dir);
      if (!neighborPos) continue;

      board.addBlocker({
        type: pair.blockerType,
        position: { ...passage.pos },
        direction: passage.dir,
      });
      board.addBlocker({
        type: pair.blockerType,
        position: { ...neighborPos },
        direction: OPPOSITE_DIRECTION[passage.dir],
      });

      // Place matching collectible in a reachable cell before the blocker
      const collectiblePos = this.findCollectiblePosition(
        board,
        distances,
        passage.pos,
      );
      if (!collectiblePos) return false;

      board.addCollectible({
        type: pair.collectibleType,
        position: collectiblePos,
      });
    }

    return this.isSolvable(board);
  }

  /** Removes all collectibles and blockers from the board. */
  private clearItems(board: MazeBoard): void {
    for (const c of board.getAllCollectibles()) {
      board.removeCollectible(c.position);
    }
    for (const b of board.getAllBlockers()) {
      board.removeBlocker(b.position, b.direction);
    }
  }

  /** BFS distances from a start position, ignoring blockers (walls only). */
  private bfsDistances(board: MazeBoard, start: Position): Map<string, number> {
    const dist = new Map<string, number>();
    const queue: Position[] = [start];
    dist.set(`${start.row},${start.col}`, 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = dist.get(`${current.row},${current.col}`)!;

      for (const dir of Object.values(Direction)) {
        if (board.hasWall(current, dir)) continue;
        const next = board.neighbor(current, dir);
        if (!next) continue;
        const key = `${next.row},${next.col}`;
        if (dist.has(key)) continue;
        dist.set(key, currentDist + 1);
        queue.push(next);
      }
    }

    return dist;
  }

  /** Finds shortest path using BFS (walls only, no blockers). */
  private findShortestPath(
    board: MazeBoard,
    start: Position,
    end: Position,
  ): Position[] | null {
    const parent = new Map<string, { pos: Position; key: string } | null>();
    const startKey = `${start.row},${start.col}`;
    const endKey = `${end.row},${end.col}`;
    parent.set(startKey, null);
    const queue: Position[] = [start];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.row},${current.col}`;

      if (currentKey === endKey) {
        // Reconstruct path
        const path: Position[] = [];
        let key: string | undefined = endKey;
        while (key) {
          const entry = parent.get(key);
          if (entry) {
            path.unshift(entry.pos);
            key = entry.key;
          } else {
            path.unshift(start);
            break;
          }
        }
        path.push(end);
        // Remove duplicate start if present
        if (
          path.length > 1 &&
          path[0].row === path[1].row &&
          path[0].col === path[1].col
        ) {
          path.shift();
        }
        return path;
      }

      for (const dir of Object.values(Direction)) {
        if (board.hasWall(current, dir)) continue;
        const next = board.neighbor(current, dir);
        if (!next) continue;
        const nextKey = `${next.row},${next.col}`;
        if (parent.has(nextKey)) continue;
        parent.set(nextKey, { pos: current, key: currentKey });
        queue.push(next);
      }
    }

    return null;
  }

  /** Converts a path of positions into a list of passages between consecutive cells. */
  private pathToPassages(path: Position[]): Passage[] {
    const passages: Passage[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      const dir = this.directionBetween(from, to);
      if (dir) passages.push({ pos: from, dir });
    }
    return passages;
  }

  /** Returns the direction from one adjacent cell to another. */
  private directionBetween(
    from: Position,
    to: Position,
  ): Direction | undefined {
    for (const dir of Object.values(Direction)) {
      const offset = DIRECTION_OFFSETS[dir];
      if (
        from.row + offset.row === to.row &&
        from.col + offset.col === to.col
      ) {
        return dir;
      }
    }
    return undefined;
  }

  /**
   * Assigns blocker types ensuring variety.
   * At least one rock and one door when count >= 2.
   */
  private assignBlockerTypes(count: number): BlockerPair[] {
    if (count === 0) return [];
    if (count === 1) {
      return [BLOCKER_PAIRS[Math.floor(Math.random() * BLOCKER_PAIRS.length)]];
    }

    const result: BlockerPair[] = [];
    // Ensure one rock
    result.push(BLOCKER_PAIRS[3]); // Rock/Dynamite
    // Ensure one door (random color)
    const doorIndex = Math.floor(Math.random() * 3);
    result.push(BLOCKER_PAIRS[doorIndex]);

    // Fill remaining with random
    for (let i = 2; i < count; i++) {
      result.push(
        BLOCKER_PAIRS[Math.floor(Math.random() * BLOCKER_PAIRS.length)],
      );
    }

    shuffle(result);
    return result;
  }

  /**
   * Finds a cell for a collectible that is reachable from start
   * without passing through the blocker's passage, and not on start or exit.
   */
  private findCollectiblePosition(
    board: MazeBoard,
    distances: Map<string, number>,
    blockerPos: Position,
  ): Position | null {
    const blockerDist = distances.get(`${blockerPos.row},${blockerPos.col}`);
    if (blockerDist === undefined) return null;

    // Candidate cells: reachable, closer to start than the blocker,
    // not on start, not on exit, not already holding a collectible
    const candidates: Position[] = [];
    for (const [key, dist] of distances) {
      if (dist >= blockerDist) continue;
      if (dist === 0) continue; // skip start
      const [r, c] = key.split(",").map(Number);
      const pos: Position = { row: r, col: c };
      if (board.isExit(pos)) continue;
      if (board.getCollectible(pos)) continue;
      candidates.push(pos);
    }

    if (candidates.length === 0) return null;

    // Pick a random candidate, preferring ones with some distance from start
    shuffle(candidates);
    return candidates[0];
  }

  /**
   * Validates that the maze is solvable with the current item placement.
   * Uses BFS with state = (position, inventory) to simulate the player
   * picking up items and using them on blockers.
   */
  private isSolvable(board: MazeBoard): boolean {
    const start: Position = { row: 0, col: 0 };
    const exitKey = `${board.exit.row},${board.exit.col}`;

    // State: "row,col|inventory" where inventory is the item type or "none"
    type State = { pos: Position; inv: CollectibleType | null };

    const visited = new Set<string>();
    const stateKey = (s: State) =>
      `${s.pos.row},${s.pos.col}|${s.inv ?? "none"}`;

    // Track which collectibles have been picked up in each branch
    // Use a set of picked-up position keys per state
    type QueueEntry = {
      state: State;
      pickedUp: Set<string>;
    };

    const startState: State = { pos: start, inv: null };
    const queue: QueueEntry[] = [{ state: startState, pickedUp: new Set() }];
    visited.add(stateKey(startState));

    while (queue.length > 0) {
      const { state, pickedUp } = queue.shift()!;
      const posKey = `${state.pos.row},${state.pos.col}`;

      if (posKey === exitKey) return true;

      // Try picking up a collectible at current position
      const collectible = board.getCollectible(state.pos);
      if (collectible && state.inv === null && !pickedUp.has(posKey)) {
        const newState: State = {
          pos: state.pos,
          inv: collectible.type,
        };
        const key = stateKey(newState);
        if (!visited.has(key)) {
          visited.add(key);
          const newPickedUp = new Set(pickedUp);
          newPickedUp.add(posKey);
          queue.push({ state: newState, pickedUp: newPickedUp });
        }
      }

      // Try moving in each direction
      for (const dir of Object.values(Direction)) {
        if (board.hasWall(state.pos, dir)) continue;
        const next = board.neighbor(state.pos, dir);
        if (!next) continue;

        const blocker = board.getBlocker(state.pos, dir);
        if (blocker) {
          // Try using item on the blocker
          if (state.inv !== null && canUnlock(state.inv, blocker.type)) {
            const newState: State = { pos: next, inv: null };
            const key = stateKey(newState);
            if (!visited.has(key)) {
              visited.add(key);
              queue.push({ state: newState, pickedUp: new Set(pickedUp) });
            }
          }
          // Can't pass without the right item
          continue;
        }

        // No blocker, just move
        const newState: State = { pos: next, inv: state.inv };
        const key = stateKey(newState);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ state: newState, pickedUp: new Set(pickedUp) });
        }
      }
    }

    return false;
  }
}

/** Fisher-Yates shuffle in place. */
function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
