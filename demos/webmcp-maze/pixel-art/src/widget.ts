/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { registrationReady, tools } from "./main";
import { registerTools } from "./webmcp";
import "./widget.css";

const app = new App({ name: "Pixel Art Studio", version: "3.0.1" }, {});
let initialized = false;
app.ontoolresult = async (params) => {
  const input = params.structuredContent as Record<string, unknown> | undefined;
  if (initialized || input?.kind !== "pixel-art") return;
  initialized = true;
  try {
    let registration = await registrationReady;
    // Retry an early unsupported result once the host has initialized the app.
    if (!registration.supported) registration = await registerTools(tools);
    document.documentElement.dataset.initialized = "true";
    document.documentElement.dataset.webmcpToolCount = String(
      registration.count,
    );
    const status = document.createElement("span");
    status.textContent = `WebMCP tools: ${registration.count}/${tools.length}`;
    status.className = "tool-status";
    document.querySelector(".top")?.append(status);
    void app
      .updateModelContext({
        content: [
          {
            type: "text",
            text: `Pixel Art Studio is ready. This document registered ${registration.count}/${tools.length} WebMCP tools using document.modelContext. Registration does not prove host discovery. Discover them through the host’s WebMCP integration, then use them on this canvas. Call get_canvas_info and use WebMCP set_canvas_size for requested dimensions, then draw and inspect with get_region_pixels. Keep the same widget; do not call open_studio again to edit it.`,
          },
        ],
      })
      .catch((error) => console.warn("Could not update app context", error));
  } catch (error) {
    document.documentElement.dataset.error = "true";
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent =
      error instanceof Error ? error.message : "Studio initialization failed";
    document.querySelector(".stage")?.append(message);
    console.error(error);
  }
};
await app.connect();
