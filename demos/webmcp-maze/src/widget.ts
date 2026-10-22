/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import "pixi.js/unsafe-eval";
import { App } from "@modelcontextprotocol/ext-apps";
import { createGame } from "./main.ts";
import "./widget.css";

const app = new App({ name: "Chrome WebMCP Maze", version: "5.0.1" }, {});
const game = await createGame();
const tools = game.toolRegistry.getTools();
let initialized = false;
app.ontoolresult = async (params) => {
  const input = params.structuredContent as Record<string, unknown> | undefined;
  if (initialized || input?.kind !== "maze") return;
  initialized = true;
  try {
    const html = document.documentElement;
    html.dataset.initialized = "true";
    const count = await game.toolRegistry.ensureNativeTools();
    html.dataset.webmcpToolCount = String(count);
    html.dataset.webmcpAvailable = String(!!document.modelContext);
    const status = document.createElement("aside");
    status.id = "maze-tools-status";
    status.innerHTML = `<span>WebMCP tools: ${count}/${tools.length}</span><span id="maze-last-tool">Waiting for WebMCP start_game</span>`;
    document.getElementById("app")!.append(status);
    void app
      .updateModelContext({
        content: [
          {
            type: "text",
            text: `The maze app is open; no game has started. This document registered ${count}/${tools.length} WebMCP tools using document.modelContext: start_game, look, move, pickup, drop, and use. Registration does not prove host discovery. Discover them through the host’s WebMCP integration. First call WebMCP start_game with the requested rows and cols, then look and move to play in this widget. After escaping, use the app's start_game to replay. The MCP open_maze tool only loads a separate widget and cannot mutate this maze.`,
          },
        ],
      })
      .catch((error) => console.warn("Could not update maze context", error));
  } catch (error) {
    document.documentElement.dataset.error = "true";
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent =
      error instanceof Error ? error.message : "Maze initialization failed";
    document.getElementById("app")!.append(message);
    console.error(error);
  }
};
await app.connect();
