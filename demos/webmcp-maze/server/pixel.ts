/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
export const PIXEL_RESOURCE = "ui://pixel-art-studio/v1.html";
export function createPixelMcpServer(widgetHtml: () => string) {
  const server = new McpServer({ name: "Pixel Art Studio", version: "1.0.0" }, {
    instructions: "Open the studio once with open_studio. All drawing happens through the widget's fixed set of native WebMCP tools inside ChatGPT Desktop. Expand the widget into an app tab if needed, call get_canvas_info first, draw with draw_svg or the drawing tools, and verify with get_region_pixels. Keep the same canvas for edits; do not reopen it to draw.",
  });
  server.registerResource("pixel-art-widget", PIXEL_RESOURCE, {}, async () => ({ contents: [{ uri: PIXEL_RESOURCE, mimeType: "text/html;profile=mcp-app", text: widgetHtml(), _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: ["data:", "blob:"] } }, "openai/widgetDescription": "Original Chrome Pixel Art Studio canvas and agent activity feed. All 25 drawing tools are registered inside the iframe at startup. There are no manual artwork controls." } }] }));
  server.registerTool("open_studio", {
    title: "Open Pixel Art Studio",
    description: "Open the original Chrome Pixel Art Studio as a widget. After opening it, use its native WebMCP tools to draw and edit the same canvas. Only open another studio when the user asks for a separate canvas.",
    inputSchema: { width: z.number().int().min(8).max(256).default(64), height: z.number().int().min(8).max(256).default(64) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: PIXEL_RESOURCE }, "openai/outputTemplate": PIXEL_RESOURCE, "openai/toolInvocation/invoking": "Opening the studio…", "openai/toolInvocation/invoked": "Studio opened" },
  }, async ({ width, height }) => ({ structuredContent: { kind: "pixel-art", width, height }, content: [{ type: "text", text: `Opening a ${width}×${height} pixel canvas. Draw using the WebMCP tools inside the widget.` }] }));
  return server;
}
