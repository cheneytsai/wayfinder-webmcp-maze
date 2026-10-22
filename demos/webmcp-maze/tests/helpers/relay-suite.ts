/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { injectModelContextPolyfill } from "../fixtures/pr798/model-context-host";

// The reviewed PR source runs only in the host's same-origin sandbox proxy.
const relayModule = ts.transpileModule(
  readFileSync("tests/fixtures/pr798/model-context-host.ts", "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
const wireConstants = readFileSync(
  "tests/fixtures/pr798/spec.types.js",
  "utf8",
);

async function mount(page: Page, kind: "maze" | "pixel", polyfill: boolean) {
  const html = readFileSync(
    kind === "maze"
      ? "dist-widget/widget.html"
      : "dist-pixel-widget/widget.html",
    "utf8",
  );
  const initial =
    kind === "maze"
      ? { kind: "maze", rows: 2, cols: 2 }
      : { kind: "pixel-art", width: 32, height: 24 };
  const policy = 'tools=(self "http://127.0.0.1:8788")';
  await page.route("**/relay/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("model-context-host.js"))
      return route.fulfill({
        contentType: "text/javascript",
        body: relayModule,
      });
    if (path.endsWith("spec.types.js"))
      return route.fulfill({
        contentType: "text/javascript",
        body: wireConstants,
      });
    if (path.endsWith("view"))
      return route.fulfill({
        contentType: "text/html",
        body: polyfill ? injectModelContextPolyfill(html) : html,
        headers: {
          "Content-Security-Policy":
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com; img-src data: blob:; connect-src 'none'; worker-src blob:",
          "Permissions-Policy": policy,
        },
      });
    if (path.endsWith("proxy"))
      return route.fulfill({
        contentType: "text/html",
        headers: { "Permissions-Policy": policy },
        body: `<!doctype html><html><body>
      <script type="module">
      import {createModelContextRelay} from './model-context-host.js';
      const inner=document.createElement('iframe');
      inner.setAttribute('sandbox','allow-scripts allow-same-origin');inner.setAttribute('allow','tools');
      inner.style='width:800px;height:560px';
      const relay=createModelContextRelay({getViewDocument:()=>inner.contentDocument,postToHost:m=>parent.postMessage(m,'http://localhost:8788')});
      addEventListener('message',event=>{
        if(event.source===parent&&event.origin==='http://localhost:8788'){
          if(!relay.handleHostMessage(event.data))inner.contentWindow.postMessage(event.data,'*');
        }else if(event.source===inner.contentWindow){relay.handleViewMessage(event.data);parent.postMessage(event.data,'http://localhost:8788');}
      });
      inner.src='./view';document.body.append(inner);
      </script></body></html>`,
      });
    return route.fulfill({
      contentType: "text/html",
      headers: { "Permissions-Policy": policy },
      body: `<!doctype html><html><body>
      <script>
      let id=0;const pending=new Map();window.calls=[];window.toolChanges=0;
      window.hostRequest=(method,params={})=>new Promise((resolve,reject)=>{
        const requestId='host-'+(++id);pending.set(requestId,{resolve,reject});window.calls.push(method);
        document.querySelector('iframe').contentWindow.postMessage({jsonrpc:'2.0',id:requestId,method,params},'http://127.0.0.1:8788');
      });
      addEventListener('message',event=>{
        if(event.origin!=='http://127.0.0.1:8788')return;
        const m=event.data;if(m?.jsonrpc!=='2.0')return;
        if(!m.method&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);return;}
        if(m.method==='ui/initialize'){
          window.appCapabilities=m.params.appCapabilities;
          event.source.postMessage({jsonrpc:'2.0',id:m.id,result:{protocolVersion:m.params.protocolVersion,hostInfo:{name:'PR798 test host',version:'1'},hostCapabilities:{},hostContext:{displayMode:'inline'}}},event.origin);
        }else if(m.method==='ui/notifications/initialized'){
          event.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:${JSON.stringify(initial)},content:[]}},event.origin);
        }else if(m.method==='ui/notifications/sandbox-tools-changed')window.toolChanges++;
        else if(m.id!==undefined&&m.method)event.source.postMessage({jsonrpc:'2.0',id:m.id,result:{}},event.origin);
      });</script><iframe src='http://127.0.0.1:8788/relay/proxy' allow='tools' sandbox='allow-scripts allow-same-origin' style='width:840px;height:600px'></iframe></body></html>`,
    });
  });
  await page.goto("http://localhost:8788/relay/host");
  const frame = await expect
    .poll(() =>
      page.frames().find((frame) => frame.url().endsWith("/relay/view")),
    )
    .not.toBeUndefined()
    .then(() =>
      page.frames().find((frame) => frame.url().endsWith("/relay/view"))!,
    );
  await expect(frame.locator("html")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await expect(frame.locator("html")).toHaveAttribute(
    "data-webmcp-tool-count",
    kind === "maze" ? "6" : "25",
  );
  expect(
    await page.evaluate(() => (window as any).appCapabilities.tools),
  ).toBeUndefined();
  expect(
    await frame.evaluate(
      () =>
        !!(document.modelContext as any)?.[
          Symbol.for("@modelcontextprotocol/ext-apps.modelContextPolyfill")
        ],
    ),
  ).toBe(polyfill);
  const request = (method: string, params: Record<string, unknown> = {}) =>
    page.evaluate(
      ({ method, params }) => (window as any).hostRequest(method, params),
      { method, params },
    );
  const list = async () => (await request("ui/sandbox-list-tools")).tools;
  const rawCall = (name: string, input: Record<string, unknown> = {}) =>
    request("ui/sandbox-call-tool", { name, arguments: input });
  const call = async (name: string, input: Record<string, unknown> = {}) => {
    const result = await rawCall(name, input);
    if (result.isError) throw new Error(JSON.stringify(result.content));
    return result.structuredContent;
  };
  await expect
    .poll(async () => (await list()).length)
    .toBe(kind === "maze" ? 6 : 25);
  // The legacy app-tool protocol is deliberately absent.
  await expect(request("tools/list")).rejects.toThrow();
  return { frame, list, rawCall, call };
}

export function registerRelayTests(polyfill: boolean) {
  test.describe(polyfill ? "PR798 host polyfill" : "native WebMCP", () => {
    test("sandbox relay draws, inspects, undoes and resizes Pixel Art in one canvas", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const { frame, list, rawCall, call } = await mount(
        page,
        "pixel",
        polyfill,
      );
      const names = (await list()).map((t: { name: string }) => t.name).sort();
      const canvas = await frame.locator("#cv").elementHandle();
      expect(await call("get_canvas_info")).toMatchObject({
        width: 64,
        height: 64,
        can_undo: 0,
      });
      await call("set_canvas_size", { width: 32, height: 24 });
      expect(await call("get_canvas_info")).toMatchObject({
        width: 32,
        height: 24,
      });
      expect(
        await call("draw_rect", {
          x: 2,
          y: 2,
          width: 4,
          height: 4,
          color: "#ffc145",
          filled: true,
        }),
      ).toMatchObject({ ok: true, changed: 16 });
      expect(
        (
          await call("get_region_pixels", { x: 2, y: 2, width: 4, height: 4 })
        ).rows.join(""),
      ).not.toContain(".");
      await call("undo_pixel_art_action");
      expect(
        (await call("get_region_pixels", { x: 2, y: 2, width: 4, height: 4 }))
          .rows,
      ).toEqual(["....", "....", "....", "...."]);
      await call("redo_pixel_art_action");
      const pixels = await call("get_region_pixels", {
        x: 2,
        y: 2,
        width: 4,
        height: 4,
      });
      const invalid = await rawCall("draw_rect", {
        x: "bad",
        y: 2,
        width: 4,
        height: 4,
      });
      expect(invalid.isError || invalid.structuredContent?.ok === false).toBe(
        true,
      );
      expect(
        (await call("get_region_pixels", { x: 2, y: 2, width: 4, height: 4 }))
          .rows,
      ).toEqual(pixels.rows);
      await call("set_canvas_size", { width: 64, height: 32 });
      expect(await call("get_canvas_info")).toMatchObject({
        width: 64,
        height: 32,
      });
      expect(
        (await list()).map((t: { name: string }) => t.name).sort(),
      ).toEqual(names);
      expect(
        await canvas!.evaluate(
          (node) => node.isConnected && document.querySelector("#cv") === node,
        ),
      ).toBe(true);
      await expect(
        frame.locator("button:visible,input:visible,select:visible"),
      ).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test("sandbox relay solves and replays the maze in one canvas", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const { frame, list, rawCall, call } = await mount(
        page,
        "maze",
        polyfill,
      );
      const names = ["drop", "look", "move", "pickup", "start_game", "use"];
      expect(
        (await list()).map((t: { name: string }) => t.name).sort(),
      ).toEqual(names);
      const canvas = await frame.locator("canvas").elementHandle();
      await expect(frame.locator("#intro-overlay")).toBeVisible();
      expect(await call("look")).toMatchObject({ code: "NOT_READY" });
      expect(await call("move", { direction: "north" })).toMatchObject({
        code: "NOT_READY",
      });
      expect(await call("start_game", { rows: 2, cols: 2 })).toMatchObject({
        mazeSize: { rows: 2, cols: 2 },
      });
      expect(await call("look")).toMatchObject({
        mazeSize: { rows: 2, cols: 2 },
        moveCount: 0,
      });
      expect((await rawCall("move", { direction: "diagonal" })).isError).toBe(
        true,
      );
      expect((await call("look")).moveCount).toBe(0);
      expect(await call("start_game", { rows: 8, cols: 12 })).toMatchObject({
        code: "GAME_IN_PROGRESS",
      });
      const seen = new Set<string>();
      const opposite: Record<string, string> = {
        north: "south",
        south: "north",
        east: "west",
        west: "east",
      };
      async function explore(): Promise<boolean> {
        const view = await call("look");
        seen.add(`${view.position.row},${view.position.col}`);
        for (const direction of view.openDirections) {
          const row =
            view.position.row +
            (direction === "south" ? 1 : direction === "north" ? -1 : 0);
          const col =
            view.position.col +
            (direction === "east" ? 1 : direction === "west" ? -1 : 0);
          if (seen.has(`${row},${col}`)) continue;
          const result = await call("move", { direction });
          expect(result.success).toBe(true);
          if (result.atExit) return true;
          if (await explore()) return true;
          expect(
            (await call("move", { direction: opposite[direction] })).success,
          ).toBe(true);
        }
        return false;
      }
      expect(await explore()).toBe(true);
      await expect(frame.locator("#gameover-overlay")).toBeVisible();
      expect(await call("move", { direction: "north" })).toMatchObject({
        code: "GAME_OVER",
      });
      expect(await call("start_game", { rows: 8, cols: 12 })).toMatchObject({
        mazeSize: { rows: 8, cols: 12 },
      });
      expect(await call("look")).toMatchObject({
        mazeSize: { rows: 8, cols: 12 },
        moveCount: 0,
      });
      expect((await rawCall("start_game", { rows: 41 })).isError).toBe(true);
      expect(
        (await list()).map((t: { name: string }) => t.name).sort(),
      ).toEqual(names);
      expect(
        await canvas!.evaluate(
          (node) =>
            node.isConnected && document.querySelector("canvas") === node,
        ),
      ).toBe(true);
      await expect(frame.locator("button,input,select,form")).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}
