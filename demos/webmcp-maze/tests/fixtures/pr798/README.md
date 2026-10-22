# PR #798 host relay fixture

`model-context-host.ts` is copied unchanged from `ochafik/ext-apps` commit `efcc19c377770f64d4844485bb2be73a6c4b813c`, `src/model-context-host.ts`, reviewed in https://github.com/modelcontextprotocol/ext-apps/pull/798.

It is test-only: production apps and dependencies do not ship this prototype. `spec.types.js` supplies its three wire constants without importing the entire experimental SDK. The original upstream LICENSE is included. Tests execute the relay in a sandbox proxy that is same-origin with the widget and cross-origin with the host.

