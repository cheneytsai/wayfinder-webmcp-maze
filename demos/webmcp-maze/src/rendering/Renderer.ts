/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Application } from "pixi.js";
import { MazeView } from "./MazeView.ts";
import { BlockersView } from "./BlockersView.ts";
import { CollectiblesView } from "./CollectiblesView.ts";
import { FogOverlay } from "./FogOverlay.ts";
import { PlayerView } from "./PlayerView.ts";
import { type MazeBoard } from "../game/MazeBoard.ts";
import { type Position, CELL_SIZE } from "../types/index.ts";

/**
 * Manages the PixiJS application, camera, and child views (maze + player).
 * Owns the canvas element and exposes methods for the game to drive rendering.
 */
export class Renderer {
  /** The PixiJS application instance. */
  private app: Application;

  /** View that draws the maze walls and exit. */
  private mazeView: MazeView;

  /** View that draws blockers (doors and rocks) on passages. */
  private blockersView: BlockersView;

  /** View that draws collectibles (keys and dynamite) on cells. */
  private collectiblesView: CollectiblesView;

  /** Overlay that draws fog of war over unrevealed cells. */
  private fogOverlay: FogOverlay;

  /** View that draws the player circle. */
  private playerView: PlayerView;

  constructor() {
    this.app = new Application();
    this.mazeView = new MazeView();
    this.blockersView = new BlockersView();
    this.collectiblesView = new CollectiblesView();
    this.fogOverlay = new FogOverlay();
    this.playerView = new PlayerView();
  }

  /**
   * Initializes the PixiJS application and attaches the canvas to the DOM.
   * Must be called once before any other methods.
   * @param container - The DOM element to append the canvas to.
   */
  async init(container: HTMLElement): Promise<void> {
    await this.app.init({
      background: 0x050a14,
      resizeTo: container,
      antialias: true,
    });
    container.appendChild(this.app.canvas);

    // Layer order: maze → blockers → collectibles → fog → player
    this.app.stage.addChild(this.mazeView.container);
    this.app.stage.addChild(this.blockersView.container);
    this.app.stage.addChild(this.collectiblesView.container);
    this.app.stage.addChild(this.fogOverlay.container);
    this.app.stage.addChild(this.playerView.container);

    // Drive animations each frame
    this.app.ticker.add((ticker) => {
      const dt = ticker.deltaMS / 1000;
      this.playerView.tick(dt);
      this.collectiblesView.tick(dt);
    });

    this.showGameCanvas(false);
  }

  /**
   * Rebuilds all maze views from a new board and centers the camera.
   * @param board - The maze board to visualize.
   */
  buildMazeView(board: MazeBoard): void {
    this.mazeView.build(board);
    this.blockersView.build(board);
    this.collectiblesView.build(board);
    this.centerCamera(board);
  }

  /**
   * Redraws the fog of war overlay based on revealed cells.
   * @param board - The maze board with visibility data.
   */
  updateFog(board: MazeBoard): void {
    this.fogOverlay.update(board);
  }

  /**
   * Redraws the collectibles view after items are picked up or dropped.
   * @param board - The maze board with collectible data.
   */
  updateCollectibles(board: MazeBoard): void {
    this.collectiblesView.update(board);
  }

  /**
   * Redraws the blockers view after a blocker is cleared.
   * @param board - The maze board with blocker data.
   */
  updateBlockers(board: MazeBoard): void {
    this.blockersView.update(board);
  }

  /**
   * Updates the player graphic to reflect a new grid position.
   * @param pos - The player's current row/col in the maze.
   */
  updatePlayerPosition(pos: Position): void {
    this.playerView.updatePosition(pos);
  }

  /**
   * Smoothly animates the player to a new grid position.
   * Resolves once the animation is complete.
   * @param pos - The target row/col in the maze.
   */
  animatePlayerMove(pos: Position): Promise<void> {
    return this.playerView.animateTo(pos);
  }

  /**
   * Shows or hides the game canvas (maze + player).
   * Used to toggle between overlay screens and the active game.
   * @param visible - Whether to show the canvas.
   */
  showGameCanvas(visible: boolean): void {
    this.app.canvas.style.display = visible ? "block" : "none";
  }

  /**
   * Registers a per-frame callback on the PixiJS ticker.
   * @param callback - Function called each frame with delta time in seconds.
   */
  onTick(callback: (dt: number) => void): void {
    this.app.ticker.add((ticker) => {
      callback(ticker.deltaMS / 1000);
    });
  }

  /**
   * Centers the maze in the viewport by offsetting the stage.
   * @param board - The maze board (for computing total pixel dimensions).
   */
  private centerCamera(board: MazeBoard): void {
    const mazeWidth = board.cols * CELL_SIZE;
    const mazeHeight = board.rows * CELL_SIZE;
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // Large configurable grids must also fit the inline MCP App viewport.
    const scale = Math.min(
      1,
      (screenWidth - 32) / mazeWidth,
      (screenHeight - 64) / mazeHeight,
    );
    this.app.stage.scale.set(Math.max(0.01, scale));
    this.app.stage.x = (screenWidth - mazeWidth * scale) / 2;
    this.app.stage.y = (screenHeight - mazeHeight * scale) / 2;
  }
}
