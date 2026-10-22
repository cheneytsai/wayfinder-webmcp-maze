/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";

/** Expose the same in-iframe handlers through the MCP Apps host transport. */
export function registerIframeTools(
  app: App,
  tools: WebMCP.ModelContextTool[],
  ready: () => Promise<void>,
) {
  for (const tool of tools) {
    app.registerTool(tool.name, {
      description: tool.description,
      inputSchema: z.fromJSONSchema((tool.inputSchema ?? { type: "object", properties: {} }) as Parameters<typeof z.fromJSONSchema>[0]),
      annotations: {
        readOnlyHint: tool.annotations?.readOnlyHint ?? false,
        destructiveHint: false,
        openWorldHint: false,
      },
    }, async (input, extra) => {
      await ready();
      const result = await tool.execute(input as Record<string, unknown>, { signal: extra.mcpReq.signal });
      const value = result !== null && typeof result === "object" ? result : { result };
      return {
        content: [{ type: "text", text: JSON.stringify(value) }],
        structuredContent: value as Record<string, unknown>,
        isError: (value as { ok?: boolean }).ok === false || (value as { success?: boolean }).success === false || "error" in value,
      };
    });
  }
}
