/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { createToolInputParser } from "../../shared/webmcp-input.ts";
import type { Game } from "../game/Game.ts";
import { createStartGameTool } from "./tools/StartGameTool.ts";
import { createLookTool } from "./tools/LookTool.ts";
import { createMoveTool } from "./tools/MoveTool.ts";
import { createPickupTool } from "./tools/PickupTool.ts";
import { createDropTool } from "./tools/DropTool.ts";
import { createUseTool } from "./tools/UseTool.ts";

/** A fixed tool surface for embedded apps; handlers retain Chrome's game logic. */
export function createMazeAppTools(game: Game): WebMCP.ModelContextTool[] {
  const tools = [
    createStartGameTool(game),
    createLookTool(game),
    createMoveTool(game),
    createPickupTool(game),
    createDropTool(game),
    createUseTool(game),
  ];
  return tools.map((tool) => {
    const parseInput = createToolInputParser(tool.inputSchema);
    return {
      ...tool,
      async execute(input, options) {
        options.signal?.throwIfAborted();
        input = parseInput(input);
        if (tool.name === "start_game" && game.gameplayState) {
          return {
            error:
              "A maze is already in progress. Continue with look and move; replay is available after escaping.",
            code: "GAME_IN_PROGRESS",
          };
        }
        if (tool.name !== "start_game" && !game.board) {
          return {
            error: "The maze has not initialized yet.",
            code: "NOT_READY",
          };
        }
        if (
          tool.name !== "start_game" &&
          tool.name !== "look" &&
          !game.gameplayState
        ) {
          return {
            error:
              "The maze has ended. Use the app's start_game tool to play again.",
            code: "GAME_OVER",
          };
        }
        const result = await tool.execute(input, options);
        const status = document.getElementById("maze-last-tool");
        if (status) status.textContent = `Last tool: ${tool.name}`;
        return result;
      },
    };
  });
}
