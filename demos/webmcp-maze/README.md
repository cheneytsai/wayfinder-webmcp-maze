# Chrome WebMCP demos as ChatGPT MCP Apps

Two original [GoogleChromeLabs WebMCP demos](https://github.com/GoogleChromeLabs/webmcp-tools) packaged as MCP Apps, without React or server-side gameplay/drawing.

| Installed plugin | Endpoint | Current version | WebMCP tools |
| --- | --- | --- | --- |
| Chrome Maze WebMCP | `/mcp` | 5.0.1 | Six fixed tools: `start_game`, `look`, `move`, `pickup`, `drop`, `use` |
| Chrome Pixel Art Studio | `/pixel/mcp` | 3.0.0 | Original 25 drawing, palette, layer, history, and inspection tools |

## How it works

The MCP server exposes one parameterless loading tool per endpoint: `open_maze({})` and `open_studio({})`. Each only returns a self-contained `text/html;profile=mcp-app` resource. MCP arguments and tool results never start a game, set dimensions, draw, or invoke a WebMCP handler. The maze opens on its intro screen. Pixel Art opens with the original empty 64×64 canvas and no tool activity.

All mutations go through the iframe's WebMCP tools. Call WebMCP `start_game({rows, cols})` to generate a maze (integers from 2 to 40), or `set_canvas_size({width, height})` to size the canvas (integers from 8 to 256).
Operations use tools registered on the widget's `document.modelContext`. Both widgets pass empty app capabilities to `App` and do not use `app.registerTool`, app-side `tools/list`, or app-side `tools/call`. The previous legacy app-tool bridge has been removed. All state stays in the same widget and canvas, with no manual editing/start controls.

The embedded maze keeps its six guarded tools registered through winning and replay. App-side WebMCP `start_game` permits replay after escaping; it refuses to replace an active maze. The standalone Chrome maze retains its original state-dependent native tool lifecycle. Pixel Art keeps all 25 tools registered. Inputs are validated inside the handlers rather than relying on the browser or host to validate them.

## Host requirement and verification limits

The intended WebMCP integration is described in [ext-apps PR #798](https://github.com/modelcontextprotocol/ext-apps/pull/798), an open draft prototype. Its host-side sandbox relay reads the widget's own `document.modelContext`, handles `ui/sandbox-list-tools` and `ui/sandbox-call-tool`, and delegates the `tools` Permissions Policy. Its optional host-injected polyfill supports browsers without the native API. These responsibilities belong to the host; neither widget installs a private polyfill or handles those reserved sandbox messages itself.

The production widgets keep the released ext-apps 2.0.3 SDK for the UI handshake. The experimental PR relay and polyfill are vendored **only as test fixtures**, pinned to commit `efcc19c377770f64d4844485bb2be73a6c4b813c`. Installing a different SDK in this project cannot update ChatGPT's host.

The widget status reports registrations as `WebMCP tools: 6/6` or `25/25`. Registration does **not** prove that ChatGPT has discovered or called them. Live ChatGPT Desktop agent calls remain unverified. Earlier web tests could open widgets but could not call their tools. Do not treat an opening call or a registration count as an end-to-end success.

## Inspecting native WebMCP in DevTools

Select the **widget iframe** in DevTools' Console execution-context dropdown, rather than the ChatGPT parent page. Then run:

```js
typeof document.modelContext
Function.prototype.toString.call(document.modelContext?.registerTool)
(await document.modelContext.getTools()).map(tool => tool.name)
```

In a browser with native WebMCP enabled, registration is a native function and the last expression lists six maze tools or 25 Pixel Art tools. If the API is undefined, that frame's browser does not expose WebMCP; these apps do not install a fallback. If registration fails, check the Console for registration errors and the host iframe's `tools` Permissions Policy delegation. App code cannot grant itself that host permission. There is no `window.gameTools` shortcut in either MCP App. The standalone maze keeps the upstream eval helper only with an explicit `?eval_tool` opt-in.

## Local setup

Use Node.js 24+:

```sh
npm ci
npm run build
npm start
```

Endpoints are `http://127.0.0.1:8789/mcp` and `http://127.0.0.1:8789/pixel/mcp`. For temporary HTTPS development endpoints, install Cloudflare's official `cloudflared` client, then run:

```sh
npm run local:start
npm run local:status
```

Set `CLOUDFLARED_BIN` if the client is not on PATH. The runtime state and logs are in `.runtime/`. The script prints the public origin; use `/mcp` for the maze and `/pixel/mcp` for Pixel Art. Keep the Mac, server, and tunnel running while testing. A new tunnel URL requires updating the plugin connection. To stop this owned runtime, send SIGTERM to `supervisorPid` from `.runtime/state.json`.

In ChatGPT Plugins, add/connect each custom MCP server with no authentication for this temporary local test. After server metadata or resource URI changes, use **Manage → Refresh tools**. The installed names are **Chrome Maze WebMCP** and **Chrome Pixel Art Studio**; the older Wayfinder plugins are obsolete.

## Desktop retest prompts

Enable **Chrome Maze WebMCP**:

> Create a 3-row, 4-column maze. Discover the existing widget's WebMCP tools, call look, then take one valid step with move. Keep the same widget.

Enable **Chrome Pixel Art Studio**:

> Open a 32×32 canvas. Discover the existing widget's WebMCP tools, call get_canvas_info, paint a yellow square with draw_rect, and inspect its pixels with get_region_pixels. Keep the same widget.

For Pixel Art, the activity feed should show the actual drawing and inspection calls. For the maze, the move counter should advance and the last-tool text should change. Closing or reloading a widget loses its deliberately ephemeral state.

## Automated verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The suite covers parameterless MCP loading/resources and ignored stale sizing fields; WebMCP dimension validation; native WebMCP gameplay and drawing; no manual controls; strict CSP; fixed tool sets; canvas identity; and replay. Cross-origin host tests run the PR's unmodified relay in a sandbox proxy with `allow="tools"`, against both native WebMCP and its host polyfill. These tests discover tools through the reserved sandbox protocol, draw/inspect/undo/resize Pixel Art, and solve/replay the maze. They also assert the legacy app-tool protocol is absent. They verify compatibility with that relay fixture, not ChatGPT's private host implementation.

For standalone development, use `npm run dev` (maze, port 8788) or `npm run dev:pixel` (Pixel Art, port 8790).

## Source and license

Original demos are based on upstream commit `24cb5cb0d4b6609aac5426f90a5de6ddb847bdeb`. The Chrome game mechanics, drawing handlers, and visual styles are preserved with configurable maze size, compact widget layouts, registration/state guards, and MCP Apps launch wrappers.

[Apache-2.0](LICENSE). Copyright 2026 Google LLC; see [NOTICE](NOTICE). The test-only PR relay retains its upstream licensing text in `tests/fixtures/pr798/LICENSE` and provenance in its README.
