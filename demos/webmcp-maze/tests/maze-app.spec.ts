/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

for (const native of [true, false]) {
  test(`maze app bridge solves and replays in one canvas (native=${native})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    if (!native) await page.addInitScript(() => Object.defineProperty(document, "modelContext", { value: undefined }));
    await page.route("**/maze-app-frame", route => route.fulfill({
      contentType: "text/html", body: readFileSync("dist-widget/widget.html", "utf8"),
      headers: { "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; connect-src 'none'; worker-src blob:" },
    }));
    await page.route("**/maze-app-host", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body>
      <script>
      let nextId=0;const pending=new Map();
      window.appRequest=(method,params)=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});document.querySelector('iframe').contentWindow.postMessage({jsonrpc:'2.0',id,method,params},'*');});
      window.addEventListener('message',event=>{
        const m=event.data;if(m?.jsonrpc!=='2.0')return;
        if(!m.method&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);return;}
        if(m.method==='ui/initialize'){window.appCapabilities=m.params.appCapabilities;event.source.postMessage({jsonrpc:'2.0',id:m.id,result:{protocolVersion:m.params.protocolVersion,hostInfo:{name:'test',version:'1'},hostCapabilities:{},hostContext:{displayMode:'inline'}}},'*');}
        else if(m.method==='ui/notifications/initialized')event.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{kind:'maze',rows:2,cols:2},content:[]}},'*');
        else if(m.id!==undefined&&m.method)event.source.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');
      });</script><iframe src='/maze-app-frame' style='width:800px;height:520px'></iframe></body></html>` }));
    await page.goto("/maze-app-host");
    const frame = page.frames().find(frame => frame.url().includes("maze-app-frame"))!;
    await expect(frame.locator("html")).toHaveAttribute("data-initialized", "true");
    await expect(frame.locator("html")).toHaveAttribute("data-app-tool-count", "6");
    await expect(frame.locator("html")).toHaveAttribute("data-webmcp-available", String(native));
    expect(await page.evaluate(() => (window as any).appCapabilities.tools)).toBeDefined();
    const request = (method: string, params: Record<string, unknown> = {}) => page.evaluate(({ method, params }) => (window as any).appRequest(method, params), { method, params });
    const call = async (name: string, input: Record<string, unknown> = {}) => (await request("tools/call", { name, arguments: input })).structuredContent;
    const names = ["drop", "look", "move", "pickup", "start_game", "use"];
    expect((await request("tools/list")).tools.map((tool: { name: string }) => tool.name).sort()).toEqual(names);
    if (native) expect(await frame.evaluate(async () => (await document.modelContext!.getTools()).map(t => t.name).sort())).toEqual(names);
    const canvas = await frame.locator("canvas").elementHandle();
    await expect(frame.locator("button,input,select,form")).toHaveCount(0);
    expect(await call("look")).toMatchObject({ mazeSize: { rows: 2, cols: 2 }, moveCount: 0 });
    expect(await request("tools/call", { name: "start_game", arguments: { rows: 8, cols: 12 } })).toMatchObject({ isError: true, structuredContent: { code: "GAME_IN_PROGRESS" } });
    await expect(call("move", { direction: "diagonal" })).rejects.toThrow("Invalid input");
    expect((await call("look")).moveCount).toBe(0);
    const seen = new Set<string>();
    const opposite: Record<string, string> = { north: "south", south: "north", east: "west", west: "east" };
    async function explore(): Promise<boolean> {
      const view = await call("look");
      seen.add(`${view.position.row},${view.position.col}`);
      for (const direction of view.openDirections) {
        const row = view.position.row + (direction === "south" ? 1 : direction === "north" ? -1 : 0);
        const col = view.position.col + (direction === "east" ? 1 : direction === "west" ? -1 : 0);
        if (seen.has(`${row},${col}`)) continue;
        const moved = await call("move", { direction });
        expect(moved.success).toBe(true);
        if (moved.atExit) return true;
        if (await explore()) return true;
        expect((await call("move", { direction: opposite[direction] })).success).toBe(true);
      }
      return false;
    }
    expect(await explore()).toBe(true);
    await expect(frame.locator("#gameover-overlay")).toBeVisible();
    expect(await call("look")).toMatchObject({ atExit: true });
    expect(await request("tools/call", { name: "move", arguments: { direction: "north" } })).toMatchObject({ isError: true, structuredContent: { code: "GAME_OVER" } });
    expect((await request("tools/list")).tools.map((tool: { name: string }) => tool.name).sort()).toEqual(names);
    expect(await call("start_game", { rows: 8, cols: 12 })).toMatchObject({ mazeSize: { rows: 8, cols: 12 } });
    expect(await call("look")).toMatchObject({ mazeSize: { rows: 8, cols: 12 }, moveCount: 0 });
    await expect(call("start_game", { rows: 41 })).rejects.toThrow("Invalid input");
    if (native) expect(await frame.evaluate(async () => (await document.modelContext!.getTools()).map(t => t.name).sort())).toEqual(names);
    expect(await canvas!.evaluate(node => node.isConnected && document.querySelector("canvas") === node)).toBe(true);
    await expect(frame.locator("#maze-last-tool")).toHaveText("Last tool: look");
    expect(errors).toEqual([]);
  });
}
