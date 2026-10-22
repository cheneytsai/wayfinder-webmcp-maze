/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../../server/mcp.ts";
import { createPixelMcpServer } from "../../server/pixel.ts";

describe("MCP Apps only load widgets", () => {
  for (const [kind, launch, create, uri] of [
    ["maze", "open_maze", createMcpServer, "ui://chrome-webmcp-maze/v7.html"],
    [
      "pixel-art",
      "open_studio",
      createPixelMcpServer,
      "ui://pixel-art-studio/v5.html",
    ],
  ] as const) {
    it(`${launch} has no mutation parameters or state in its response`, async () => {
      const server = create(() => "<html>widget</html>");
      const client = new Client({ name: "test", version: "1" });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await Promise.all([server.connect(a), client.connect(b)]);
      try {
        const { tools } = await client.listTools();
        expect(tools.map((tool) => tool.name)).toEqual([launch]);
        expect(tools[0].inputSchema.properties).toEqual({});
        expect(tools[0]._meta).toMatchObject({ ui: { resourceUri: uri } });
        const { resources } = await client.listResources();
        expect(
          resources.find((resource) => resource.uri === uri)?._meta,
        ).toMatchObject({
          ui: { permissions: { tools: {} } },
        });
        // Even stale clients sending dimensions cannot configure app state.
        for (const input of [
          {},
          { rows: 8, cols: 12, width: 32, height: 24 },
        ]) {
          const result = await client.callTool({
            name: launch,
            arguments: input,
          });
          expect(result.structuredContent).toEqual({ kind });
        }
        expect((await client.readResource({ uri })).contents[0]).toMatchObject({
          mimeType: "text/html;profile=mcp-app",
          text: "<html>widget</html>",
          _meta: { ui: { permissions: { tools: {} } } },
        });
      } finally {
        await client.close();
        await server.close();
      }
    });
  }
});
