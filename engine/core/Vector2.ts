/**
 * GalvaniyPhysics — 2D Vector Math
 * 
 * Lightweight, immutable-style vector class optimized for physics calculations.
 * Methods return new vectors to prevent mutation bugs in simulations.
 */

export class Vector2 {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}

  // --- Factory methods ---

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static one(): Vector2 {
    return new Vector2(1, 1);
  }

  static up(): Vector2 {
    return new Vector2(0, -1);
  }

  static down(): Vector2 {
    return new Vector2(0, 1);
  }

  static left(): Vector2 {
    return new Vector2(-1, 0);
  }

  static right(): Vector2 {
    return new Vector2(1, 0);
  }

  static fromAngle(angle: number, magnitude: number = 1): Vector2 {
    return new Vector2(
      Math.cos(angle) * magnitude,
      Math.sin(angle) * magnitude
    );
  }

  static fromArray(arr: [number, number]): Vector2 {
    return new Vector2(arr[0], arr[1]);
  }

  // --- Arithmetic ---

  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  sub(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  mul(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  div(scalar: number): Vector2 {
    if (scalar === 0) return Vector2.zero();
    return new Vector2(this.x / scalar, this.y / scalar);
  }

  negate(): Vector2 {
    return new Vector2(-this.x, -this.y);
  }

  // --- Properties ---

  get magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  get magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  get angle(): number {
    return Math.atan2(this.y, this.x);
  }

  // --- Operations ---

  normalize(): Vector2 {
    const mag = this.magnitude;
    if (mag === 0) return Vector2.zero();
    return this.div(mag);
  }

  clampMagnitude(maxMag: number): Vector2 {
    if (this.magnitudeSquared > maxMag * maxMag) {
      return this.normalize().mul(maxMag);
    }
    return this;
  }

  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  /** 2D cross product — returns scalar (z-component of 3D cross). */
  cross(other: Vector2): number {
    return this.x * other.y - this.y * other.x;
  }

  /** Perpendicular vector (rotated 90° counter-clockwise). */
  perp(): Vector2 {
    return new Vector2(-this.y, this.x);
  }

  /** Rotate by angle in radians. */
  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  /** Distance to another vector. */
  distanceTo(other: Vector2): number {
    return this.sub(other).magnitude;
  }

  /** Distance squared (avoids sqrt for comparisons). */
  distanceToSquared(other: Vector2): number {
    return this.sub(other).magnitudeSquared;
  }

  /** Linear interpolation. */
  lerp(other: Vector2, t: number): Vector2 {
    return new Vector2(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t
    );
  }

  /** Reflect off a surface with the given normal. */
  reflect(normal: Vector2): Vector2 {
    const d = 2 * this.dot(normal);
    return this.sub(normal.mul(d));
  }

  /** Component-wise absolute value. */
  abs(): Vector2 {
    return new Vector2(Math.abs(this.x), Math.abs(this.y));
  }

  /** Check approximate equality. */
  equals(other: Vector2, epsilon: number = 1e-6): boolean {
    return (
      Math.abs(this.x - other.x) < epsilon &&
      Math.abs(this.y - other.y) < epsilon
    );
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }

  toString(): string {
    return `(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }
}
