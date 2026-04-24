/**
 * GalvaniyPhysics - Constraints
 *
 * Constraints connect bodies together or to world anchors.
 * Supports pin joints (fixed point), distance (rigid rod),
 * spring (Hooke's law), and slider (linear axis) constraints.
 */

import { Vector2 } from './Vector2.ts';
import { Body } from './Body.ts';
import type { ConstraintConfig, ConstraintType } from './types.ts';

let constraintIdCounter = 0;

export class Constraint {
  readonly id: string;
  readonly type: ConstraintType;
  readonly label: string;

  bodyA: Body | null = null;
  bodyB: Body | null = null;

  /** Body-local attachment offsets. */
  pointA: Vector2;
  pointB: Vector2;

  /** Rest length for distance/spring constraints. */
  length: number;

  /** Stiffness: 1 = rigid, <1 = springy. */
  stiffness: number;

  /** Damping factor for spring constraints. */
  damping: number;

  // Internal IDs for deferred body resolution
  readonly bodyAId: string;
  readonly bodyBId: string | undefined;

  constructor(config: ConstraintConfig) {
    this.id = config.id ?? `constraint_${constraintIdCounter++}`;
    this.type = config.type;
    this.label = config.label ?? this.id;

    this.bodyAId = config.bodyA;
    this.bodyBId = config.bodyB;

    this.pointA = config.pointA ?? Vector2.zero();
    this.pointB = config.pointB ?? Vector2.zero();

    this.length = config.length ?? 0;
    this.stiffness = config.stiffness ?? 1;
    this.damping = config.damping ?? 0;
  }

  /** Resolve body references from a body map. Called by World during setup. */
  resolveReferences(bodies: Map<string, Body>): void {
    const a = bodies.get(this.bodyAId);
    if (!a) {
      console.warn(`Constraint ${this.id}: body A '${this.bodyAId}' not found`);
      return;
    }
    this.bodyA = a;

    if (this.bodyBId) {
      const b = bodies.get(this.bodyBId);
      if (!b) {
        console.warn(`Constraint ${this.id}: body B '${this.bodyBId}' not found`);
      }
      this.bodyB = b ?? null;
    }

    // If length was not specified, calculate from initial positions
    if (this.length === 0) {
      const worldA = this.getWorldPointA();
      const worldB = this.getWorldPointB();
      this.length = worldA.distanceTo(worldB);
    }
  }

  /** Get attachment point A in world coordinates. */
  getWorldPointA(): Vector2 {
    if (this.bodyA) {
      return this.bodyA.position.add(this.pointA.rotate(this.bodyA.angle));
    }
    return this.pointA;
  }

  /** Get attachment point B in world coordinates. */
  getWorldPointB(): Vector2 {
    if (this.bodyB) {
      return this.bodyB.position.add(this.pointB.rotate(this.bodyB.angle));
    }
    return this.pointB;
  }

  /**
   * Apply constraint forces to connected bodies.
   * Called during each simulation step.
   */
  solve(dt: number): void {
    if (!this.bodyA) return;

    switch (this.type) {
      case 'pin':
        this.solvePin();
        break;
      case 'distance':
        this.solveDistance(dt);
        break;
      case 'spring':
        this.solveSpring(dt);
        break;
      case 'slider':
        // Slider constraints restrict motion to an axis - simplified for now
        break;
    }
  }

  /** Pin constraint: body A is fixed to a world point or body B. */
  private solvePin(): void {
    if (!this.bodyA) return;

    if (!this.bodyB) {
      // Pin to world point
      if (!this.bodyA.isStatic) {
        this.bodyA.position = this.pointB.clone();
        this.bodyA.velocity = Vector2.zero();
      }
    } else {
      // Pin two bodies together
      const target = this.bodyB.position.add(this.pointB.rotate(this.bodyB.angle));
      if (!this.bodyA.isStatic) {
        this.bodyA.position = target.sub(this.pointA.rotate(this.bodyA.angle));
      }
    }
  }

  /** Distance constraint: maintain fixed length between points. */
  private solveDistance(_dt: number): void {
    if (!this.bodyA) return;

    const worldA = this.getWorldPointA();
    const worldB = this.getWorldPointB();
    const delta = worldB.sub(worldA);
    const currentLength = delta.magnitude;

    if (currentLength === 0) return;

    const error = (currentLength - this.length) / currentLength;
    const correction = delta.mul(error * this.stiffness * 0.5);

    if (!this.bodyA.isStatic) {
      this.bodyA.position = this.bodyA.position.add(correction);
    }
    if (this.bodyB && !this.bodyB.isStatic) {
      this.bodyB.position = this.bodyB.position.sub(correction);
    }
  }

  /** Spring constraint: Hooke's law F = -kx with damping. */
  private solveSpring(dt: number): void {
    if (!this.bodyA) return;

    const worldA = this.getWorldPointA();
    const worldB = this.getWorldPointB();
    const delta = worldB.sub(worldA);
    const currentLength = delta.magnitude;

    if (currentLength === 0) return;

    const direction = delta.div(currentLength);
    const extension = currentLength - this.length;

    // Hooke's law: F = -kx
    const springForce = direction.mul(this.stiffness * extension);

    // Damping force: F_d = -c * v_relative
    let dampingForce = Vector2.zero();
    if (this.damping > 0) {
      const relativeVelocity = (this.bodyB?.velocity ?? Vector2.zero()).sub(
        this.bodyA.velocity
      );
      dampingForce = direction.mul(relativeVelocity.dot(direction) * this.damping);
    }

    const totalForce = springForce.add(dampingForce);

    if (!this.bodyA.isStatic) {
      this.bodyA.applyForce(totalForce);
    }
    if (this.bodyB && !this.bodyB.isStatic) {
      this.bodyB.applyForce(totalForce.negate());
    }
  }

  /** Get the current tension/force in this constraint (for measurement). */
  getTension(): number {
    const worldA = this.getWorldPointA();
    const worldB = this.getWorldPointB();
    const currentLength = worldA.distanceTo(worldB);
    const extension = currentLength - this.length;
    return Math.abs(this.stiffness * extension);
  }

  /** Get the current extension/compression. */
  getExtension(): number {
    const worldA = this.getWorldPointA();
    const worldB = this.getWorldPointB();
    return worldA.distanceTo(worldB) - this.length;
  }
}
