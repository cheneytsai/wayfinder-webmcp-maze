/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from "vitest";
import { Game } from "../game/Game.ts";
import { createStartGameTool } from "../webmcp/tools/StartGameTool.ts";

const options = {} as WebMCP.ToolExecuteCallbackOptions;

describe("configurable maze size", () => {
  it.each([
    [undefined, undefined, 10, 10],
    [8, 12, 8, 12],
    [2, 40, 2, 40],
    [40, 2, 40, 2],
    [40, 40, 40, 40],
  ])(
    "generates %s by %s with the exit at the bottom right",
    (rows, cols, expectedRows, expectedCols) => {
      const game = new Game();
      game.newGame(rows, cols);
      expect([game.board.rows, game.board.cols]).toEqual([
        expectedRows,
        expectedCols,
      ]);
      expect(game.board.exit).toEqual({
        row: expectedRows - 1,
        col: expectedCols - 1,
      });
      expect(game.player.position).toEqual({ row: 0, col: 0 });
    },
  );

  it.each([0, 1, -1, 41, 2.5, NaN, Infinity])(
    "rejects %s without replacing an existing game",
    (value) => {
      const game = new Game();
      game.newGame(2, 2);
      const board = game.board;
      const player = game.player;
      expect(() => game.newGame(value, 8)).toThrow(RangeError);
      expect(() => game.newGame(8, value)).toThrow(RangeError);
      expect(game.board).toBe(board);
      expect(game.player).toBe(player);
    },
  );

  it.each([{}, { rows: 8, cols: 12 }, { rows: 3 }, { cols: 4 }])(
    "forwards tool inputs %j and defaults omitted dimensions",
    async (input) => {
      const game = new Game();
      const transition = vi
        .spyOn(game, "setState")
        .mockImplementation(() => {});
      const result = await createStartGameTool(game).execute(input, options);
      expect(result).toMatchObject({
        mazeSize: { rows: input.rows ?? 10, cols: input.cols ?? 10 },
      });
      expect(transition).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { rows: "8" },
    { rows: null },
    { rows: 2.5 },
    { cols: 41 },
    { rows: 0 },
    { size: 8 },
  ])(
    "returns an actionable tool error for %j without starting a game",
    async (input) => {
      const game = new Game();
      const start = vi.spyOn(game, "newGame");
      const transition = vi.spyOn(game, "setState");
      const result = await createStartGameTool(game).execute(input, options);
      expect(result).toMatchObject({
        code: "INVALID_MAZE_SIZE",
        retryable: true,
      });
      expect(start).not.toHaveBeenCalled();
      expect(transition).not.toHaveBeenCalled();
    },
  );
});
