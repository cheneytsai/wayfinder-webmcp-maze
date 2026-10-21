/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Cell,
  type Collectible,
  type Blocker,
  Direction,
  type Position,
  DIRECTION_OFFSETS,
  OPPOSITE_DIRECTION,
} from "../types/index.ts";

/**
 * Stores the maze grid — a 2D array of {@link Cell} objects.
 * Provides helpers for querying walls, neighbors, and bounds.
 */
export class MazeBoard {
  /** Number of rows in the maze. */
  readonly rows: number;

  /** Number of columns in the maze. */
  readonly cols: number;

  /** The exit cell position (bottom-right by default). */
  readonly exit: Position;

  /** Internal 2D grid of cells. */
  private grid: Cell[][];

  /** Set of revealed cell keys (`"row,col"`) for fog of war. */
  private revealed = new Set<string>();

  /** Collectibles placed on cells, keyed by `"row,col"`. */
  private collectibles = new Map<string, Collectible>();

  /** Blockers placed on passages, keyed by `"row,col:direction"`. */
  private blockers = new Map<string, Blocker>();

  /**
   * Creates a new maze board with all walls intact.
   * @param rows - Number of rows.
   * @param cols - Number of columns.
   */
  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.exit = { row: rows - 1, col: cols - 1 };
    this.grid = this.buildGrid();
  }

  /**
   * Returns the cell at the given position.
   * @param pos - The row/col coordinate.
   * @returns The cell, or `undefined` if out of bounds.
   */
  getCell(pos: Position): Cell | undefined {
    return this.grid[pos.row]?.[pos.col];
  }

  /**
   * Checks whether a position is within the grid bounds.
   * @param pos - The row/col coordinate to test.
   */
  inBounds(pos: Position): boolean {
    return (
      pos.row >= 0 && pos.row < this.rows && pos.col >= 0 && pos.col < this.cols
    );
  }

  /**
   * Returns the neighbor position in the given direction,
   * or `undefined` if it would be out of bounds.
   * @param pos - Starting position.
   * @param dir - Direction to move.
   */
  neighbor(pos: Position, dir: Direction): Position | undefined {
    const offset = DIRECTION_OFFSETS[dir];
    const next: Position = {
      row: pos.row + offset.row,
      col: pos.col + offset.col,
    };
    return this.inBounds(next) ? next : undefined;
  }

  /**
   * Checks whether the wall in a given direction is present at a cell.
   * @param pos - The cell position.
   * @param dir - The wall direction to check.
   * @returns `true` if the wall blocks passage.
   */
  hasWall(pos: Position, dir: Direction): boolean {
    const cell = this.getCell(pos);
    return cell ? cell.walls[dir] : true;
  }

  /**
   * Removes the wall between two adjacent cells.
   * Both sides of the wall are removed.
   * @param pos - First cell position.
   * @param dir - Direction from the first cell toward the second.
   */
  removeWall(pos: Position, dir: Direction): void {
    const cell = this.getCell(pos);
    const neighborPos = this.neighbor(pos, dir);
    if (!cell || !neighborPos) return;
    const neighborCell = this.getCell(neighborPos);
    if (!neighborCell) return;

    cell.walls[dir] = false;
    neighborCell.walls[OPPOSITE_DIRECTION[dir]] = false;
  }

  /**
   * Returns all directions from a position where there is no wall and no blocker.
   * @param pos - The cell to inspect.
   */
  openDirections(pos: Position): Direction[] {
    const cell = this.getCell(pos);
    if (!cell) return [];
    return Object.values(Direction).filter((dir) => !this.isBlocked(pos, dir));
  }

  /**
   * Checks if the given position is the maze exit.
   * @param pos - The position to test.
   */
  isExit(pos: Position): boolean {
    return pos.row === this.exit.row && pos.col === this.exit.col;
  }

  /**
   * Returns the number of revealed cells.
   */
  get revealedCount(): number {
    return this.revealed.size;
  }

  /**
   * Checks whether a cell has been revealed (visible through fog of war).
   * @param pos - The position to check.
   */
  isRevealed(pos: Position): boolean {
    return this.revealed.has(`${pos.row},${pos.col}`);
  }

  /**
   * Marks a single cell as revealed.
   * @param pos - The position to reveal.
   */
  revealCell(pos: Position): void {
    if (this.inBounds(pos)) {
      this.revealed.add(`${pos.row},${pos.col}`);
    }
  }

  /**
   * Reveals a cell and all neighbors reachable through open walls (one step deep).
   * @param pos - The position to reveal from.
   */
  revealFrom(pos: Position): void {
    this.revealCell(pos);
    for (const dir of this.openDirections(pos)) {
      const n = this.neighbor(pos, dir);
      if (n) {
        this.revealCell(n);
      }
    }
  }

  // ─── Collectible methods ────────────────────────────────────────────

  /**
   * Places a collectible on a cell.
   * @param collectible - The collectible to place.
   */
  addCollectible(collectible: Collectible): void {
    const key = `${collectible.position.row},${collectible.position.col}`;
    this.collectibles.set(key, collectible);
  }

  /**
   * Returns the collectible at a position without removing it.
   * @param pos - The cell position.
   */
  getCollectible(pos: Position): Collectible | undefined {
    return this.collectibles.get(`${pos.row},${pos.col}`);
  }

  /**
   * Removes and returns the collectible at a position.
   * @param pos - The cell position.
   */
  removeCollectible(pos: Position): Collectible | undefined {
    const key = `${pos.row},${pos.col}`;
    const item = this.collectibles.get(key);
    if (item) this.collectibles.delete(key);
    return item;
  }

  /** Returns all collectibles currently on the board. */
  getAllCollectibles(): Collectible[] {
    return [...this.collectibles.values()];
  }

  // ─── Blocker methods ──────────────────────────────────────────────

  /**
   * Places a blocker on a passage.
   * @param blocker - The blocker to place.
   */
  addBlocker(blocker: Blocker): void {
    const key = `${blocker.position.row},${blocker.position.col}:${blocker.direction}`;
    this.blockers.set(key, blocker);
  }

  /**
   * Returns the blocker at a passage without removing it.
   * @param pos - The cell position.
   * @param dir - The direction to check.
   */
  getBlocker(pos: Position, dir: Direction): Blocker | undefined {
    return this.blockers.get(`${pos.row},${pos.col}:${dir}`);
  }

  /**
   * Removes and returns the blocker at a passage.
   * @param pos - The cell position.
   * @param dir - The direction of the blocker.
   */
  removeBlocker(pos: Position, dir: Direction): Blocker | undefined {
    const key = `${pos.row},${pos.col}:${dir}`;
    const blocker = this.blockers.get(key);
    if (blocker) this.blockers.delete(key);
    return blocker;
  }

  /** Returns all blockers currently on the board. */
  getAllBlockers(): Blocker[] {
    return [...this.blockers.values()];
  }

  /**
   * Checks whether a passage is blocked by a wall or a blocker.
   * @param pos - The cell position.
   * @param dir - The direction to check.
   */
  isBlocked(pos: Position, dir: Direction): boolean {
    if (this.hasWall(pos, dir)) return true;
    return this.getBlocker(pos, dir) !== undefined;
  }

  /**
   * Builds the initial grid with all walls intact.
   * @returns A 2D array of cells.
   */
  private buildGrid(): Cell[][] {
    const grid: Cell[][] = [];
    for (let r = 0; r < this.rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          row: r,
          col: c,
          walls: {
            [Direction.North]: true,
            [Direction.South]: true,
            [Direction.East]: true,
            [Direction.West]: true,
          },
        });
      }
      grid.push(row);
    }
    return grid;
  }
}
