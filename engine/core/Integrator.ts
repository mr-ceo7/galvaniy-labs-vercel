/**
 * GalvaniyPhysics - Numerical Integrators
 *
 * Provides Verlet and RK4 integration methods for advancing physics state.
 * Verlet is the default (energy-conserving, stable for constraints).
 * RK4 is available for high-precision simulations.
 */

import { Vector2 } from './Vector2.ts';
import { Body } from './Body.ts';
import type { IntegrationMethod } from './types.ts';

/**
 * Advance a body's state by one timestep using the specified integration method.
 */
export function integrate(
  body: Body,
  dt: number,
  gravity: Vector2,
  method: IntegrationMethod = 'verlet'
): void {
  if (body.isStatic) return;

  switch (method) {
    case 'verlet':
      integrateVerlet(body, dt, gravity);
      break;
    case 'rk4':
      integrateRK4(body, dt, gravity);
      break;
  }
}

/**
 * Velocity Verlet integration.
 * 
 * Excellent energy conservation, ideal for oscillatory systems (pendulums, springs).
 * Steps:
 *   1. x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt²
 *   2. Compute a(t+dt) from new position
 *   3. v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
 */
function integrateVerlet(body: Body, dt: number, gravity: Vector2): void {
  // Apply gravity to force accumulator
  body.applyForce(gravity.mul(body.mass));

  // Compute current acceleration
  body.updateAcceleration();
  const currentAccel = body.acceleration.clone();

  // Update position: x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt²
  const positionDelta = body.velocity.mul(dt).add(currentAccel.mul(0.5 * dt * dt));
  body.previousPosition = body.position.clone();
  body.position = body.position.add(positionDelta);

  // Clear forces and recompute with new position (gravity remains the same)
  body.clearForces();
  body.applyForce(gravity.mul(body.mass));
  body.updateAcceleration();
  const newAccel = body.acceleration;

  // Update velocity: v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
  body.velocity = body.velocity.add(
    currentAccel.add(newAccel).mul(0.5 * dt)
  );

  // Apply damping
  if (body.damping > 0) {
    body.velocity = body.velocity.mul(1 - body.damping);
  }

  // Clear forces for next step
  body.clearForces();

  // Angular velocity (simple Euler for rotation)
  body.angle += body.angularVelocity * dt;
}

/**
 * 4th-order Runge-Kutta integration.
 *
 * Higher precision than Verlet, useful for non-conservative systems
 * (e.g., circuits with exponential decay). More expensive per step.
 */
function integrateRK4(body: Body, dt: number, gravity: Vector2): void {
  // Apply gravity
  body.applyForce(gravity.mul(body.mass));
  body.updateAcceleration();

  // State: [x, y, vx, vy]
  const state = {
    x: body.position.x,
    y: body.position.y,
    vx: body.velocity.x,
    vy: body.velocity.y,
  };

  const accel = body.acceleration;

  // Derivative function: returns [vx, vy, ax, ay]
  const deriv = (_s: typeof state) => ({
    dx: _s.vx,
    dy: _s.vy,
    dvx: accel.x,
    dvy: accel.y,
  });

  // k1
  const k1 = deriv(state);

  // k2 (midpoint)
  const s2 = {
    x: state.x + k1.dx * dt * 0.5,
    y: state.y + k1.dy * dt * 0.5,
    vx: state.vx + k1.dvx * dt * 0.5,
    vy: state.vy + k1.dvy * dt * 0.5,
  };
  const k2 = deriv(s2);

  // k3 (midpoint)
  const s3 = {
    x: state.x + k2.dx * dt * 0.5,
    y: state.y + k2.dy * dt * 0.5,
    vx: state.vx + k2.dvx * dt * 0.5,
    vy: state.vy + k2.dvy * dt * 0.5,
  };
  const k3 = deriv(s3);

  // k4 (endpoint)
  const s4 = {
    x: state.x + k3.dx * dt,
    y: state.y + k3.dy * dt,
    vx: state.vx + k3.dvx * dt,
    vy: state.vy + k3.dvy * dt,
  };
  const k4 = deriv(s4);

  // Weighted average
  body.previousPosition = body.position.clone();
  body.position = new Vector2(
    state.x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
    state.y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy)
  );

  body.velocity = new Vector2(
    state.vx + (dt / 6) * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx),
    state.vy + (dt / 6) * (k1.dvy + 2 * k2.dvy + 2 * k3.dvy + k4.dvy)
  );

  // Apply damping
  if (body.damping > 0) {
    body.velocity = body.velocity.mul(1 - body.damping);
  }

  // Clear forces for next step
  body.clearForces();

  // Angular velocity
  body.angle += body.angularVelocity * dt;
}
