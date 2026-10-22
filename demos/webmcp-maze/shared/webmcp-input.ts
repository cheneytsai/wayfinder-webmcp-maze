/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";

/** WebMCP hosts/polyfills need not validate input; validate before any mutation. */
export function createToolInputParser(schema?: object) {
  const validator = z.fromJSONSchema(
    (schema ?? { type: "object", properties: {} }) as Parameters<
      typeof z.fromJSONSchema
    >[0],
  );
  return (input: unknown): Record<string, unknown> =>
    validator.parse(input ?? {}) as Record<string, unknown>;
}
