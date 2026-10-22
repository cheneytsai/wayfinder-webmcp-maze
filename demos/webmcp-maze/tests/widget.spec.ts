/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

for (const built of [false, true]) {
  test(`MCP Apps iframe native tools (${built ? "built, strict CSP" : "development"})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
    if (built)
      await page.route("**/built-widget", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: readFileSync("dist-widget/widget.html", "utf8"),
          headers: {
            "Content-Security-Policy":
              "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; connect-src 'none'; worker-src blob:",
          },
        }),
      );
    await page.route("**/test-mcp-host", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><body>
    <script>
      window.addEventListener('message', event => {
        const message = event.data;
        if (message?.jsonrpc !== '2.0') return;
        if (message.method === 'ui/initialize') {
          event.source.postMessage({jsonrpc:'2.0', id:message.id, result:{protocolVersion:message.params.protocolVersion, hostInfo:{name:'Test MCP Apps host',version:'1.0.0'},hostCapabilities:{},hostContext:{displayMode:'inline',containerDimensions:{height:520,width:800}}}}, '*');
        } else if (message.method === 'ui/notifications/initialized') {
          event.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{rows:3,cols:4}}}, '*');
          event.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{kind:'maze',rows:3,cols:4},content:[]}}, '*');
        } else if (message.id !== undefined && message.method) {
          event.source.postMessage({jsonrpc:'2.0',id:message.id,result:{}}, '*');
        }
      });
    </script>
    <iframe src='${built ? "/built-widget" : "/widget.html"}' style='width:800px;height:520px'></iframe>
  </body></html>`,
      }),
    );
    await page.goto("/test-mcp-host");
    const frame = page
      .frames()
      .find((frame) =>
        frame.url().includes(built ? "built-widget" : "widget.html"),
      )!;
    await expect(frame.locator("html")).toHaveAttribute(
      "data-initialized",
      "true",
    );
    expect(await frame.locator("button,input,form").count()).toBe(0);
    const canvas = await frame.locator("canvas").elementHandle();
    // MCP results, including stale sizing fields above, must leave the intro intact.
    await expect(frame.locator("#intro-overlay")).toBeVisible();
    await frame.evaluate(async () => {
      const tool = (await document.modelContext!.getTools()).find(
        (t) => t.name === "start_game",
      )!;
      return document.modelContext!.executeTool(tool, { rows: 3, cols: 4 });
    });
    const view = await frame.evaluate(async () => {
      const tool = (await document.modelContext!.getTools()).find(
        (tool) => tool.name === "look",
      )!;
      return JSON.parse(await document.modelContext!.executeTool(tool, {}));
    });
    expect(view.mazeSize).toEqual({ rows: 3, cols: 4 });
    const result = await frame.evaluate(async (direction) => {
      const tool = (await document.modelContext!.getTools()).find(
        (tool) => tool.name === "move",
      )!;
      return JSON.parse(
        await document.modelContext!.executeTool(tool, { direction }),
      );
    }, view.openDirections[0]);
    expect(result.success).toBe(true);
    await expect(frame.locator("#move-count")).toHaveText("1");
    expect(
      await canvas!.evaluate(
        (node) => node.isConnected && document.querySelector("canvas") === node,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
