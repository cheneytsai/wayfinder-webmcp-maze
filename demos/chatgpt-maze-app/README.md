# Wayfinder — WebMCP Maze for ChatGPT

A React MCP App adapted from [Chrome's WebMCP maze](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/demos/webmcp-maze). Ask ChatGPT to initialize a rectangular grid, then explore and solve it using `look`, `move`, `pickup`, `drop`, and `use`. There is no server-side solve tool and no arbitrary JavaScript evaluation endpoint.

## Run

Node.js **22.13+** (24 recommended), npm, and Chromium for browser tests.

```sh
npm ci
npm run build
PORT=8788 npm start
```

Open <http://localhost:8788>. Component gallery: <http://localhost:8788/?gallery>. MCP endpoint: <http://localhost:8788/mcp>. No OpenAI API key is needed; ChatGPT supplies the agent.

For UI development, keep the server running and run `npm run dev:web` in another terminal. The Vite server at port 5173 proxies `/api` to port 8787 by default; set the backend to that port for this development mode (`npm run dev`).

## Use in ChatGPT

Follow the current [official MCP Apps quickstart](https://developers.openai.com/plugins/build/app-quickstart). ChatGPT needs a reachable HTTPS server; localhost by itself is not reachable from its remote MCP client.

1. Run the built server on port 8788.
2. Expose it with `cloudflared tunnel --url http://127.0.0.1:8788` or `ngrok http 8788`.
3. Restart the server with the generated HTTPS **base** URL allowed:

   ```sh
   PORT=8788 PUBLIC_ORIGIN=https://your-tunnel.example npm start
   ```

4. In [ChatGPT Plugins](https://chatgpt.com/plugins), select **Add → Add custom MCP server**. Name it **Wayfinder Maze**, set the server URL to `https://your-tunnel.example/mcp`, and choose **No authentication** for this maze-only demo. Review the warning and create/install the plugin.
5. Start a chat, select `@Wayfinder Maze`, and try:

   > Create an 8-row, 12-column maze. Then solve it using the maze tools, remembering visited cells and backtracking when needed. Keep going until atExit is true.

   For item puzzles:

   > Create a 10 by 10 maze with keys, doors and rocks. Explore it, collect matching items, and reach the exit.

A quick tunnel is temporary: keep both server and tunnel processes alive. A new quick tunnel gets a new URL; update the plugin connection and `PUBLIC_ORIGIN` after it changes. For permanent use, deploy the provided Docker image on an HTTPS host with a persistent disk and stable domain. Refresh the plugin after changing tool metadata.

A ChatGPT account/workspace with permission to create custom MCP plugins is required. UI wording and availability may vary. Native browser WebMCP is optional for ChatGPT, and requires a browser exposing `navigator.modelContext` or `document.modelContext` to test with a browser-native agent.

## Protocol and tools

| Tool | Arguments | Behavior |
| --- | --- | --- |
| `start_game` | `rows` and `cols`: integers 2–40, default 10; `items`: boolean, default false | Creates a separate game and returns `mazeId` |
| `look` | `mazeId` | Observes current position, open passages, blockers, inventory, exit visibility |
| `move` | `mazeId`, `direction` | One cell north/south/east/west; walls cannot be bypassed |
| `pickup` / `drop` | `mazeId` | One-slot inventory; items persist on cells |
| `use` | `mazeId`, `direction` | Matching keys clear doors; dynamite clears rocks |

All existing-game tools accept optional `expectedVersion`. A stale version returns an error without mutating the game; call `look` before retrying. Blocked moves do not increment the move count/version. Completed games reject further mutations.

Tool observations live in `structuredContent`. The React renderer receives **only revealed cells** through `_meta.state`. Full maze topology never appears in tool results or widget metadata. MCP Apps uses the official `App` bridge over `postMessage`, not a custom `window.openai` shim. Browser WebMCP tools forward to the same authoritative service; callbacks update the React UI. `window.gameTools.executeTool(name,args)` is available for debugging and uses the same path.

## Project structure

- `packages/maze-core`: upstream maze engine and five primitive WebMCP handlers, headless adapter, validated configuration, save/restore and visible snapshots.
- `packages/ui`: reusable React `Button`, `Badge`, `Panel`, `Metric`, `NumberField`, `MazeView`, and `ToolLog`, CSS tokens, JS and TypeScript declarations (`npm run build -w @maze/ui`). Import `@maze/ui` and `@maze/ui/style.css` in the workspace.
- `apps/web`: React playground and MCP iframe app. Vite generates a single inline HTML resource with no external asset requests.
- `apps/server`: Streamable HTTP MCP server, browser API, SQLite persistence and host/origin checks.
- `scripts/explore.ts`: reference observation-only test agent. This is a testing client, **not an exposed solve tool**.
- `tests`: engine properties, service validation, MCP transport, browser WebMCP and MCP Apps host simulation.

## Verify

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
# Or all checks after browser installation:
npm run check
```

For an external Playwright cache, set `PLAYWRIGHT_BROWSERS_PATH` for both installation and test commands.

Run a reference agent against a running server:

```sh
MCP_URL=http://127.0.0.1:8788/mcp ROWS=8 COLS=12 ITEMS=true npm run agent:smoke
```

It solves through MCP calls without access to saved game state. The stress test exercises 60 randomized classic/item mazes. Browser tests cover real callback registration (using an injected preview API), tool-driven solving, invalid dimensions, request errors, mobile overflow, the component gallery, and MCP Apps initialization/result/call/message flows. Real ChatGPT planning quality is separate from the deterministic test agent's correctness.

## Persistence and operating limits

SQLite defaults to `data/mazes.sqlite`; override `DB_PATH`. It survives server restarts. Games expire after 24 hours of inactivity. At most 1,000 active mazes are kept, and grid dimensions are capped at 40×40. One process serializes tool actions to prevent lost updates. Deploy one replica against a local persistent disk; the version checks are not a distributed multi-replica lock.

The demo has no accounts or OAuth. A random `mazeId` is a capability: anyone who knows it can observe/move that maze. There is no enumeration endpoint. Do not put private data into this demo. HTTP requests have a global rate budget, JSON browser API bodies are capped at 16 KiB, and unknown hosts/origins are rejected. For a public product, add proper MCP OAuth, per-user authorization/quotas, monitoring and published privacy/support pages before broad distribution.

## Docker

```sh
docker build -t wayfinder-maze .
docker run --rm -p 8788:8788 \
  -e PUBLIC_ORIGIN=https://maze.example.com \
  -v wayfinder-data:/app/data wayfinder-maze
```

Put a TLS reverse proxy in front and connect ChatGPT to `https://maze.example.com/mcp`. The Docker definition and CI workflow are included; a deployment account/domain is not provisioned by this repository.

## Upstream attribution

The engine and primitive tool handlers are extracted from `GoogleChromeLabs/webmcp-tools`, commit `24cb5cb0d4b6609aac5426f90a5de6ddb847bdeb`. The hosted source fork is [cheneytsai/wayfinder-webmcp-maze](https://github.com/cheneytsai/wayfinder-webmcp-maze), with this app in `demos/chatgpt-maze-app`. The original PixiJS renderer is replaced by React/SVG and the original `Game` orchestrator by a headless adapter. Item placement is changed to guarantee sequentially reachable matching items with a one-slot inventory. `NOTICE` details copied and changed files. Upstream Apache-2.0 copyright headers and `LICENSE` are retained.
