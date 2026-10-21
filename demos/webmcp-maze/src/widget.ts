/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
// Pixi's CSP-safe implementation avoids generated functions in the iframe.
import "pixi.js/unsafe-eval";
import { App } from "@modelcontextprotocol/ext-apps";
import { createGame } from "./main.ts";
import "./widget.css";
import { createStartGameTool } from "./webmcp/tools/StartGameTool.ts";

// The MCP server opens the widget; gameplay tools are native WebMCP in this iframe.
const app = new App({ name: "Chrome WebMCP Maze", version: "2.0.0" }, {});
const gamePromise = createGame();
let initialized = false;
app.ontoolresult = async (params) => {
  if (initialized) return;
  const input = params.structuredContent as Record<string, unknown> | undefined;
  if (input?.kind !== "maze") return;
  initialized = true;
  try {
    const game = await gamePromise;
    const result = await createStartGameTool(game).execute(
      { rows: input.rows, cols: input.cols },
      {} as WebMCP.ToolExecuteCallbackOptions,
    );
    document.documentElement.dataset.initialized = "true";
    await app.updateModelContext({
      content: [
        {
          type: "text",
          text: `The maze is running in this widget. Discover and use its WebMCP look, move, pickup, drop, and use tools. ${JSON.stringify(result)}`,
        },
      ],
    });
  } catch (error) {
    initialized = false;
    console.error("Maze initialization failed", error);
  }
};
await app.connect();
