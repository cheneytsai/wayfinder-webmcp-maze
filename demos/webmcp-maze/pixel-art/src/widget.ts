/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { registrationReady, tools } from "./main";
import { registerStudioTools } from "./app-tools";
import { registerTools } from "./webmcp";
import "./widget.css";

const app = new App({ name: "Pixel Art Studio", version: "1.1.0" }, {
  tools: { listChanged: false },
});
let finishInitialization!: () => void;
const ready = new Promise<void>(resolve => { finishInitialization = resolve; });
let initializationError: unknown;
registerStudioTools(app, tools, async () => {
  await ready;
  if (initializationError) throw initializationError;
});
let initialized = false;
app.ontoolresult = async params => {
  const input = params.structuredContent as Record<string, unknown> | undefined;
  if (initialized || input?.kind !== "pixel-art") return;
  initialized = true;
  try {
    let registration = await registrationReady;
    // Retry an early unsupported result once the host has initialized the app.
    if (!registration.supported) registration = await registerTools(tools);
    const result = await tools.find(tool => tool.name === "set_canvas_size")!.execute(
      { width: input.width, height: input.height },
      { signal: new AbortController().signal },
    ) as { ok?: boolean; error?: string };
    if (result?.error) throw new Error(result.error);
    document.documentElement.dataset.initialized = "true";
    document.documentElement.dataset.webmcpToolCount = String(registration.count);
    document.documentElement.dataset.appToolCount = String(tools.length);
    const status = document.createElement("span");
    status.textContent = `App tools: ${tools.length} · Native WebMCP: ${registration.count}`;
    status.className = "tool-status";
    document.querySelector(".top")?.append(status);
    finishInitialization();
    void app.updateModelContext({ content: [{ type: "text", text: `Pixel Art Studio is ready. This iframe exposes ${tools.length} app tools through tools/list and tools/call, backed by the original drawing handlers. Native WebMCP registrations: ${registration.count}. Call get_canvas_info, then draw and inspect with get_region_pixels. Keep the same widget; do not call open_studio again to edit it.` }] }).catch(error => console.warn("Could not update app context", error));
  } catch (error) {
    initializationError = error;
    document.documentElement.dataset.error = "true";
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = error instanceof Error ? error.message : "Studio initialization failed";
    document.querySelector(".stage")?.append(message);
    console.error(error);
  } finally {
    finishInitialization();
  }
};
await app.connect();
