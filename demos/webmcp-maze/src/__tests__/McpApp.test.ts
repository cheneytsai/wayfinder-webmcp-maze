/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../../server/mcp.ts";

describe("MCP App launch contract", () => {
  it("advertises only a launch tool and returns an MCP Apps resource", async () => {
    const server = createMcpServer(() => "<html>original maze</html>");
    const client = new Client({ name: "test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(["start_game"]);
      expect(tools[0]._meta).toMatchObject({
        ui: { resourceUri: "ui://chrome-webmcp-maze/v4.html" },
      });
      const result = await client.callTool({
        name: "start_game",
        arguments: { rows: 8, cols: 12 },
      });
      expect(result.structuredContent).toEqual({
        kind: "maze",
        rows: 8,
        cols: 12,
      });
      const defaults = await client.callTool({
        name: "start_game",
        arguments: {},
      });
      expect(defaults.structuredContent).toEqual({
        kind: "maze",
        rows: 10,
        cols: 10,
      });
      for (const args of [
        { rows: 0 },
        { cols: 41 },
        { rows: 2.5 },
        { rows: "8" },
      ]) {
        expect(
          (await client.callTool({ name: "start_game", arguments: args }))
            .isError,
        ).toBe(true);
      }
      const resource = await client.readResource({
        uri: "ui://chrome-webmcp-maze/v4.html",
      });
      expect(resource.contents[0]).toMatchObject({
        mimeType: "text/html;profile=mcp-app",
        text: "<html>original maze</html>",
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
