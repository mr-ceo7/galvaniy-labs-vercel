/**
 * GalvaniyPhysics — Sprite Renderer
 *
 * Renders photorealistic apparatus sprites on the canvas.
 * The physics engine calculates positions/rotations, and this renderer
 * draws preloaded PNG images at the correct canvas coordinates instead
 * of geometric shapes.
 *
 * Architecture:
 *   Physics Engine → SpriteRenderer → positions photorealistic PNGs
 *                                   → draws physics overlays (arcs, labels) on top
 */

export interface SpriteConfig {
  id: string;
  src: string;
  /** Width in world units (meters). Height is auto from aspect ratio. */
  widthMeters: number;
  /** Optional fixed height. If omitted, aspect ratio is preserved. */
  heightMeters?: number;
  /** Anchor point [0-1, 0-1]. Default [0.5, 0.5] = center. */
  anchor?: { x: number; y: number };
}

interface LoadedSprite {
  id: string;
  image: HTMLImageElement;
  widthMeters: number;
  heightMeters: number;
  anchor: { x: number; y: number };
  loaded: boolean;
}

export class SpriteRenderer {
  private sprites: Map<string, LoadedSprite> = new Map();
  private loadPromises: Promise<void>[] = [];
  private onSpriteLoaded?: () => void;

  setOnSpriteLoaded(callback: () => void): void {
    this.onSpriteLoaded = callback;
  }

  /**
   * Register and preload a sprite image.
   * Call this during kit setup(), before the first render.
   */
  loadSprite(config: SpriteConfig): void {
    const img = new Image();
    if (typeof window !== 'undefined' && config.src.startsWith('http') && !config.src.startsWith(window.location.origin)) {
      img.crossOrigin = 'anonymous';
    }

    const sprite: LoadedSprite = {
      id: config.id,
      image: img,
      widthMeters: config.widthMeters,
      heightMeters: config.heightMeters ?? 0,
      anchor: config.anchor ?? { x: 0.5, y: 0.5 },
      loaded: false,
    };

    const promise = new Promise<void>((resolve) => {
      img.onload = () => {
        // Compute height from aspect ratio if not specified
        if (!config.heightMeters) {
          const aspectRatio = img.naturalHeight / img.naturalWidth;
          sprite.heightMeters = config.widthMeters * aspectRatio;
        }
        sprite.loaded = true;
        if (this.onSpriteLoaded) {
          this.onSpriteLoaded();
        }
        resolve();
      };
      img.onerror = () => {
        console.warn(`[SpriteRenderer] Failed to load sprite: ${config.src}`);
        resolve(); // Don't block other loads
      };
    });

    this.loadPromises.push(promise);
    img.src = config.src;
    this.sprites.set(config.id, sprite);
  }

  /** Wait for all sprites to finish loading. */
  async waitForLoad(): Promise<void> {
    await Promise.all(this.loadPromises);
  }

  /** Check if a specific sprite is loaded and ready. */
  isLoaded(id: string): boolean {
    return this.sprites.get(id)?.loaded ?? false;
  }

  /**
   * Draw a sprite on the canvas at a world-space position.
   *
   * @param ctx        Canvas 2D context
   * @param id         Sprite ID (registered via loadSprite)
   * @param canvasX    Canvas pixel X position
   * @param canvasY    Canvas pixel Y position
   * @param ppm        Pixels per meter (world scale)
   * @param rotation   Rotation in radians (default 0)
   * @param scale      Additional scale multiplier (default 1)
   * @param opacity    Draw opacity (default 1)
   */
  drawSprite(
    ctx: CanvasRenderingContext2D,
    id: string,
    canvasX: number,
    canvasY: number,
    ppm: number,
    rotation: number = 0,
    scale: number = 1,
    opacity: number = 1
  ): void {
    const sprite = this.sprites.get(id);
    if (!sprite || !sprite.loaded) return;

    const w = sprite.widthMeters * ppm * scale;
    const h = sprite.heightMeters * ppm * scale;
    const ax = sprite.anchor.x;
    const ay = sprite.anchor.y;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(canvasX, canvasY);

    if (rotation !== 0) {
      ctx.rotate(rotation);
    }

    // Draw image centered on anchor point
    ctx.drawImage(
      sprite.image,
      -w * ax,
      -h * ay,
      w,
      h
    );

    ctx.restore();
  }

  /**
   * Draw a sprite with a warm drop shadow for depth on the bench.
   */
  drawSpriteWithShadow(
    ctx: CanvasRenderingContext2D,
    id: string,
    canvasX: number,
    canvasY: number,
    ppm: number,
    rotation: number = 0,
    scale: number = 1,
    shadowOffset: number = 4
  ): void {
    // Draw with warm shadow matching bench lighting
    ctx.save();
    ctx.shadowColor = 'rgba(20, 10, 0, 0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = shadowOffset * 0.6;
    ctx.shadowOffsetY = shadowOffset;
    this.drawSprite(ctx, id, canvasX, canvasY, ppm, rotation, scale);
    ctx.restore();
  }

  /** Get sprite metadata (for positioning calculations). */
  getSpriteSize(id: string): { widthMeters: number; heightMeters: number } | null {
    const sprite = this.sprites.get(id);
    if (!sprite) return null;
    return { widthMeters: sprite.widthMeters, heightMeters: sprite.heightMeters };
  }
}
