/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8788",
    launchOptions: {
      args: ["--enable-features=WebMCPTesting", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:8788",
    reuseExistingServer: !process.env.CI,
  },
});
