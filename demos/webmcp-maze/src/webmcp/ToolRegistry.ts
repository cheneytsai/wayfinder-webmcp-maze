/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Game } from "../game/Game.ts";
import { createMoveTool } from "./tools/MoveTool.ts";
import { createLookTool } from "./tools/LookTool.ts";
import { createPickupTool } from "./tools/PickupTool.ts";
import { createDropTool } from "./tools/DropTool.ts";
import { createUseTool } from "./tools/UseTool.ts";
import { createStartGameTool } from "./tools/StartGameTool.ts";
import { createMazeAppTools } from "./MazeAppTools.ts";
import { createEvalTool } from "./tools/EvalTool.ts";

/**
 * Manages the lifecycle of WebMCP tools registered with `document.modelContext`.
 *
 * Embedded MCP Apps keep six guarded tools registered throughout their lifetime.
 * The standalone demo registers different sets depending on the current state:
 * - **Intro / GameOver**: only `start_game`
 * - **Gameplay**: `move`, `look`, `pickup`, `drop`, `use`
 *   and optionally `eval_code` when the `?eval_tool` URL parameter is present.
 *
 * A `window.gameTools.executeTool(name, args)` helper is always kept in sync
 * with the current tool set so that eval'd code can invoke tools by name.
 */
export class ToolRegistry {
  /** Reference to the game orchestrator. */
  private game: Game;

  /** Whether the WebMCP API is available in this browser. */
  private supported: boolean;

  /**
   * Live map of currently registered tools, keyed by tool name.
   * Referenced by `window.gameTools.executeTool` at call time.
   */
  private toolMap: Map<string, WebMCP.ModelContextTool> = new Map();

  private toolController: AbortController | null = null;
  private registration: Promise<number> = Promise.resolve(0);

  private readonly fixedAppTools =
    document.documentElement.hasAttribute("data-mcp-app");

  /** The fixed handlers exposed through document.modelContext in embedded apps. */
  getTools(): WebMCP.ModelContextTool[] {
    return [...this.toolMap.values()];
  }

  /**
   * @param game - The game orchestrator instance.
   */
  constructor(game: Game) {
    this.game = game;
    this.supported = !!document.modelContext;

    if (!this.supported) {
      console.warn("WebMCP (modelContext) is not available in this browser.");
    }

    this.installGameTools();
  }

  /**
   * Registers tools available during the intro state.
   * Only the `start_game` tool is exposed.
   */
  registerIntroTools(): void {
    this.provideTools([createStartGameTool(this.game)]);
  }

  /**
   * Registers tools available during gameplay.
   * Exposes movement, inspection, and item interaction tools.
   * Also registers `eval_code` when the `?eval_tool` URL parameter is present.
   */
  registerGameplayTools(): void {
    const tools = [
      createMoveTool(this.game),
      createLookTool(this.game),
      createPickupTool(this.game),
      createDropTool(this.game),
      createUseTool(this.game),
    ];

    if (new URLSearchParams(window.location.search).has("eval_tool")) {
      tools.push(createEvalTool());
    }

    this.provideTools(tools);
  }

  /**
   * Registers tools available during the game-over state.
   * Only the `start_game` tool is exposed (to replay).
   */
  registerGameOverTools(): void {
    this.provideTools([createStartGameTool(this.game)]);
  }

  /**
   * Unregisters all current tools then registers the new batch.
   * Keeps `toolMap` in sync so `window.gameTools.executeTool` stays current.
   * @param tools - The tools to register.
   */
  private provideTools(tools: WebMCP.ModelContextTool[]): void {
    if (this.fixedAppTools) {
      if (this.toolMap.size) return;
      tools = createMazeAppTools(this.game);
    }
    this.toolMap.clear();
    for (const tool of tools) {
      this.toolMap.set(tool.name, tool);
    }
    this.beginNativeRegistration();
  }

  private beginNativeRegistration(): void {
    this.supported = !!document.modelContext;
    if (!this.supported) return;
    this.toolController?.abort();
    this.toolController = new AbortController();
    const signal = this.toolController.signal;
    this.registration = Promise.allSettled(
      this.getTools().map((tool) =>
        document.modelContext!.registerTool(tool, { signal }),
      ),
    ).then((results) => {
      for (const result of results) {
        if (result.status === "rejected" && !signal.aborted)
          console.error("Native maze registration failed", result.reason);
      }
      return results.filter((result) => result.status === "fulfilled").length;
    });
  }

  /** Retry once if the host provided WebMCP after the initial module load. */
  async ensureNativeTools(): Promise<number> {
    if (!this.supported && document.modelContext)
      this.beginNativeRegistration();
    return this.registration;
  }

  /**
   * Installs `window.gameTools` once. The `executeTool` method reads from
   * `toolMap` at call time so it always reflects the current tool set.
   */
  private installGameTools(): void {
    const toolMap = this.toolMap;
    window.gameTools = {
      async executeTool(
        name: string,
        args: Record<string, unknown>,
      ): Promise<unknown> {
        const tool = toolMap.get(name);
        if (!tool) {
          throw new Error(
            `No tool named "${name}" is currently registered. ` +
              `Available: ${[...toolMap.keys()].join(", ")}`,
          );
        }
        return tool.execute(args, {} as WebMCP.ToolExecuteCallbackOptions);
      },
    };
  }
}
