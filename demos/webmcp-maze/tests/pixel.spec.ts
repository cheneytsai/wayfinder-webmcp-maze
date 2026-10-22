/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { expect, test, type Frame } from "@playwright/test";
import { readFileSync } from "node:fs";

async function call(
  frame: Frame,
  name: string,
  input: Record<string, unknown> = {},
) {
  return frame.evaluate(
    async ({ name, input }) => {
      const context = document.modelContext!;
      const tool = (await context.getTools()).find(
        (tool) => tool.name === name,
      );
      if (!tool) throw new Error(`Missing native tool: ${name}`);
      return JSON.parse(await context.executeTool(tool, input));
    },
    { name, input },
  );
}

for (const width of [400, 800]) {
  test(`Pixel Art MCP App: fixed native tools and drawing at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/pixel-frame", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: readFileSync("dist-pixel-widget/widget.html", "utf8"),
        headers: {
          "Content-Security-Policy":
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data: blob:; connect-src 'none'; worker-src blob:",
        },
      }),
    );
    await page.route("**/pixel-test-host", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><body>
      <script>window.addEventListener('message', event => {
        const m=event.data;if(m?.jsonrpc!=='2.0')return;
        if(m.method==='ui/initialize')event.source.postMessage({jsonrpc:'2.0',id:m.id,result:{protocolVersion:m.params.protocolVersion,hostInfo:{name:'test',version:'1'},hostCapabilities:{},hostContext:{displayMode:'inline'}}},'*');
        else if(m.method==='ui/notifications/initialized'){
          event.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-input',params:{arguments:{width:32,height:24}}},'*');
          event.source.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{kind:'pixel-art',width:32,height:24},content:[]}},'*');
        } else if(m.id!==undefined&&m.method)event.source.postMessage({jsonrpc:'2.0',id:m.id,result:{}},'*');
      });</script><iframe src='/pixel-frame' style='width:${width}px;height:560px'></iframe></body></html>`,
      }),
    );
    await page.goto("/pixel-test-host");
    const frame = page
      .frames()
      .find((frame) => frame.url().includes("pixel-frame"))!;
    await expect(frame.locator("html")).toHaveAttribute(
      "data-initialized",
      "true",
    );
    const names = await frame.evaluate(async () =>
      (await document.modelContext!.getTools()).map((t) => t.name).sort(),
    );
    expect(names).toHaveLength(25);
    const canvas = await frame.locator("#cv").elementHandle();
    // Stale launch dimensions are ignored; loading creates no tool activity.
    expect(await call(frame, "get_canvas_info")).toMatchObject({
      width: 64,
      height: 64,
      can_undo: 0,
    });
    await call(frame, "set_canvas_size", { width: 32, height: 24 });
    expect(await call(frame, "get_canvas_info")).toMatchObject({
      width: 32,
      height: 24,
    });
    await expect(
      frame.locator("button:visible, input:visible, select:visible"),
    ).toHaveCount(0);
    const before = await call(frame, "get_region_pixels", {
      x: 0,
      y: 0,
      width: 4,
      height: 4,
    });
    expect(before.rows).toEqual(["....", "....", "....", "...."]);
    expect(
      await call(frame, "draw_rect", {
        x: 0,
        y: 0,
        width: 4,
        height: 4,
        color: "#ff7b5c",
        filled: true,
      }),
    ).toMatchObject({ ok: true, changed: 16 });
    const painted = await call(frame, "get_region_pixels", {
      x: 0,
      y: 0,
      width: 4,
      height: 4,
    });
    expect(painted.rows.join("")).not.toContain(".");
    await frame.locator("body").click({ position: { x: 8, y: 8 } });
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Meta+z");
    expect(
      (
        await call(frame, "get_region_pixels", {
          x: 0,
          y: 0,
          width: 4,
          height: 4,
        })
      ).rows,
    ).toEqual(painted.rows);
    await call(frame, "undo_pixel_art_action");
    expect(
      (
        await call(frame, "get_region_pixels", {
          x: 0,
          y: 0,
          width: 4,
          height: 4,
        })
      ).rows,
    ).toEqual(before.rows);
    await call(frame, "redo_pixel_art_action");
    expect(
      (
        await call(frame, "get_region_pixels", {
          x: 0,
          y: 0,
          width: 4,
          height: 4,
        })
      ).rows,
    ).toEqual(painted.rows);
    expect(
      await call(frame, "draw_svg", {
        svg: '<svg viewBox="0 0 32 24"><circle cx="16" cy="12" r="5" fill="#ffc145"/></svg>',
      }),
    ).toMatchObject({ ok: true });
    const info = await call(frame, "get_canvas_info");
    expect(
      await call(frame, "draw_shape_preset", { shape: "unknown" }),
    ).toMatchObject({ ok: false });
    expect((await call(frame, "get_canvas_info")).can_undo).toBe(info.can_undo);
    await call(frame, "set_canvas_size", { width: 64, height: 32 });
    expect(
      await frame.evaluate(async () =>
        (await document.modelContext!.getTools()).map((t) => t.name).sort(),
      ),
    ).toEqual(names);
    expect(
      await canvas!.evaluate(
        (node) => node.isConnected && document.querySelector("#cv") === node,
      ),
    ).toBe(true);
    const overflow = await frame.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow).toBe(false);
    await expect(frame.locator("#feedCount")).toContainText("calls");
    expect(errors).toEqual([]);
  });
}
