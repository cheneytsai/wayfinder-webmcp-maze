/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { expect, test, type Page } from "@playwright/test";

// Calls the real browser API: no registry mock, gameTools shortcut, or server.
async function call(
  page: Page,
  name: string,
  input: Record<string, unknown> = {},
) {
  return page.evaluate(
    async ({ name, input }) => {
      const context = document.modelContext!;
      const tool = (await context.getTools()).find(
        (tool) => tool.name === name,
      );
      if (!tool) throw new Error(`Tool not registered: ${name}`);
      return JSON.parse(await context.executeTool(tool, input));
    },
    { name, input },
  );
}

async function tools(page: Page) {
  return page.evaluate(async () =>
    (await document.modelContext!.getTools()).map((tool) => tool.name).sort(),
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#intro-overlay")).toBeVisible();
  expect(await page.evaluate(() => !!document.modelContext)).toBe(true);
});

test("native discovery, schema, default size, and gameplay tool lifecycle", async ({
  page,
}) => {
  expect(await tools(page)).toEqual(["start_game"]);
  const schema = await page.evaluate(
    async () => (await document.modelContext!.getTools())[0].inputSchema,
  );
  expect(schema).toMatchObject({
    properties: {
      rows: { type: "integer", minimum: 2, maximum: 40 },
      cols: { type: "integer", minimum: 2, maximum: 40 },
    },
  });
  expect(await call(page, "start_game")).toMatchObject({
    mazeSize: { rows: 10, cols: 10 },
  });
  await expect(page.locator("#intro-overlay")).toHaveCount(0);
  expect(await tools(page)).toEqual(["drop", "look", "move", "pickup", "use"]);
  expect(await call(page, "look")).toMatchObject({
    mazeSize: { rows: 10, cols: 10 },
    moveCount: 0,
  });
});

for (const [rows, cols] of [
  [8, 12],
  [2, 40],
  [40, 2],
  [40, 40],
]) {
  test(`native start_game creates ${rows} × ${cols} in the existing canvas`, async ({
    page,
  }) => {
    const canvas = await page.locator("canvas").elementHandle();
    expect(await call(page, "start_game", { rows, cols })).toMatchObject({
      mazeSize: { rows, cols },
      exitPosition: { row: rows - 1, col: cols - 1 },
    });
    expect(await call(page, "look")).toMatchObject({
      mazeSize: { rows, cols },
    });
    expect(
      await canvas!.evaluate(
        (node) => node === document.querySelector("canvas") && node.isConnected,
      ),
    ).toBe(true);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(page.locator("#explored-count")).toContainText(
      `/${rows * cols}`,
    );
  });
}

test("the title screen exposes no controls that mutate game state", async ({
  page,
}) => {
  await expect(
    page.locator("button, input, select, textarea, form"),
  ).toHaveCount(0);
  expect(await tools(page)).toEqual(["start_game"]);
  await expect(page.locator("#intro-overlay")).toBeVisible();
});

test("solve and replay entirely through native WebMCP, keeping one canvas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const canvas = await page.locator("canvas").elementHandle();
  await call(page, "start_game", { rows: 2, cols: 2 });
  const seen = new Set<string>();
  const opposite: Record<string, string> = {
    north: "south",
    south: "north",
    east: "west",
    west: "east",
  };
  let steps = 0;
  async function explore(): Promise<boolean> {
    const view = await call(page, "look");
    seen.add(`${view.position.row},${view.position.col}`);
    for (const direction of view.openDirections as string[]) {
      const next = {
        row:
          view.position.row +
          (direction === "south" ? 1 : direction === "north" ? -1 : 0),
        col:
          view.position.col +
          (direction === "east" ? 1 : direction === "west" ? -1 : 0),
      };
      if (seen.has(`${next.row},${next.col}`)) continue;
      const result = await call(page, "move", { direction });
      expect(result.success).toBe(true);
      steps++;
      if (result.atExit) return true;
      await expect(page.locator("#move-count")).toHaveText(String(steps));
      if (await explore()) return true;
      expect(
        (await call(page, "move", { direction: opposite[direction] })).success,
      ).toBe(true);
      steps++;
    }
    return false;
  }
  expect(await explore()).toBe(true);
  await expect(page.locator("#gameover-overlay")).toBeVisible();
  expect(await tools(page)).toEqual(["start_game"]);
  await call(page, "start_game", { rows: 3, cols: 5 });
  expect(await call(page, "look")).toMatchObject({
    mazeSize: { rows: 3, cols: 5 },
    moveCount: 0,
  });
  expect(
    await canvas!.evaluate(
      (node) => node === document.querySelector("canvas") && node.isConnected,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
