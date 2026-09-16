import { describe, expect, it } from "vitest";
import {
  advanceTime,
  canOpenAutomatically,
  portalAnchor,
  velocityFromDrag,
  weekendPace,
} from "./aperture-time";
import {
  filmGeometry,
  openingCamera,
  responsiveCamera,
  shotFor,
  sourceCrop,
} from "./aperture-scenes";

describe("attention and calendar continuity", () => {
  it("preserves elapsed calendar time at 10, 30 and 60 fps, including year wrap and festivals", () => {
    const run = (start: number, fps: number) => {
      let w = start;
      for (let i = 0; i < fps * 30; i++) w = advanceTime(w, 1 / fps, 1.2);
      return w;
    };
    for (const start of [3.8, 8.1, 16.8, 50.4]) {
      expect(run(start, 10)).toBeCloseTo(run(start, 60), 2);
      expect(run(start, 30)).toBeCloseTo(run(start, 60), 2);
    }
  });
  it("never takes over paused, dragged, sought or reduced-motion viewing", () => {
    expect(canOpenAutomatically(false, false, false, false, 9)).toBe(true);
    for (let i = 0; i < 4; i++) {
      const gates = [false, false, false, false];
      gates[i] = true;
      expect(
        canOpenAutomatically(gates[0], gates[1], gates[2], gates[3], 20)
      ).toBe(false);
    }
    expect(canOpenAutomatically(false, false, false, false, 4)).toBe(false);
  });
  it("returns into the moving original aperture or fades when it has left, including the year seam", () => {
    expect(portalAnchor(6, 6 / 7, 1000, 200)).toBeCloseTo(500);
    expect(portalAnchor(6, 6 / 7 + 0.1, 1000, 200)).toBeCloseTo(360);
    expect(portalAnchor(6, 3, 1000, 200)).toBeNull();
    expect(portalAnchor(363, 0.01, 1000, 200)).toBeCloseTo(286);
  });
  it("keeps the same throw when pointer event frequency changes", () => {
    expect(velocityFromDrag(8, 280, 16)).toBeCloseTo(
      velocityFromDrag(16, 280, 32),
      8
    );
  });
  it("gives weekends breathing room without stopping ordinary time", () => {
    expect(weekendPace(17 + 5.7 / 7)).toBeLessThan(0.5);
    expect(weekendPace(17 + 2 / 7)).toBe(1);
    expect(advanceTime(17, 1, 1.2)).toBeGreaterThan(17);
  });
});

describe("subjects survive portrait composition", () => {
  it("keeps the warm lamp in both rainy weekend apertures on desktop and phones", () => {
    for (const [width, height] of [
      [1363, 936],
      [390, 844],
      [375, 667],
      [844, 390],
    ])
      for (const day of [5, 6]) {
        const g = filmGeometry(width, height),
          w = g.frameWidth * 0.89,
          h = g.innerHeight;
        const camera = responsiveCamera(shotFor(9, day), w / h),
          crop = sourceCrop(1440, 1080, w, h, camera);
        expect(crop.x).toBeLessThan(489);
        expect(crop.x + crop.width).toBeGreaterThan(489);
        expect(crop.y).toBeLessThan(574);
        expect(crop.y + crop.height).toBeGreaterThan(574);
      }
  });
  it("a close visit stays with its subject while a distant visit opens out", () => {
    const cup = shotFor(4),
      rain = shotFor(9),
      distant = shotFor(16);
    expect(openingCamera(cup, 1).x).toBe(cup.x);
    expect(openingCamera(rain, 1).x).toBe(rain.x);
    expect(openingCamera(distant, 1).height).toBe(1);
    expect(openingCamera(cup, 1).height).toBeLessThan(0.5);
  });
});
