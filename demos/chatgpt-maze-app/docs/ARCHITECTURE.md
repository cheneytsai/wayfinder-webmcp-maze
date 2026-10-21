# Architecture

ChatGPT calls the Streamable HTTP MCP endpoint. A stateless MCP server instance registers the six tools and `ui://maze/app-v1.html` for each request. The singleton `MazeService` validates inputs, loads the maze from SQLite, invokes the upstream primitive WebMCP handler, saves progress, and returns an observation plus a revealed-only UI snapshot. Persisted state belongs to the explicit random `mazeId`, not an HTTP session or global "current game".

The HTML is bundled by Vite into one file. In an MCP Apps iframe, the official `App` SDK handles `ui/initialize`, `ui/notifications/tool-result`, `tools/call`, and `ui/message`. The result snapshot updates React. In the standalone playground, the same operations use the same-origin `/api/tools/:name` endpoint. Browser WebMCP registration forwards native tool callbacks through that same bridge. No browser agent can directly read the service's hidden board through a tool response.

The maze generator is Chrome's iterative recursive backtracker, which produces a connected tree. Optional item placement selects successive edges of the unique start/exit path. Each matching collectible is placed at the beginning of its segment, with the blocker later in that segment. Thus each segment is traversable in order and inventory never needs to hold two items.

The reference test agent constructs its map solely from `look`/action observations. It explores reachable frontiers, routes back through known cells, fetches matching collectibles when a blocker gates remaining territory, and stops at the exit. The app never exposes that algorithm as a tool: ChatGPT remains responsible for its own planning.

Host simulation verifies the app-side protocol independently of a ChatGPT account. A real ChatGPT installation and prompt still provide the final host-specific acceptance check. Native browser WebMCP is a preview API; tests inject its registration surface to test our adapter, not Chrome's own implementation.
