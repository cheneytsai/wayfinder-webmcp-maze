/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const RESOURCE = "ui://chrome-webmcp-maze/v5.html";
export function createMcpServer(widgetHtml: () => string, origin?: string) {
  const mcp = new McpServer(
    { name: "Chrome WebMCP Maze", version: "5.0.0" },
    {
      instructions:
        "Open the app with open_maze. This MCP tool only loads the widget; it cannot create or configure a maze. Use the iframe WebMCP start_game with rows and cols to create a maze, then discover and use the live widget's WebMCP look, move, pickup, drop and use tools to play. The iframe registers six fixed tools with document.modelContext, including start_game for replay. The host must discover and relay them. Keep the same widget during gameplay. There are no manual game controls.",
    },
  );
  mcp.registerResource("maze-widget", RESOURCE, {}, async () => ({
    contents: [
      {
        uri: RESOURCE,
        mimeType: "text/html;profile=mcp-app",
        text: widgetHtml(),
        _meta: {
          ui: {
            prefersBorder: true,
            csp: {
              connectDomains: origin ? [origin] : [],
              resourceDomains: [
                "https://fonts.googleapis.com",
                "https://fonts.gstatic.com",
              ],
            },
          },
          "openai/widgetDescription":
            "The original Chrome WebMCP maze. Game state stays inside this widget. Gameplay uses WebMCP tools registered inside the iframe.",
        },
      },
    ],
  }));
  mcp.registerTool(
    "open_maze",
    {
      title: "Open Maze",
      description:
        "Load the original Chrome maze widget without starting a game. All maze creation, sizing, gameplay and replay must use the iframe WebMCP tools. Keep the same widget.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: RESOURCE },
        "openai/outputTemplate": RESOURCE,
        "openai/toolInvocation/invoking": "Opening the maze…",
        "openai/toolInvocation/invoked": "Maze opened",
      },
    },
    async () => ({
      structuredContent: { kind: "maze" },
      content: [
        {
          type: "text",
          text: "Maze app opened. Call its WebMCP start_game to create the requested maze.",
        },
      ],
    }),
  );
  return mcp;
}
