import type { Vec2 } from '../types';

const DISTANCE_EPSILON = 1e-12;

export function isWithinRadius(origin: Vec2, point: Vec2, radius: number): boolean {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return dx * dx + dy * dy <= radius * radius + DISTANCE_EPSILON;
}
