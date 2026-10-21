/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** Cardinal directions for maze navigation. */
export enum Direction {
  North = "north",
  South = "south",
  East = "east",
  West = "west",
}

/** A row/column coordinate in the maze grid. */
export interface Position {
  row: number;
  col: number;
}

/** A single cell in the maze grid, tracking which walls are present. */
export interface Cell {
  row: number;
  col: number;
  /** `true` means the wall in that direction is intact (blocking). */
  walls: Record<Direction, boolean>;
}

/** Identifiers for each state in the game state machine. */
export enum GameStateType {
  Intro = "intro",
  Gameplay = "gameplay",
  GameOver = "gameover",
}

/** Size of one maze cell in pixels. */
export const CELL_SIZE = 48;

/** Thickness of maze walls in pixels. */
export const WALL_THICKNESS = 4;

/** Default maze dimensions. */
export const MAZE_DEFAULT_ROWS = 10;

/** Default maze column count. */
export const MAZE_DEFAULT_COLS = 10;

/** Duration of the player move animation in milliseconds. */
export const MOVE_ANIM_DURATION = 220;

/** Row/col deltas for each cardinal direction. */
export const DIRECTION_OFFSETS: Record<Direction, Position> = {
  [Direction.North]: { row: -1, col: 0 },
  [Direction.South]: { row: 1, col: 0 },
  [Direction.East]: { row: 0, col: 1 },
  [Direction.West]: { row: 0, col: -1 },
};

/** Maps each direction to its opposite. */
export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  [Direction.North]: Direction.South,
  [Direction.South]: Direction.North,
  [Direction.East]: Direction.West,
  [Direction.West]: Direction.East,
};

/** Types of collectible items the player can pick up. */
export enum CollectibleType {
  KeyRed = "key_red",
  KeyBlue = "key_blue",
  KeyGreen = "key_green",
  Dynamite = "dynamite",
}

/** Types of blockers that obstruct passages between cells. */
export enum BlockerType {
  DoorRed = "door_red",
  DoorBlue = "door_blue",
  DoorGreen = "door_green",
  Rock = "rock",
}

/** Colors shared by keys and their matching doors. */
export enum ItemColor {
  Red = "red",
  Blue = "blue",
  Green = "green",
}

/** A collectible item placed on a cell. */
export interface Collectible {
  type: CollectibleType;
  position: Position;
}

/** A blocker placed on a passage between two cells. */
export interface Blocker {
  type: BlockerType;
  /** The cell position where the blocker is registered. */
  position: Position;
  /** The direction from the position where the blocker blocks passage. */
  direction: Direction;
}

/** Returns the color of a collectible, or `null` for dynamite. */
export function collectibleColor(type: CollectibleType): ItemColor | null {
  switch (type) {
    case CollectibleType.KeyRed:
      return ItemColor.Red;
    case CollectibleType.KeyBlue:
      return ItemColor.Blue;
    case CollectibleType.KeyGreen:
      return ItemColor.Green;
    case CollectibleType.Dynamite:
      return null;
  }
}

/** Returns the color of a blocker, or `null` for rock. */
export function blockerColor(type: BlockerType): ItemColor | null {
  switch (type) {
    case BlockerType.DoorRed:
      return ItemColor.Red;
    case BlockerType.DoorBlue:
      return ItemColor.Blue;
    case BlockerType.DoorGreen:
      return ItemColor.Green;
    case BlockerType.Rock:
      return null;
  }
}

/** Checks whether a collectible can unlock/clear a blocker. */
export function canUnlock(
  item: CollectibleType,
  blocker: BlockerType,
): boolean {
  if (item === CollectibleType.Dynamite && blocker === BlockerType.Rock) {
    return true;
  }
  const itemCol = collectibleColor(item);
  const blockerCol = blockerColor(blocker);
  return itemCol !== null && blockerCol !== null && itemCol === blockerCol;
}

/** Human-readable display name for a collectible type. */
export function collectibleDisplayName(type: CollectibleType): string {
  switch (type) {
    case CollectibleType.KeyRed:
      return "RED KEY";
    case CollectibleType.KeyBlue:
      return "BLUE KEY";
    case CollectibleType.KeyGreen:
      return "GREEN KEY";
    case CollectibleType.Dynamite:
      return "DYNAMITE";
  }
}

/** Human-readable display name for a blocker type. */
export function blockerDisplayName(type: BlockerType): string {
  switch (type) {
    case BlockerType.DoorRed:
      return "red door";
    case BlockerType.DoorBlue:
      return "blue door";
    case BlockerType.DoorGreen:
      return "green door";
    case BlockerType.Rock:
      return "rock";
  }
}

declare global {
  /**
   * Game-owned tool dispatch helper installed on `window.gameTools`.
   * Always reflects the currently registered tool set.
   */
  interface GameTools {
    /**
     * Execute a registered game tool by name.
     * @param name - The tool name (e.g. `"move"`, `"look"`).
     * @param args - Input object matching the tool's `inputSchema`.
     * @returns The tool's raw return value (a JSON string for all built-in tools).
     */
    executeTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  }

  interface Window {
    /** Game-owned tool dispatch helper. Available as soon as the game loads. */
    gameTools: GameTools;
  }
}
