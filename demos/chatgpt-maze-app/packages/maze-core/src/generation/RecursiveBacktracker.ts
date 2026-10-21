/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type MazeBoard } from "../game/MazeBoard.ts";
import { type MazeGenerator } from "./MazeGenerator.ts";
import { Direction, DIRECTION_OFFSETS } from "../types/index.ts";

/**
 * Generates a perfect maze using the recursive-backtracker (randomized DFS) algorithm.
 *
 * Starting from the top-left cell, the algorithm:
 * 1. Marks the current cell as visited.
 * 2. Picks a random unvisited neighbor and removes the wall between them.
 * 3. Recurses into that neighbor.
 * 4. Backtracks when no unvisited neighbors remain.
 *
 * Uses an explicit stack to avoid call-stack overflow on large mazes.
 */
export class RecursiveBacktracker implements MazeGenerator {
  /** @inheritdoc */
  generate(board: MazeBoard): void {
    const visited: boolean[][] = Array.from({ length: board.rows }, () =>
      Array.from({ length: board.cols }, () => false),
    );

    const stack: { row: number; col: number }[] = [{ row: 0, col: 0 }];
    visited[0][0] = true;

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = this.unvisitedNeighbors(current, board, visited);

      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }

      const [dir, next] =
        neighbors[Math.floor(Math.random() * neighbors.length)];
      board.removeWall(current, dir);
      visited[next.row][next.col] = true;
      stack.push(next);
    }
  }

  /**
   * Returns all unvisited neighbors of a cell along with the direction to reach them.
   * @param pos - The current cell.
   * @param board - The maze board (for bounds checking).
   * @param visited - 2D visited flags.
   */
  private unvisitedNeighbors(
    pos: { row: number; col: number },
    board: MazeBoard,
    visited: boolean[][],
  ): [Direction, { row: number; col: number }][] {
    const result: [Direction, { row: number; col: number }][] = [];
    for (const dir of Object.values(Direction)) {
      const offset = DIRECTION_OFFSETS[dir];
      const next = { row: pos.row + offset.row, col: pos.col + offset.col };
      if (board.inBounds(next) && !visited[next.row][next.col]) {
        result.push([dir, next]);
      }
    }
    return result;
  }
}
