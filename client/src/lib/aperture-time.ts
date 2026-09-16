import { clamp, mod, smooth, timeResistance } from "./aperture-world";

export function weekendPace(week: number) {
  const day = mod(week * 7, 7);
  // Ease into Friday evening and out of Sunday instead of changing gears abruptly.
  return (
    1 - 0.58 * smooth((day - 4.65) / 0.8) * (1 - smooth((day - 6.75) / 0.25))
  );
}
export function advanceTime(
  week: number,
  seconds: number,
  speed: number,
  attention = 1
) {
  let remaining = Math.max(0, seconds),
    position = week;
  // Integrate in short steps so a slow renderer does not slow down the calendar.
  while (remaining > 1e-7) {
    const dt = Math.min(0.025, remaining);
    position = mod(
      position +
        dt *
          0.2 *
          speed *
          timeResistance(position) *
          weekendPace(position) *
          attention,
      52
    );
    remaining -= dt;
  }
  return position;
}
export function canOpenAutomatically(
  paused: boolean,
  dragging: boolean,
  seeking: boolean,
  reduced: boolean,
  idleSeconds: number
) {
  return !paused && !dragging && !seeking && !reduced && idleSeconds > 8;
}
export function portalAnchor(
  day: number,
  week: number,
  width: number,
  frameWidth: number
) {
  const delta = mod(day - week * 7 + 182, 364) - 182;
  const x = width * 0.5 + delta * frameWidth;
  return x + frameWidth > 0 && x < width ? x : null;
}
export function velocityFromDrag(
  dx: number,
  frameWidth: number,
  elapsedMs: number
) {
  return clamp(
    (-dx / frameWidth / 7 / Math.max(0.008, elapsedMs / 1000)) * 0.24,
    -0.7,
    0.7
  );
}
