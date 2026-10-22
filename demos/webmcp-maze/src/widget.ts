/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import "pixi.js/unsafe-eval";
import { App } from "@modelcontextprotocol/ext-apps";
import { registerIframeTools } from "../shared/app-tools.ts";
import { createGame } from "./main.ts";
import { createStartGameTool } from "./webmcp/tools/StartGameTool.ts";
import "./widget.css";

const app = new App({ name: "Chrome WebMCP Maze", version: "3.0.0" }, {
  tools: { listChanged: false },
});
const game = await createGame();
const tools = game.toolRegistry.getTools();
let finishInitialization!: () => void;
const ready = new Promise<void>(resolve => { finishInitialization = resolve; });
let initializationError: unknown;
registerIframeTools(app, tools, async () => {
  await ready;
  if (initializationError) throw initializationError;
});
let initialized = false;
app.ontoolresult = async params => {
  const input = params.structuredContent as Record<string, unknown> | undefined;
  if (initialized || input?.kind !== "maze") return;
  initialized = true;
  try {
    const result = await createStartGameTool(game).execute(
      { rows: input.rows, cols: input.cols },
      { signal: new AbortController().signal },
    ) as Record<string, unknown>;
    if (result.error) throw new Error(String(result.error));
    const html = document.documentElement;
    html.dataset.initialized = "true";
    html.dataset.appToolCount = String(tools.length);
    html.dataset.webmcpAvailable = String(!!document.modelContext);
    const status = document.createElement("aside");
    status.id = "maze-tools-status";
    status.innerHTML = `<span>App tools: ${tools.length} · Native WebMCP: ${document.modelContext ? "available" : "unavailable"}</span><span id="maze-last-tool">Maze initialized</span>`;
    document.getElementById("app")!.append(status);
    finishInitialization();
    void app.updateModelContext({ content: [{ type: "text", text: `The maze is ready. This iframe exposes the fixed app tools start_game, look, move, pickup, drop, and use through the MCP Apps bridge, backed by the same handlers as native WebMCP. Call look and move to play in this widget. After escaping, use the app's start_game to replay. Do not call the server's start_game to continue this maze. ${JSON.stringify(result)}` }] }).catch(error => console.warn("Could not update maze context", error));
  } catch (error) {
    initializationError = error;
    document.documentElement.dataset.error = "true";
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = error instanceof Error ? error.message : "Maze initialization failed";
    document.getElementById("app")!.append(message);
    console.error(error);
  } finally { finishInitialization(); }
};
await app.connect();
