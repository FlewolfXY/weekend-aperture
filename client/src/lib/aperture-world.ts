export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
export const SEASON_CN: Record<string, string> = {
  winter: "冬",
  spring: "春",
  summer: "夏",
  autumn: "秋",
};

export const FESTIVALS = [
  { week: 4, name: "春节", code: "SPRING FESTIVAL / 01" },
  { week: 13, name: "清明", code: "QINGMING / 04" },
  { week: 24, name: "夏至", code: "SOLSTICE / 06" },
  { week: 38, name: "中秋", code: "MID-AUTUMN / 09" },
  { week: 50, name: "冬至", code: "WINTER SOLSTICE / 12" },
];

const PALETTES = {
  winter: {
    top: "#07111d",
    bottom: "#52677b",
    horizon: "#c6b6ad",
    glow: "#ff6b35",
    leaf: "#b1d5d5",
    water: "#102c45",
  },
  spring: {
    top: "#082329",
    bottom: "#607b6c",
    horizon: "#edb5a6",
    glow: "#ffcf4a",
    leaf: "#aedb79",
    water: "#0f5960",
  },
  summer: {
    top: "#04282f",
    bottom: "#528d83",
    horizon: "#f1d7a3",
    glow: "#ff5d27",
    leaf: "#78c891",
    water: "#006e7a",
  },
  autumn: {
    top: "#161329",
    bottom: "#735c6a",
    horizon: "#df9d6c",
    glow: "#ff3d2e",
    leaf: "#eaa447",
    water: "#49304e",
  },
};

type Palette = (typeof PALETTES)[keyof typeof PALETTES];

export function mod(value: number, by: number) {
  return ((value % by) + by) % by;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string) {
  const value = parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function mixColor(a: string, b: string, t: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const p = clamp(t, 0, 1);
  return `rgb(${Math.round(x.r + (y.r - x.r) * p)}, ${Math.round(x.g + (y.g - x.g) * p)}, ${Math.round(x.b + (y.b - x.b) * p)})`;
}

export function alphaColor(color: string, alpha: number) {
  const values = color.startsWith("#")
    ? Object.values(hexToRgb(color))
    : (color.match(/[\d.]+/g) ?? ["255", "255", "255"]).slice(0, 3).map(Number);
  return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${clamp(alpha, 0, 1)})`;
}

function mixPalette(a: Palette, b: Palette, t: number): Palette {
  return {
    top: mixColor(a.top, b.top, t),
    bottom: mixColor(a.bottom, b.bottom, t),
    horizon: mixColor(a.horizon, b.horizon, t),
    glow: mixColor(a.glow, b.glow, t),
    leaf: mixColor(a.leaf, b.leaf, t),
    water: mixColor(a.water, b.water, t),
  };
}

export function smooth(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function seasonState(week: number): {
  key: keyof typeof PALETTES;
  palette: Palette;
  transition: number;
  foliage: number;
  winter: number;
  autumn: number;
} {
  const w = mod(week, 52);
  const stops: { at: number; key: keyof typeof PALETTES }[] = [
    { at: 0, key: "winter" },
    { at: 7, key: "winter" },
    { at: 10, key: "spring" },
    { at: 20, key: "spring" },
    { at: 23, key: "summer" },
    { at: 33, key: "summer" },
    { at: 36, key: "autumn" },
    { at: 45, key: "autumn" },
    { at: 48, key: "winter" },
    { at: 52, key: "winter" },
  ];
  let left = stops[0];
  let right = stops[1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (w >= stops[i].at && w <= stops[i + 1].at) {
      left = stops[i];
      right = stops[i + 1];
      break;
    }
  }
  const raw = (w - left.at) / Math.max(0.001, right.at - left.at);
  const transition = left.key === right.key ? 0 : smooth(raw);
  const palette = mixPalette(
    PALETTES[left.key],
    PALETTES[right.key],
    transition
  );
  const key = transition > 0.5 ? right.key : left.key;
  const density = { winter: 0.07, spring: 0.68, summer: 1, autumn: 0.5 };
  const weight = (season: keyof typeof PALETTES) =>
    (left.key === season ? 1 - transition : 0) +
    (right.key === season ? transition : 0);
  return {
    key,
    palette,
    transition,
    foliage:
      density[left.key] + (density[right.key] - density[left.key]) * transition,
    winter: weight("winter"),
    autumn: weight("autumn"),
  };
}

function circularDistance(a: number, b: number, total = 52) {
  const d = Math.abs(a - b);
  return Math.min(d, total - d);
}

export function timeResistance(week: number) {
  const boundaries = [8.5, 21.5, 34.5, 46.5];
  const nearBoundary = Math.min(
    ...boundaries.map(b => circularDistance(week, b))
  );
  const nearFestival = Math.min(
    ...FESTIVALS.map(f => circularDistance(week, f.week + 0.45))
  );
  const festival = 1 - 0.8 * (1 - smooth((nearFestival - 0.18) / 0.95));
  const boundary = 1 - 0.68 * (1 - smooth((nearBoundary - 0.3) / 1.1));
  return Math.min(festival, boundary);
}

export function currentMarker(week: number) {
  return FESTIVALS.find(f => circularDistance(week, f.week + 0.45) < 0.58);
}

export function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export { drawWorld } from "./aperture-painter";
