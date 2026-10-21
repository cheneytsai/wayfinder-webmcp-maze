/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  root: resolve("pixel-art"),
  base: "",
  plugins: [viteSingleFile()],
  build: { outDir: resolve("dist-pixel-widget"), emptyOutDir: true, rollupOptions: { input: resolve("pixel-art/widget.html") } },
});
