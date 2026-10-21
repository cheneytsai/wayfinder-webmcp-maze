/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const RESOURCE = "ui://chrome-webmcp-maze/v2.html";
export function createMcpServer(widgetHtml: () => string, origin?: string) {
  const mcp = new McpServer(
    { name: "Chrome WebMCP Maze", version: "2.0.0" },
    {
      instructions:
        "Start a maze only when requested. After start_game renders the widget, discover and use the live widget's look, move, pickup, drop and use tools to play. Keep the same widget during gameplay. In ChatGPT Desktop, expand the widget into an app tab if its tools are not listed. There are no manual game controls.",
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
            "The original Chrome WebMCP maze. Game state stays inside this widget. Gameplay uses its native WebMCP tools.",
        },
      },
    ],
  }));
  mcp.registerTool(
    "start_game",
    {
      title: "Start a maze",
      description:
        "Open the original Chrome maze with the requested grid size. Once open, use the widget's live gameplay tools to explore and solve it. Do not call this to continue an existing maze.",
      inputSchema: {
        rows: z.number().int().min(2).max(40).default(10),
        cols: z.number().int().min(2).max(40).default(10),
      },
      annotations: {
        readOnlyHint: false,
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
    async ({ rows, cols }) => ({
      structuredContent: { kind: "maze", rows, cols },
      content: [
        {
          type: "text",
          text: `Opening a ${rows}-row, ${cols}-column maze. Use the live widget tools to play.`,
        },
      ],
    }),
  );
  return mcp;
}
