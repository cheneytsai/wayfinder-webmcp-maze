/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Game, isValidMazeDimension } from "../../game/Game.ts";
import { GameplayState } from "../../game/states/GameplayState.ts";

/**
 * Creates the `start_game` MCP tool.
 * Transitions from the intro or game-over state into gameplay,
 * generating a fresh maze.
 *
 * @param game - The game orchestrator instance.
 * @returns A {@link WebMCP.ModelContextTool} for starting a new game.
 */
export function createStartGameTool(game: Game): WebMCP.ModelContextTool {
  return {
    name: "start_game",
    description:
      "Start a new maze game. Generates a fresh maze and places the player " +
      "at the top-left corner. The goal is to reach the bottom-right exit.",
    inputSchema: {
      type: "object",
      properties: {
        rows: {
          type: "integer",
          minimum: 2,
          maximum: 40,
          default: 10,
          description: "Number of rows in the maze.",
        },
        cols: {
          type: "integer",
          minimum: 2,
          maximum: 40,
          default: 10,
          description: "Number of columns in the maze.",
        },
      },
      additionalProperties: false,
    },
    async execute(input = {}) {
      const rows = input?.rows === undefined ? 10 : input.rows;
      const cols = input?.cols === undefined ? 10 : input.cols;
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).some((key) => key !== "rows" && key !== "cols") ||
        !isValidMazeDimension(rows) ||
        !isValidMazeDimension(cols)
      ) {
        return {
          error:
            "Rows and columns must be whole numbers from 2 to 40. Only rows and cols are accepted.",
          code: "INVALID_MAZE_SIZE",
          retryable: true,
        };
      }
      game.newGame(rows, cols);
      game.setState(new GameplayState(game));

      return {
        message:
          "A new maze has been generated! Use 'look' to see your surroundings, then 'move' to navigate.",
        mazeSize: { rows: game.board.rows, cols: game.board.cols },
        startPosition: { row: 0, col: 0 },
        exitPosition: { row: game.board.exit.row, col: game.board.exit.col },
      };
    },
  };
}
