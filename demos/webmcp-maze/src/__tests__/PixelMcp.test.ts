/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createPixelMcpServer, PIXEL_RESOURCE } from "../../server/pixel.ts";

describe("Pixel Art MCP App", () => {
  it("exposes only open_studio, validates dimensions, and serves the widget", async () => {
    const server = createPixelMcpServer(() => "<html>pixel art</html>");
    const client = new Client({ name: "pixel-test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    try {
      const { tools } = await client.listTools();
      expect(tools.map(tool => tool.name)).toEqual(["open_studio"]);
      expect(tools[0]._meta).toMatchObject({ ui: { resourceUri: PIXEL_RESOURCE } });
      for (const input of [{}, { width: 32, height: 24 }, { width: 8, height: 256 }]) {
        const result = await client.callTool({ name: "open_studio", arguments: input });
        expect(result.structuredContent).toEqual({ kind: "pixel-art", width: input.width ?? 64, height: input.height ?? 64 });
      }
      for (const input of [{ width: 7 }, { height: 257 }, { width: 8.5 }, { width: "32" }]) {
        expect((await client.callTool({ name: "open_studio", arguments: input })).isError).toBe(true);
      }
      expect((await client.readResource({ uri: PIXEL_RESOURCE })).contents[0]).toMatchObject({ mimeType: "text/html;profile=mcp-app", text: "<html>pixel art</html>" });
    } finally { await client.close(); await server.close(); }
  });
});
