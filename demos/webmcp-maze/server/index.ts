/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMcpServer } from "./mcp.ts";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const widgetHtml = () =>
  readFileSync(resolve("dist-widget/widget.html"), "utf8");
const http = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ name: "webmcp-maze", status: "ok" }));
      return;
    }
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(widgetHtml());
      return;
    }
    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end();
      return;
    }
    const server = createMcpServer(widgetHtml, process.env.PUBLIC_ORIGIN);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});
http.listen(Number(process.env.PORT ?? 8789), "127.0.0.1", () =>
  console.log("Chrome maze MCP server ready"),
);
