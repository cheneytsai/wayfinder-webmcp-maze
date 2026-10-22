/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { test } from "@playwright/test";
import { registerRelayTests } from "./helpers/relay-suite";
test.use({
  launchOptions: {
    args: [
      "--disable-features=WebMCP,WebMCPTesting",
      "--enable-unsafe-swiftshader",
    ],
  },
});
registerRelayTests(true);
