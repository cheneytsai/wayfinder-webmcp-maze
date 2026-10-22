/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { expect, it, vi } from "vitest";
import { App } from "@modelcontextprotocol/ext-apps";
import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerStudioTools } from "../../pixel-art/src/app-tools";

it("host discovers app tools, validates inputs, waits for initialization and uses the shared handler", async () => {
  const app = new App({ name: "studio", version: "1" }, { tools: {} }, { autoResize: false });
  const host = new AppBridge(null, { name: "host", version: "1" }, {});
  let initialize!: () => void;
  const ready = new Promise<void>(resolve => { initialize = resolve; });
  const execute = vi.fn(async (input: Record<string, unknown>, options: WebMCP.ToolExecuteCallbackOptions) => {
    expect(options.signal).toBeInstanceOf(AbortSignal);
    return input.x === 9 ? { ok: false, error: "Rejected" } : { ok: true, x: input.x };
  });
  registerStudioTools(app, [{ name: "paint", description: "Paint", inputSchema: { type: "object", properties: { x: { type: "integer", minimum: 0 } }, required: ["x"] }, execute }], () => ready);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await host.connect(a);
  await app.connect(b);
  try {
    expect((await host.listTools({})).tools.map(t => t.name)).toEqual(["paint"]);
    const pending = host.callTool({ name: "paint", arguments: { x: 2 } });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(execute).not.toHaveBeenCalled();
    initialize();
    expect(await pending).toMatchObject({ structuredContent: { ok: true, x: 2 }, isError: false });
    await expect(host.callTool({ name: "paint", arguments: { x: -1 } })).rejects.toThrow("Invalid input");
    await expect(host.callTool({ name: "paint", arguments: { x: "2" } })).rejects.toThrow("Invalid input");
    expect(execute).toHaveBeenCalledTimes(1);
    expect(await host.callTool({ name: "paint", arguments: { x: 9 } })).toMatchObject({ isError: true, structuredContent: { error: "Rejected" } });
    expect((await host.listTools({})).tools.map(t => t.name)).toEqual(["paint"]);
  } finally { await app.close(); await host.close(); }
});
