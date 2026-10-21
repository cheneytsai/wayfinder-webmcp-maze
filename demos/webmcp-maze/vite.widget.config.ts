/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  base: "",
  plugins: [viteSingleFile()],
  build: { outDir: "dist-widget", rollupOptions: { input: "widget.html" } },
});
