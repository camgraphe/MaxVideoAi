export const ANGLE_ORBIT_VIEW_IDS = ['front', 'threeQuarter', 'profile', 'elevated'] as const;
export type AngleOrbitViewId = (typeof ANGLE_ORBIT_VIEW_IDS)[number];

export function advanceOrbitView(current: AngleOrbitViewId, direction: 'next' | 'previous'): AngleOrbitViewId {
  const index = ANGLE_ORBIT_VIEW_IDS.indexOf(current);
  const offset = direction === 'next' ? 1 : -1;
  return ANGLE_ORBIT_VIEW_IDS[(index + offset + ANGLE_ORBIT_VIEW_IDS.length) % ANGLE_ORBIT_VIEW_IDS.length];
}

export function selectOrbitViewFromDrag(start: AngleOrbitViewId, deltaX: number, threshold = 64): AngleOrbitViewId {
  if (Math.abs(deltaX) < threshold) return start;
  return advanceOrbitView(start, deltaX > 0 ? 'next' : 'previous');
}

export function resolveAvailableOrbitView(target: AngleOrbitViewId, failed: ReadonlySet<AngleOrbitViewId>): AngleOrbitViewId {
  if (!failed.has(target)) return target;
  let candidate = target;
  for (let step = 0; step < ANGLE_ORBIT_VIEW_IDS.length; step += 1) {
    candidate = advanceOrbitView(candidate, 'previous');
    if (!failed.has(candidate)) return candidate;
  }
  return 'threeQuarter';
}
