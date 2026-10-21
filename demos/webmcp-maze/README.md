# Chrome WebMCP Maze — configurable size

This is [GoogleChromeLabs/webmcp-tools/demos/webmcp-maze](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/demos/webmcp-maze), based on upstream commit `24cb5cb0d4b6609aac5426f90a5de6ddb847bdeb`.

The change is intentionally small: `start_game` accepts optional `rows` and `cols` (whole numbers from 2 to 40, each defaulting to 10). The title screen stays unchanged; only WebMCP tools mutate game state. The original PixiJS rendering, fog, items, maze generator, and gameplay tools are preserved. No React or backend is required.

## Run locally

Use Node.js 22.12+ or 24+:

```sh
npm ci
npm run dev
```

Open **http://localhost:8788/** as a top-level page in a browser with WebMCP agent support. Keep the dev server running. The Codex in-app browser was verified with the page's WebMCP capability. For standalone Chrome, use a current version supporting WebMCP and enable `chrome://flags/#enable-webmcp-testing` if the API is unavailable; an agent or tool inspector is also needed to invoke the tools. Localhost is a trustworthy context.

Creating and playing a maze requires `document.modelContext` and a WebMCP-capable agent. This version does not use the previous Wayfinder ChatGPT plugin or a public tunnel. It is a browser WebMCP demo, not an MCP App iframe.

## Ask the browser agent

- “Start an 8-row, 12-column maze.”
- “Look around, then move one cell in an open direction.”
- “Solve this maze. Explore with look and move, and use keys or dynamite when needed.”
- After winning: “Start another maze with 20 rows and 20 columns.”

The agent first calls `start_game({rows: 8, cols: 12})`. During gameplay the page exposes the original `look`, `move`, `pickup`, `drop`, and `use` tools. After escaping, `start_game` becomes available again. Every call updates the same page and canvas.

To verify real WebMCP use, inspect the agent's browser tool calls: they should target the page's `start_game`, `look`, or `move` tools at `http://localhost:8788`, rather than the old Wayfinder connector. A WebMCP inspector can also list and invoke the tools. The automated browser tests use native `document.modelContext.getTools()` and `executeTool()` with no polyfill or backend.

## Tests

```sh
npm test                  # upstream tests plus dimension validation
npm run build             # strict TypeScript and production build
npx playwright install chromium
npm run test:e2e           # native Chrome WebMCP browser tests
```

The browser tests enable WebMCP and cover tool discovery/lifecycle, defaults, rectangular grids, both dimension limits, the absence of manual controls, solving, replay, and canvas identity.

## License

[Apache-2.0](LICENSE). Original source copyright 2026 Google LLC. Configurable size support and its tests were added to this copy. Files outside the size feature retain the upstream implementation.
