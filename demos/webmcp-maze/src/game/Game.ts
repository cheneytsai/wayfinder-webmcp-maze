/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GameState } from "./GameState.ts";
import { MazeBoard } from "./MazeBoard.ts";
import { Player } from "./Player.ts";
import { type Renderer } from "../rendering/Renderer.ts";
import { type ToolRegistry } from "../webmcp/ToolRegistry.ts";
import { RecursiveBacktracker } from "../generation/RecursiveBacktracker.ts";
import { ItemPlacer } from "../generation/ItemPlacer.ts";
import { MAZE_DEFAULT_ROWS, MAZE_DEFAULT_COLS } from "../types/index.ts";
import { GameplayState } from "./states/GameplayState.ts";

/** Allowed dimensions for the configurable maze (modified from upstream). */
export function isValidMazeDimension(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 2 &&
    value <= 40
  );
}

/**
 * Top-level game orchestrator.
 * Owns the state machine, maze data, player, and references to subsystems
 * (renderer, MCP tool registry).
 */
export class Game {
  /** The current maze board. Created when a new game starts. */
  board!: MazeBoard;

  /** The player instance. */
  player!: Player;

  /** PixiJS renderer subsystem. */
  renderer!: Renderer;

  /** WebMCP tool registry subsystem. */
  toolRegistry!: ToolRegistry;

  /** Whether the player has won (reached the exit). */
  won = false;

  /** The currently active game state. */
  private currentState: GameState | null = null;

  /**
   * Returns the current state as a `GameplayState` if active, or `null` otherwise.
   */
  get gameplayState(): GameplayState | null {
    return this.currentState instanceof GameplayState
      ? this.currentState
      : null;
  }

  /**
   * Transitions to a new game state.
   * Calls `exit()` on the previous state and `enter()` on the new one.
   * @param state - The new state to activate.
   */
  setState(state: GameState): void {
    this.currentState?.exit();
    this.currentState = state;
    this.currentState.enter();
  }

  /**
   * Creates a fresh maze and player for a new game round.
   * @param rows - Maze row count.
   * @param cols - Maze column count.
   */
  newGame(
    rows: number = MAZE_DEFAULT_ROWS,
    cols: number = MAZE_DEFAULT_COLS,
  ): void {
    if (!isValidMazeDimension(rows) || !isValidMazeDimension(cols)) {
      throw new RangeError(
        "Rows and columns must be whole numbers from 2 to 40.",
      );
    }
    this.board = new MazeBoard(rows, cols);
    const generator = new RecursiveBacktracker();
    generator.generate(this.board);
    new ItemPlacer().place(this.board);

    this.player = new Player({ row: 0, col: 0 });
    this.won = false;
  }

  /**
   * Per-frame update — delegates to the current state.
   * @param dt - Delta time in seconds.
   */
  update(dt: number): void {
    this.currentState?.update(dt);
  }
}
