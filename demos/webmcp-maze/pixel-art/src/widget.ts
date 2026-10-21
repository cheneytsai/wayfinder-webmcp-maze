/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { registrationReady, tools } from "./main";
import "./widget.css";

const app = new App({ name: "Pixel Art Studio", version: "1.0.0" }, {});
let initialized = false;
app.ontoolresult = async params => {
  const input = params.structuredContent as Record<string, unknown> | undefined;
  if (initialized || input?.kind !== "pixel-art") return;
  initialized = true;
  try {
    const registration = await registrationReady;
    if (!registration.supported || registration.count !== tools.length) {
      throw new Error(`Registered ${registration.count}/${tools.length} WebMCP tools. Open this app in ChatGPT Desktop with site tools enabled.`);
    }
    const result = await tools.find(tool => tool.name === "set_canvas_size")!.execute(
      { width: input.width, height: input.height },
      { signal: new AbortController().signal },
    ) as { ok?: boolean; error?: string };
    if (result?.error) throw new Error(result.error);
    document.documentElement.dataset.initialized = "true";
    document.documentElement.dataset.webmcpToolCount = String(registration.count);
    await app.updateModelContext({ content: [{ type: "text", text: `Pixel Art Studio is open with ${registration.count} native WebMCP tools registered inside this iframe. Call get_canvas_info, draw with draw_svg or the drawing tools, and inspect with get_region_pixels. Keep this widget open; do not call open_studio again to edit the existing canvas.` }] });
  } catch (error) {
    initialized = false;
    document.documentElement.dataset.error = "true";
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = error instanceof Error ? error.message : "Studio initialization failed";
    document.querySelector(".stage")?.append(message);
    console.error(error);
  }
};
await app.connect();
