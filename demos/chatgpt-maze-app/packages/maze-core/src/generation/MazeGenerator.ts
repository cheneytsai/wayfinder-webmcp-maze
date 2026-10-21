/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type MazeBoard } from "../game/MazeBoard.ts";

/**
 * Interface for maze generation algorithms.
 * Implementations carve passages through a fully-walled {@link MazeBoard}.
 */
export interface MazeGenerator {
  /**
   * Carves passages in the board in-place.
   * After this call every cell should be reachable from every other cell.
   * @param board - The maze board to modify.
   */
  generate(board: MazeBoard): void;
}
