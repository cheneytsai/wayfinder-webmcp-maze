/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Position,
  type Direction,
  type CollectibleType,
  type BlockerType,
  canUnlock,
  DIRECTION_OFFSETS,
} from "../types/index.ts";
import { type MazeBoard } from "./MazeBoard.ts";

/**
 * Tracks the player's position in the maze and handles movement validation.
 * Movement is only allowed when there is no wall blocking the requested direction.
 */
export class Player {
  /** Current position in the maze grid. */
  position: Position;

  /** Total number of moves the player has made. */
  moveCount: number;

  /** The item currently held by the player, or `null` if empty-handed. */
  inventory: CollectibleType | null;

  /**
   * Creates a new player at the given starting position.
   * @param start - The initial row/col coordinate (defaults to top-left).
   */
  constructor(start: Position = { row: 0, col: 0 }) {
    this.position = { ...start };
    this.moveCount = 0;
    this.inventory = null;
  }

  /**
   * Attempts to move the player in the given direction.
   * The move is rejected if a wall or blocker blocks the way.
   *
   * @param dir - The direction to move.
   * @param board - The maze board used to check walls, blockers, and bounds.
   * @returns `true` if the move succeeded, `false` if blocked.
   */
  move(dir: Direction, board: MazeBoard): boolean {
    if (board.isBlocked(this.position, dir)) {
      return false;
    }

    const offset = DIRECTION_OFFSETS[dir];
    const next: Position = {
      row: this.position.row + offset.row,
      col: this.position.col + offset.col,
    };

    if (!board.inBounds(next)) {
      return false;
    }

    this.position = next;
    this.moveCount++;
    return true;
  }

  /**
   * Resets the player back to a starting position with zero moves.
   * @param start - The position to reset to (defaults to top-left).
   */
  reset(start: Position = { row: 0, col: 0 }): void {
    this.position = { ...start };
    this.moveCount = 0;
    this.inventory = null;
  }

  /**
   * Picks up an item if the inventory is empty.
   * @param item - The collectible type to pick up.
   * @returns `true` if successful, `false` if inventory is full.
   */
  pickup(item: CollectibleType): boolean {
    if (this.inventory !== null) return false;
    this.inventory = item;
    return true;
  }

  /**
   * Drops the currently held item.
   * @returns The dropped item type, or `null` if inventory was empty.
   */
  drop(): CollectibleType | null {
    const item = this.inventory;
    this.inventory = null;
    return item;
  }

  /**
   * Uses the held item on a blocker if compatible. Consumes the item on success.
   * @param blockerType - The blocker type to attempt to clear.
   * @returns `true` if the item was used successfully, `false` otherwise.
   */
  useItem(blockerType: BlockerType): boolean {
    if (this.inventory === null) return false;
    if (!canUnlock(this.inventory, blockerType)) return false;
    this.inventory = null;
    return true;
  }
}
