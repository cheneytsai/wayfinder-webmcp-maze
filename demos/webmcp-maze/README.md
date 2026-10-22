# Chrome Pixel Art Studio — ChatGPT MCP App

The original [GoogleChromeLabs Pixel Art Studio](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/demos/pixel-art-studio), packaged as a plain TypeScript MCP App. The server exposes only `open_studio({width, height})`; all 25 drawing, palette, layer, inspection, and undo tools are exposed by the iframe through the MCP Apps tools bridge. Native WebMCP registration is also preserved. Both routes execute the same handlers against the same canvas. Edits keep the same canvas. The widget preserves the original canvas, fonts, and activity feed, with manual editing controls and keyboard mutations disabled.

## Try Pixel Art Studio locally

Run the build and local runtime commands below. Add a custom ChatGPT plugin with the runtime's public origin followed by **`/pixel/mcp`**, and choose no authentication. The maze uses the separate `/mcp` endpoint. This temporary tunnel must remain running; restarting it can change the public URL.

In ChatGPT Desktop, enable **Chrome Pixel Art Studio** and ask:

> Open a 32-by-32 pixel canvas and draw a tiny sunset with mountains using the widget's WebMCP tools. Inspect the pixels to verify it.

Then:

> Add a yellow moon to the same canvas, undo that change, then redo it.

The widget advertises app tool capabilities during initialization and handles host tool discovery and calls. Expanding the app is not an implementation requirement of this bridge. The first call should be `open_studio`; later calls should be iframe app tools such as `get_canvas_info`, `draw_svg`, `draw_rect`, `get_region_pixels`, and `undo_pixel_art_action`. The activity feed records those calls. Reopening the studio creates a new canvas and is not needed for edits. Artwork is ephemeral and lives in the widget.

## Pixel verification

The production bundle passes native WebMCP and MCP Apps host-message tests at 400px and 800px widths, including tools/list, tools/call, drawing, pixel inspection, undo/redo, resize, fixed tool names, and canvas identity under a strict CSP. An additional test disables native WebMCP and verifies bridge-based drawing and undo. SDK AppBridge tests verify discovery, initialization gating, input validation, and shared-handler execution. The browser host is a fixture; these tests do not establish a live ChatGPT conversation result.

The complete project currently passes **104 unit tests and 12 browser tests**, plus both application builds. Live ChatGPT discovery remains a separate verification step. The earlier v1 widget lacked app-side MCP Apps tool capabilities and handlers; v1.1 adds them, retaining native WebMCP.

Live web retest (October 22, 2026): the v1.1 widget initializes and reports `App tools: 25 · Native WebMCP: 0`. ChatGPT receives its context update, but the web conversation still does not expose the app tools to the agent. No drawing call succeeded there. The bridge is verified in SDK/iframe host tests; ChatGPT Desktop remains unverified. This change is not proof of native WebMCP support in ChatGPT.

The original maze implementation and setup are retained below.

---

# Chrome Maze WebMCP — ChatGPT MCP App

The original [Google Chrome WebMCP maze](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/demos/webmcp-maze), packaged as a ChatGPT MCP App. No React, component library, database, or server-side gameplay.

## How it works

1. ChatGPT calls the MCP server's only tool, `start_game({rows: 8, cols: 12})`.
2. The server returns the original PixiJS maze as an MCP Apps iframe. The MCP Apps tool-result notification initializes its requested grid.
3. The iframe registers the original `look`, `move`, `pickup`, `drop`, and `use` tools with `document.modelContext`.
4. Codex in ChatGPT Desktop discovers those WebMCP tools and uses them directly inside the same widget. Moves do not return new widgets or run on the server.

There are no manual game controls. Dimensions are integers from 2 to 40, each defaulting to 10. Large grids scale to the inline viewport. After escaping, the iframe exposes `start_game` for replay.

WebMCP support for MCP Apps in ChatGPT Desktop was [announced October 20, 2026](https://x.com/ndmccormack/status/2112701653098930296). This integration targets that desktop capability. The standalone website is retained for development, but opening it is not the plugin test.

## Local setup

Use Node.js 24+:

```sh
npm ci
npm run build
npm start
```

The MCP endpoint is `http://127.0.0.1:8789/mcp`. For a temporary HTTPS development endpoint, install Cloudflare's official `cloudflared` client, then run:

```sh
npm run local:start
npm run local:status
```

`local:start` runs the server and tunnel in the background and prints the HTTPS `/mcp` URL. Set `CLOUDFLARED_BIN` if the client is not on PATH. The runtime state and logs are in `.runtime/`. To stop this owned test runtime, send SIGTERM to `supervisorPid` from `.runtime/state.json`.

In ChatGPT Plugins, add a custom MCP server using the printed URL and select no authentication for this local-only test. Create/connect the plugin, then enable it in a **ChatGPT Desktop** conversation. A tunnel exposes the static widget and launch tool; gameplay state stays in the widget. A fresh tunnel URL requires updating/recreating the test connection.

The installed local-test plugin is named **Chrome Maze WebMCP**. The earlier Wayfinder plugins belong to the replaced implementation.

## Conversation test

Select **@Chrome Maze WebMCP**, then ask:

> Create a 3-row, 4-column maze and solve it using the widget's WebMCP tools.

For a larger grid:

> Create an 8-row, 12-column maze. Look around, then take one valid step.

In Desktop, expand the maze using **Open app in tab** before asking the agent to play if the tools are not listed. The desktop MCP Apps browser interface exposes expanded app tabs, rather than inline-only widgets.

The initial call is the plugin's MCP `start_game`. Subsequent calls must be the iframe's WebMCP tools. Check that movement and the move counter update in the original widget, with no additional widget per move. Closing or reloading the widget loses this deliberately ephemeral maze.

## Verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests cover MCP discovery/resource MIME type, the single launch tool, defaults and invalid dimensions, native WebMCP discovery/lifecycle, rectangular and boundary grids, solving/replay, no manual controls, canvas identity, and an MCP Apps host handshake followed by real native WebMCP calls inside the iframe. The automated iframe test simulates the MCP Apps host transport, not WebMCP; live Desktop conversation verification is a separate check.

For the standalone development page only, run `npm run dev` and open `http://localhost:8788/`.

## Current verification record

- Build, 103 unit tests, and 11 browser tests pass across both demos.
- The production iframe passes native WebMCP discovery and movement under a CSP that forbids unsafe-eval.
- The installed plugin rendered a 3×4 maze in [this ChatGPT test conversation](https://chatgpt.com/c/6ad92946-fc7c-83e8-bd61-b8958f88c4ec).
- The web conversation could not discover iframe gameplay tools. The announcement targets ChatGPT Desktop; a live Desktop solve remains to be completed after enabling the plugin and expanding the app in that conversation. Automated iframe tests do not replace this check.

## Source and license

Based on upstream commit `24cb5cb0d4b6609aac5426f90a5de6ddb847bdeb`. Original game mechanics and neon PixiJS visuals are preserved. Changes add size validation, viewport fitting, asynchronous registration cleanup, shared bootstrap, and the small MCP Apps wrapper/server.

[Apache-2.0](LICENSE). Copyright 2026 Google LLC; see [NOTICE](NOTICE).
