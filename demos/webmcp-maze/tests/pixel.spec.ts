/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { expect, test, type Frame } from "@playwright/test";
import { readFileSync } from "node:fs";

async function call(frame: Frame, name: string, input: Record<string, unknown> = {}) {
  return frame.evaluate(async ({ name, input }) => {
    const context = document.modelContext!;
    const tool = (await context.getTools()).find(tool => tool.name === name);
    if (!tool) throw new Error(`Missing native tool: ${name}`);
    return JSON.parse(await context.executeTool(tool, input));
  }, { name, input });
}

for (const { width, native } of [{ width: 400, native: true }, { width: 800, native: true }, { width: 400, native: false }]) {
  test(`Pixel Art MCP App: fixed native tools and drawing at ${width}px (native=${native})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/pixel-frame", route => route.fulfill({
      contentType: "text/html", body: readFileSync("dist-pixel-widget/widget.html", "utf8"),
      headers: { "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data: blob:; connect-src 'none'; worker-src blob:" },
    }));
    await page.route("**/pixel-test-host", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body>
      <script>
      let requestId=0; const pending=new Map();
      window.bridgeRequest=(method,params)=>new Promise((resolve,reject)=>{
        const id=++requestId;pending.set(id,{resolve,reject});
        document.querySelector('iframe').contentWindow.postMessage({jsonrpc:'2.0',id,method,params},'*');
      });
      window.addEventListener('message', event => {
        const m=event.data;if(m?.jsonrpc!=='2.0')return;
        if(!m.method&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);return;}
        if(m.method==='ui/initialize')window.appCapabilities=m.params.appCapabilities;
        if(m.method==='ui/initialize')event.source.postMessage({jsonrpc:'2.0',id:m.id,result:{protocolVersion:m.params.protocolVersion,hostInfo:{name:'test',version:'1'},hostCapabilities:{},hostContext:{displayMode:'inline'}}},'*');
        else if(m.method==='ui/notifications/initialized'){
          event.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{width:32,height:24}}},'*');
          event.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{kind:'pixel-art',width:32,height:24},content:[]}},'*');
        } else if(m.id!==undefined&&m.method)event.source.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');
      });</script><iframe src='/pixel-frame' style='width:${width}px;height:560px'></iframe></body></html>` }));
    if (!native) await page.addInitScript(() => Object.defineProperty(document, "modelContext", { value: undefined }));
    await page.goto("/pixel-test-host");
    const frame = page.frames().find(frame => frame.url().includes("pixel-frame"))!;
    await expect(frame.locator("html")).toHaveAttribute("data-initialized", "true");
    expect(await page.evaluate(() => (window as any).appCapabilities.tools)).toBeDefined();
    const bridge = (method: string, params: Record<string, unknown> = {}) => page.evaluate(({ method, params }) => (window as any).bridgeRequest(method, params), { method, params });
    expect((await bridge("tools/list")).tools).toHaveLength(25);
    expect((await bridge("tools/call", { name: "get_canvas_info", arguments: {} })).structuredContent).toMatchObject({ width: 32, height: 24 });
    if (!native) {
      await expect(frame.locator("html")).toHaveAttribute("data-webmcp-tool-count", "0");
      await expect(frame.locator("html")).toHaveAttribute("data-app-tool-count", "25");
      expect(await bridge("tools/call", { name: "draw_rect", arguments: { x: 0, y: 0, width: 4, height: 4, color: "#ffc145", filled: true } })).toMatchObject({ isError: false, structuredContent: { changed: 16 } });
      const pixels = (await bridge("tools/call", { name: "get_region_pixels", arguments: { x: 0, y: 0, width: 4, height: 4 } })).structuredContent.rows;
      expect(pixels.join("")).not.toContain(".");
      await bridge("tools/call", { name: "undo_pixel_art_action", arguments: {} });
      expect((await bridge("tools/call", { name: "get_region_pixels", arguments: { x: 0, y: 0, width: 4, height: 4 } })).structuredContent.rows).toEqual(["....", "....", "....", "...."]);
      expect(errors).toEqual([]);
      return;
    }
    const names = await frame.evaluate(async () => (await document.modelContext!.getTools()).map(t => t.name).sort());
    expect(names).toHaveLength(25);
    const canvas = await frame.locator("#cv").elementHandle();
    expect(await call(frame, "get_canvas_info")).toMatchObject({ width: 32, height: 24 });
    await expect(frame.locator("button:visible, input:visible, select:visible")).toHaveCount(0);
    const before = await call(frame, "get_region_pixels", { x: 0, y: 0, width: 4, height: 4 });
    expect(before.rows).toEqual(["....", "....", "....", "...."]);
    expect(await call(frame, "draw_rect", { x: 0, y: 0, width: 4, height: 4, color: "#ff7b5c", filled: true })).toMatchObject({ ok: true, changed: 16 });
    const painted = await call(frame, "get_region_pixels", { x: 0, y: 0, width: 4, height: 4 });
    expect(painted.rows.join("")).not.toContain(".");
    await frame.locator("body").click({ position: { x: 8, y: 8 } });
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Meta+z");
    expect((await call(frame, "get_region_pixels", { x: 0, y: 0, width: 4, height: 4 })).rows).toEqual(painted.rows);
    await call(frame, "undo_pixel_art_action");
    expect((await call(frame, "get_region_pixels", { x: 0, y: 0, width: 4, height: 4 })).rows).toEqual(before.rows);
    await call(frame, "redo_pixel_art_action");
    expect((await call(frame, "get_region_pixels", { x: 0, y: 0, width: 4, height: 4 })).rows).toEqual(painted.rows);
    expect(await call(frame, "draw_svg", { svg: '<svg viewBox="0 0 32 24"><circle cx="16" cy="12" r="5" fill="#ffc145"/></svg>' })).toMatchObject({ ok: true });
    const info = await call(frame, "get_canvas_info");
    expect(await call(frame, "draw_shape_preset", { shape: "unknown" })).toMatchObject({ ok: false });
    expect((await call(frame, "get_canvas_info")).can_undo).toBe(info.can_undo);
    await call(frame, "set_canvas_size", { width: 64, height: 32 });
    expect(await frame.evaluate(async () => (await document.modelContext!.getTools()).map(t => t.name).sort())).toEqual(names);
    expect(await canvas!.evaluate(node => node.isConnected && document.querySelector("#cv") === node)).toBe(true);
    const bridgeNames = (await bridge("tools/list")).tools.map((tool: { name: string }) => tool.name).sort();
    expect(bridgeNames).toEqual(names);
    expect(await bridge("tools/call", { name: "draw_rect", arguments: { x: 8, y: 8, width: 4, height: 4, color: "#ffc145", filled: true } })).toMatchObject({ isError: false, structuredContent: { ok: true } });
    const bridgePixels = await bridge("tools/call", { name: "get_region_pixels", arguments: { x: 8, y: 8, width: 4, height: 4 } });
    expect(bridgePixels.structuredContent.rows.join("")).not.toContain(".");
    expect((await call(frame, "get_region_pixels", { x: 8, y: 8, width: 4, height: 4 })).rows).toEqual(bridgePixels.structuredContent.rows);
    await expect(bridge("tools/call", { name: "draw_rect", arguments: { x: "invalid" } })).rejects.toThrow("Invalid input");
    expect(await canvas!.evaluate(node => node.isConnected && document.querySelector("#cv") === node)).toBe(true);
    const overflow = await frame.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await expect(frame.locator("#feedCount")).toContainText("calls");
    expect(errors).toEqual([]);
  });
}
