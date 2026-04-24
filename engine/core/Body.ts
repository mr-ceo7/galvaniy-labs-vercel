/**
 * GalvaniyPhysics - Rigid Body
 *
 * Represents a physics body in the simulation. Bodies can be circles, rectangles,
 * or particles. Supports both dynamic (moving) and static (fixed) bodies.
 *
 * Position/velocity are stored in meters; rendering converts via pixelsPerMeter.
 */

import { Vector2 } from './Vector2.ts';
import type { BodyConfig, ShapeType } from './types.ts';

let bodyIdCounter = 0;

export class Body {
  readonly id: string;
  readonly shape: ShapeType;
  readonly isStatic: boolean;
  readonly label: string;

  // Geometry
  readonly radius: number;
  readonly width: number;
  readonly height: number;

  // Physical properties
  mass: number;
  inverseMass: number;
  restitution: number;
  friction: number;
  damping: number;

  // State - mutable for simulation stepping
  position: Vector2;
  previousPosition: Vector2;  // for Verlet integration
  velocity: Vector2;
  acceleration: Vector2;
  angle: number;
  angularVelocity: number;

  // Force accumulator (reset each step)
  private forceAccumulator: Vector2;

  constructor(config: BodyConfig) {
    this.id = config.id ?? `body_${bodyIdCounter++}`;
    this.shape = config.shape;
    this.isStatic = config.isStatic ?? false;
    this.label = config.label ?? this.id;

    // Geometry
    this.radius = config.radius ?? 0;
    this.width = config.width ?? 0;
    this.height = config.height ?? 0;

    // Physics
    this.mass = config.mass ?? 1;
    this.inverseMass = this.isStatic ? 0 : 1 / this.mass;
    this.restitution = config.restitution ?? 0.5;
    this.friction = config.friction ?? 0.3;
    this.damping = config.damping ?? 0;

    // State
    this.position = config.position.clone();
    this.previousPosition = config.position.clone();
    this.velocity = config.velocity?.clone() ?? Vector2.zero();
    this.acceleration = Vector2.zero();
    this.angle = config.angle ?? 0;
    this.angularVelocity = config.angularVelocity ?? 0;

    this.forceAccumulator = Vector2.zero();
  }

  /** Apply a force (in Newtons) to this body. Forces accumulate until clearForces(). */
  applyForce(force: Vector2): void {
    if (this.isStatic) return;
    this.forceAccumulator = this.forceAccumulator.add(force);
  }

  /** Apply an impulse (instant velocity change). */
  applyImpulse(impulse: Vector2): void {
    if (this.isStatic) return;
    this.velocity = this.velocity.add(impulse.mul(this.inverseMass));
  }

  /** Get net force on this body. */
  getNetForce(): Vector2 {
    return this.forceAccumulator;
  }

  /** Reset accumulated forces (called after each integration step). */
  clearForces(): void {
    this.forceAccumulator = Vector2.zero();
  }

  /** Update acceleration from accumulated forces: a = F/m. */
  updateAcceleration(): void {
    if (this.isStatic) {
      this.acceleration = Vector2.zero();
      return;
    }
    this.acceleration = this.forceAccumulator.mul(this.inverseMass);
  }

  /** Get kinetic energy: 0.5 * m * v². */
  getKineticEnergy(): number {
    return 0.5 * this.mass * this.velocity.magnitudeSquared;
  }

  /** Get momentum: m * v. */
  getMomentum(): Vector2 {
    return this.velocity.mul(this.mass);
  }

  /** Set position and sync previous position (teleport without velocity). */
  setPosition(pos: Vector2): void {
    this.position = pos.clone();
    this.previousPosition = pos.clone();
    this.velocity = Vector2.zero();
  }

  /** Check if a point (in world coordinates) is inside this body. */
  containsPoint(point: Vector2): boolean {
    if (this.shape === 'circle' || this.shape === 'particle') {
      return point.distanceToSquared(this.position) <= this.radius * this.radius;
    }
    if (this.shape === 'rect') {
      // Simple AABB check (ignoring rotation for now)
      const halfW = this.width / 2;
      const halfH = this.height / 2;
      return (
        point.x >= this.position.x - halfW &&
        point.x <= this.position.x + halfW &&
        point.y >= this.position.y - halfH &&
        point.y <= this.position.y + halfH
      );
    }
    return false;
  }

  /** Create a deep clone of this body. */
  clone(): Body {
    const b = new Body({
      id: this.id + '_clone',
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      mass: this.mass,
      restitution: this.restitution,
      friction: this.friction,
      isStatic: this.isStatic,
      shape: this.shape,
      radius: this.radius,
      width: this.width,
      height: this.height,
      angle: this.angle,
      angularVelocity: this.angularVelocity,
      damping: this.damping,
      label: this.label,
    });
    b.previousPosition = this.previousPosition.clone();
    return b;
  }
}
