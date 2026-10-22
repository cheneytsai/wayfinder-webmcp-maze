/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { expect, it } from "vitest";
import { createToolInputParser } from "../../shared/webmcp-input";

it("validates WebMCP inputs without depending on host validation", () => {
  const parse = createToolInputParser({
    type: "object",
    properties: {
      size: { type: "integer", minimum: 2, maximum: 40 },
      direction: { type: "string", enum: ["north", "south"] },
    },
    required: ["size"],
  });
  expect(parse({ size: 8, direction: "north" })).toEqual({
    size: 8,
    direction: "north",
  });
  for (const input of [
    {},
    { size: "8" },
    { size: 1 },
    { size: 41 },
    { size: 2.5 },
    { size: 8, direction: "bad" },
  ])
    expect(() => parse(input)).toThrow();
});
it("accepts no-argument tools and applies schema defaults", () => {
  expect(createToolInputParser()(undefined)).toEqual({});
  expect(
    createToolInputParser({
      type: "object",
      properties: { rows: { type: "integer", default: 10 } },
    })({}),
  ).toEqual({ rows: 10 });
});
