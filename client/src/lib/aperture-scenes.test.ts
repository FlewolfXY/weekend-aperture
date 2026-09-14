import { describe, expect, it } from "vitest";
import {
  filmGeometry,
  openingCamera,
  shotFor,
  sourceCrop,
  weekdayLeak,
} from "./aperture-scenes";
import { mod, seasonState, timeResistance } from "./aperture-world";

describe("aperture composition", () => {
  it("preserves geometry and stays inside the world at every viewing distance", () => {
    for (const [width, height] of [
      [1363, 936],
      [390, 844],
      [375, 667],
      [844, 390],
    ]) {
      const geometry = filmGeometry(width, height);
      expect(geometry.innerTop + geometry.innerHeight).toBeLessThan(height);
      for (let week = 0; week < 52; week++) {
        for (const opening of [0, 0.2, 0.5, 1]) {
          const shot = openingCamera(shotFor(week), opening);
          const crop = sourceCrop(1440, 1080, width, height, shot);
          expect(crop.width / crop.height).toBeCloseTo(width / height, 8);
          expect(crop.x).toBeGreaterThanOrEqual(0);
          expect(crop.y).toBeGreaterThanOrEqual(0);
          expect(crop.x + crop.width).toBeLessThanOrEqual(1440.00001);
          expect(crop.y + crop.height).toBeLessThanOrEqual(1080.00001);
        }
      }
    }
  });

  it("never exposes weekends from two different weeks at once", () => {
    for (const width of [375, 700, 1363, 2560]) {
      const { frameWidth } = filmGeometry(width, 844);
      for (let phase = 0; phase < 14; phase += 0.025) {
        const weeks = new Set<number>();
        for (let day = -7; day < 22; day++) {
          const x = width / 2 + (day - phase) * frameWidth;
          if (
            mod(day, 7) >= 5 &&
            x + frameWidth * 0.945 > 0 &&
            x + frameWidth * 0.055 < width
          )
            weeks.add(Math.floor(day / 7));
        }
        expect(weeks.size).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps each week's identity when rewound, and gives Sunday a different composition", () => {
    const kinds = new Set<string>();
    for (let week = 0; week < 52; week++) {
      const saturday = shotFor(week, 5),
        sunday = shotFor(week, 6);
      kinds.add(saturday.kind);
      expect(shotFor(week + 52)).toEqual(saturday);
      expect(shotFor(week - 52)).toEqual(saturday);
      expect(sunday.kind).toBe(saturday.kind);
      expect(sunday.x).not.toBe(saturday.x);
      expect(sunday.height).not.toBe(saturday.height);
    }
    expect(kinds.size).toBe(7);
  });

  it("keeps distant trips rare and rain-lit rooms part of the year", () => {
    const year = Array.from({ length: 52 }, (_, week) => shotFor(week));
    expect(year.filter(s => s.wide).length).toBeGreaterThan(0);
    expect(year.filter(s => s.wide).length).toBeLessThan(8);
    expect(year.some(s => s.rain && s.kind === "glass")).toBe(true);
  });

  it("lets some weekdays leak light without a pointer, while others remain opaque", () => {
    const peaks = Array.from({ length: 35 }, (_, day) =>
      Math.max(...Array.from({ length: 80 }, (_, t) => weekdayLeak(day, t)))
    );
    expect(peaks.some(x => x > 0.4)).toBe(true);
    expect(peaks.some(x => x === 0)).toBe(true);
    expect(peaks.every(x => x >= 0 && x < 1)).toBe(true);
  });

  it("changes leaf density continuously and slows down around seasonal and festival crossings", () => {
    for (let week = 0; week < 52; week += 0.05) {
      expect(
        Math.abs(seasonState(week).foliage - seasonState(week + 0.001).foliage)
      ).toBeLessThan(0.002);
    }
    expect(timeResistance(4.45)).toBeLessThan(timeResistance(17));
    expect(timeResistance(21.5)).toBeLessThan(timeResistance(17));
  });
});
