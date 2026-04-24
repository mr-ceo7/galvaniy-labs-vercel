/**
 * GalvaniyPhysics — Canvas2D Renderer
 *
 * Renders physics worlds and apparatus to an HTML5 Canvas.
 * Optimized for mobile performance. Uses the Galvaniy dark theme.
 */

import { Vector2 } from '../core/Vector2.ts';
import { World } from '../core/World.ts';
import { Body } from '../core/Body.ts';
import { Constraint } from '../core/Constraint.ts';
import type { RenderTheme, DrawableComponent } from '../core/types.ts';

/** Default Galvaniy dark theme. */
export const GALVANIY_THEME: RenderTheme = {
  background: '#0f172a',
  bodyFill: '#3b82f6',
  bodyStroke: '#60a5fa',
  constraintColor: '#94a3b8',
  labelColor: '#e2e8f0',
  gridColor: 'rgba(255, 255, 255, 0.05)',
  accentColor: '#a855f7',
  highlightColor: '#22d3ee',
  instrumentPanel: 'rgba(30, 41, 59, 0.8)',
  fontSize: 12,
  fontFamily: 'Inter, system-ui, sans-serif',
};

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: World | null = null;
  private theme: RenderTheme;
  private drawables: DrawableComponent[] = [];

  // Custom draw function called after default rendering
  private customDrawFn: ((ctx: CanvasRenderingContext2D, renderer: CanvasRenderer) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    theme?: Partial<RenderTheme>
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
    this.theme = { ...GALVANIY_THEME, ...theme };
  }

  /** Bind this renderer to a physics world. */
  setWorld(world: World): void {
    this.world = world;
  }

  /** Rebind a new canvas element (e.g. after tab switch) while preserving state. */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
  }

  /** Set additional drawable components (apparatus-specific visuals). */
  setDrawables(drawables: DrawableComponent[]): void {
    this.drawables = drawables;
  }

  /** Set a custom draw function for apparatus-specific rendering. */
  setCustomDraw(fn: (ctx: CanvasRenderingContext2D, renderer: CanvasRenderer) => void): void {
    this.customDrawFn = fn;
  }

  /** Get the canvas context for custom drawing. */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /** Get the current theme. */
  getTheme(): RenderTheme {
    return this.theme;
  }

  /** Get canvas dimensions. */
  getSize(): { width: number; height: number } {
    return { width: this.canvas.width, height: this.canvas.height };
  }

  /** Resize the canvas to fit its container (handles DPI scaling). */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    // CSS size stays the same
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  /**
   * Render one frame.
   * Call this in the animation loop or after each physics step.
   */
  render(): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // Clear
    ctx.fillStyle = this.theme.background;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    this.drawGrid();

    if (this.world) {
      // Draw constraints (behind bodies)
      for (const constraint of this.world.getConstraints()) {
        this.drawConstraint(constraint);
      }

      // Draw bodies
      for (const body of this.world.getBodies()) {
        this.drawBody(body);
      }
    }

    // Draw additional components (apparatus-specific)
    for (const drawable of this.drawables) {
      this.drawComponent(drawable);
    }

    // Custom draw function
    if (this.customDrawFn) {
      ctx.save();
      this.customDrawFn(ctx, this);
      ctx.restore();
    }
  }

  /** Start a render loop bound to the physics world's animation. */
  startRenderLoop(): void {
    const loop = () => {
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ==================== Drawing Helpers ====================

  /** Convert world position (meters) to canvas pixels. */
  worldToCanvas(worldPos: Vector2): Vector2 {
    if (!this.world) return worldPos;
    return this.world.worldToPixel(worldPos);
  }

  /** Draw a subtle background grid. */
  private drawGrid(): void {
    if (!this.world) return;

    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const gridSpacing = this.world.pixelsPerMeter; // 1 meter grid

    ctx.strokeStyle = this.theme.gridColor;
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  /** Draw a physics body. */
  private drawBody(body: Body): void {
    const ctx = this.ctx;
    const pos = this.worldToCanvas(body.position);

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(body.angle);

    if (body.shape === 'circle' || body.shape === 'particle') {
      const r = body.radius * (this.world?.pixelsPerMeter ?? 100);

      // Glow effect
      const gradient = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.3);
      gradient.addColorStop(0, this.theme.bodyFill);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = this.theme.bodyFill;
      ctx.strokeStyle = this.theme.bodyStroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

    } else if (body.shape === 'rect') {
      const w = body.width * (this.world?.pixelsPerMeter ?? 100);
      const h = body.height * (this.world?.pixelsPerMeter ?? 100);

      ctx.fillStyle = body.isStatic ? '#475569' : this.theme.bodyFill;
      ctx.strokeStyle = this.theme.bodyStroke;
      ctx.lineWidth = 2;

      // Rounded rect
      this.roundRect(ctx, -w / 2, -h / 2, w, h, 4);
      ctx.fill();
      ctx.stroke();
    }

    // Label
    if (body.label && body.label !== body.id) {
      ctx.fillStyle = this.theme.labelColor;
      ctx.font = `${this.theme.fontSize}px ${this.theme.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const r = body.radius * (this.world?.pixelsPerMeter ?? 100);
      ctx.fillText(body.label, 0, r + 16);
    }

    ctx.restore();
  }

  /** Draw a constraint (line, spring visualization). */
  private drawConstraint(constraint: Constraint): void {
    const ctx = this.ctx;
    const worldA = this.worldToCanvas(constraint.getWorldPointA());
    const worldB = this.worldToCanvas(constraint.getWorldPointB());

    ctx.strokeStyle = this.theme.constraintColor;
    ctx.lineWidth = 2;

    if (constraint.type === 'spring') {
      // Draw spring zigzag
      this.drawSpring(worldA, worldB, 10, 8);
    } else {
      // Draw line for distance/pin
      ctx.beginPath();
      ctx.moveTo(worldA.x, worldA.y);
      ctx.lineTo(worldB.x, worldB.y);
      ctx.stroke();
    }

    // Draw pin circles at attachment points
    if (constraint.type === 'pin' || constraint.type === 'distance') {
      ctx.fillStyle = this.theme.accentColor;
      ctx.beginPath();
      ctx.arc(worldA.x, worldA.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(worldB.x, worldB.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Draw a spring zigzag between two points. */
  private drawSpring(
    start: Vector2,
    end: Vector2,
    coils: number,
    amplitude: number
  ): void {
    const ctx = this.ctx;
    const delta = end.sub(start);
    const length = delta.magnitude;
    const dir = delta.div(length);
    const perp = dir.perp();

    ctx.strokeStyle = this.theme.highlightColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);

    const segmentLength = length / (coils * 2);
    for (let i = 0; i < coils * 2; i++) {
      const t = (i + 1) / (coils * 2);
      const point = start.add(dir.mul(length * t));
      const offset = perp.mul(i % 2 === 0 ? amplitude : -amplitude);
      ctx.lineTo(point.x + offset.x, point.y + offset.y);
    }

    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  /** Draw a custom drawable component. */
  private drawComponent(comp: DrawableComponent): void {
    const ctx = this.ctx;
    const pos = this.worldToCanvas(comp.position);

    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (comp.angle) ctx.rotate(comp.angle);
    ctx.globalAlpha = comp.opacity ?? 1;

    switch (comp.type) {
      case 'label':
        ctx.fillStyle = comp.color ?? this.theme.labelColor;
        ctx.font = `${this.theme.fontSize}px ${this.theme.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(comp.label ?? '', 0, 0);
        break;

      case 'decoration':
        if (comp.color) {
          ctx.fillStyle = comp.color;
          if (comp.radius) {
            ctx.beginPath();
            ctx.arc(0, 0, comp.radius * (this.world?.pixelsPerMeter ?? 100), 0, Math.PI * 2);
            ctx.fill();
          } else if (comp.width && comp.height) {
            const w = comp.width * (this.world?.pixelsPerMeter ?? 100);
            const h = comp.height * (this.world?.pixelsPerMeter ?? 100);
            ctx.fillRect(-w / 2, -h / 2, w, h);
          }
        }
        break;

      case 'ray':
        if (comp.points && comp.points.length >= 2) {
          ctx.strokeStyle = comp.color ?? '#fbbf24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const firstPt = this.worldToCanvas(comp.points[0]).sub(pos);
          ctx.moveTo(firstPt.x, firstPt.y);
          for (let i = 1; i < comp.points.length; i++) {
            const pt = this.worldToCanvas(comp.points[i]).sub(pos);
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }
        break;
    }

    ctx.restore();
  }

  /** Helper to draw a rounded rectangle. */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * Draw text with the Galvaniy style.
   * Utility for apparatus kits to render labels, values, etc.
   */
  drawText(
    text: string,
    worldPos: Vector2,
    options?: {
      color?: string;
      fontSize?: number;
      align?: CanvasTextAlign;
      baseline?: CanvasTextBaseline;
      bold?: boolean;
    }
  ): void {
    const ctx = this.ctx;
    const pos = this.worldToCanvas(worldPos);
    const size = options?.fontSize ?? this.theme.fontSize;
    const weight = options?.bold ? 'bold' : 'normal';

    ctx.fillStyle = options?.color ?? this.theme.labelColor;
    ctx.font = `${weight} ${size}px ${this.theme.fontFamily}`;
    ctx.textAlign = options?.align ?? 'center';
    ctx.textBaseline = options?.baseline ?? 'middle';
    ctx.fillText(text, pos.x, pos.y);
  }

  /**
   * Draw a line between two world-space points.
   * Utility for apparatus kits.
   */
  drawLine(
    from: Vector2,
    to: Vector2,
    options?: { color?: string; width?: number; dashed?: boolean }
  ): void {
    const ctx = this.ctx;
    const a = this.worldToCanvas(from);
    const b = this.worldToCanvas(to);

    ctx.strokeStyle = options?.color ?? this.theme.constraintColor;
    ctx.lineWidth = options?.width ?? 2;
    if (options?.dashed) ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    if (options?.dashed) ctx.setLineDash([]);
  }

  /**
   * Draw a filled circle at a world-space position.
   * Utility for apparatus kits.
   */
  drawCircle(
    center: Vector2,
    radiusMeters: number,
    options?: { fill?: string; stroke?: string; lineWidth?: number }
  ): void {
    const ctx = this.ctx;
    const pos = this.worldToCanvas(center);
    const r = radiusMeters * (this.world?.pixelsPerMeter ?? 100);

    if (options?.fill) {
      ctx.fillStyle = options.fill;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (options?.stroke) {
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = options?.lineWidth ?? 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /**
   * Draw an arc (for protractor, angles).
   * Utility for apparatus kits.
   */
  drawArc(
    center: Vector2,
    radiusMeters: number,
    startAngle: number,
    endAngle: number,
    options?: { color?: string; width?: number; fill?: string }
  ): void {
    const ctx = this.ctx;
    const pos = this.worldToCanvas(center);
    const r = radiusMeters * (this.world?.pixelsPerMeter ?? 100);

    if (options?.fill) {
      ctx.fillStyle = options.fill;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.arc(pos.x, pos.y, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = options?.color ?? this.theme.accentColor;
    ctx.lineWidth = options?.width ?? 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, startAngle, endAngle);
    ctx.stroke();
  }
}
