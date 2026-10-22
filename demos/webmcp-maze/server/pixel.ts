/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export const PIXEL_RESOURCE = "ui://pixel-art-studio/v4.html";
export function createPixelMcpServer(widgetHtml: () => string) {
  const server = new McpServer(
    { name: "Pixel Art Studio", version: "3.0.0" },
    {
      instructions:
        "Open the studio once with open_studio, which only loads the widget. Use WebMCP set_canvas_size to configure dimensions; all artwork mutations must use WebMCP. The widget registers 25 WebMCP tools on document.modelContext. Discover them using the host’s WebMCP integration, call get_canvas_info first, draw with draw_svg or the drawing tools, and verify with get_region_pixels. Keep the same canvas for edits; do not reopen it to draw.",
    },
  );
  server.registerResource("pixel-art-widget", PIXEL_RESOURCE, {}, async () => ({
    contents: [
      {
        uri: PIXEL_RESOURCE,
        mimeType: "text/html;profile=mcp-app",
        text: widgetHtml(),
        _meta: {
          ui: {
            prefersBorder: true,
            csp: { connectDomains: [], resourceDomains: ["data:", "blob:"] },
          },
          "openai/widgetDescription":
            "Original Chrome Pixel Art Studio canvas and agent activity feed. All 25 drawing tools are registered with document.modelContext. The host must discover and relay them. There are no manual artwork controls.",
        },
      },
    ],
  }));
  server.registerTool(
    "open_studio",
    {
      title: "Open Pixel Art Studio",
      description:
        "Open the original Chrome Pixel Art Studio as a widget. After opening it, use its WebMCP tools to draw and edit the same canvas. Only open another studio when the user asks for a separate canvas.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: PIXEL_RESOURCE },
        "openai/outputTemplate": PIXEL_RESOURCE,
        "openai/toolInvocation/invoking": "Opening the studio…",
        "openai/toolInvocation/invoked": "Studio opened",
      },
    },
    async () => ({
      structuredContent: { kind: "pixel-art" },
      content: [
        {
          type: "text",
          text: "Studio opened. Configure the canvas and draw using its WebMCP tools.",
        },
      ],
    }),
  );
  return server;
}
