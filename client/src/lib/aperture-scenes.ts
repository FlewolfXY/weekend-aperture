import { clamp, mod, smooth } from "./aperture-world";

export type ShotKind =
  | "ember"
  | "glass"
  | "bloom"
  | "canopy"
  | "train"
  | "tide"
  | "horizon";
export type Camera = { x: number; y: number; height: number };
export type Shot = Camera & {
  kind: ShotKind;
  title: string;
  caption: string;
  rain: boolean;
  wide: boolean;
  inverted: boolean;
};

const SHOTS: Record<ShotKind, Omit<Shot, "rain" | "wide" | "inverted">> = {
  ember: {
    kind: "ember",
    x: 0.204,
    y: 0.775,
    height: 0.35,
    title: "A LITTLE WARMTH",
    caption: "杯口的热气，还没有散。",
  },
  glass: {
    kind: "glass",
    x: 0.32,
    y: 0.45,
    height: 0.56,
    title: "RAIN, INSIDE",
    caption: "今天哪里也没去。雨一直在下。",
  },
  bloom: {
    kind: "bloom",
    x: 0.52,
    y: 0.485,
    height: 0.31,
    title: "SOMETHING GREW",
    caption: "某一片叶子，比上周更绿了。",
  },
  canopy: {
    kind: "canopy",
    x: 0.57,
    y: 0.49,
    height: 0.65,
    title: "ABOVE THE STREET",
    caption: "风把树梢，吹到窗前。",
  },
  train: {
    kind: "train",
    x: 0.78,
    y: 0.65,
    height: 0.34,
    title: "THE LAST TRAIN",
    caption: "列车经过，带走一小截灯火。",
  },
  tide: {
    kind: "tide",
    x: 0.69,
    y: 0.78,
    height: 0.38,
    title: "LIGHT ON WATER",
    caption: "什么也不做，看水把光揉碎。",
  },
  horizon: {
    kind: "horizon",
    x: 0.74,
    y: 0.43,
    height: 0.85,
    title: "A LITTLE FURTHER",
    caption: "这一次，走得远了一点。",
  },
};

// A quiet annual journey: the same room and tree, increasingly distant attention,
// then home again. Each week keeps its identity when time is rewound.
const JOURNEY: ShotKind[] = [
  "ember",
  "glass",
  "tide",
  "glass",
  "ember",
  "ember",
  "glass",
  "canopy",
  "bloom",
  "glass",
  "bloom",
  "canopy",
  "glass",
  "bloom",
  "train",
  "canopy",
  "horizon",
  "glass",
  "bloom",
  "train",
  "canopy",
  "tide",
  "horizon",
  "canopy",
  "tide",
  "train",
  "glass",
  "canopy",
  "tide",
  "horizon",
  "train",
  "tide",
  "canopy",
  "glass",
  "bloom",
  "canopy",
  "horizon",
  "train",
  "tide",
  "canopy",
  "horizon",
  "glass",
  "train",
  "canopy",
  "ember",
  "tide",
  "glass",
  "ember",
  "glass",
  "ember",
  "tide",
  "ember",
];

export function shotFor(week: number, day = 5): Shot {
  const w = mod(Math.floor(week), 52);
  const kind = JOURNEY[w];
  const base = SHOTS[kind];
  const sunday = day === 6;
  return {
    ...base,
    // Sunday notices a neighbouring detail, not a copy of Saturday's picture.
    x: base.x + (sunday ? (kind === "ember" ? 0.039 : -0.036) : 0),
    y: base.y + (sunday ? (kind === "ember" ? -0.035 : 0.035) : 0),
    height: base.height * (sunday ? 0.83 : 1),
    rain: kind === "glass" || w % 11 === 7,
    wide: kind === "horizon",
    inverted: sunday && w % 17 === 0,
  };
}

export function sourceCrop(
  sourceWidth: number,
  sourceHeight: number,
  viewWidth: number,
  viewHeight: number,
  camera: Camera
) {
  const aspect = viewWidth / Math.max(1, viewHeight);
  let h = sourceHeight * camera.height;
  let w = h * aspect;
  if (w > sourceWidth) {
    h *= sourceWidth / w;
    w = sourceWidth;
  }
  if (h > sourceHeight) {
    w *= sourceHeight / h;
    h = sourceHeight;
  }
  return {
    x: clamp(camera.x * sourceWidth - w / 2, 0, sourceWidth - w),
    y: clamp(camera.y * sourceHeight - h / 2, 0, sourceHeight - h),
    width: w,
    height: h,
  };
}

export function openingCamera(shot: Camera, progress: number): Camera {
  const p = smooth(progress);
  return {
    x: shot.x + (0.55 - shot.x) * p,
    y: shot.y + (0.51 - shot.y) * p,
    height: shot.height + (1 - shot.height) * p,
  };
}

export function weekdayLeak(day: number, seconds: number) {
  // Unscheduled daydreams. Most frames stay shut; a few clear briefly by themselves.
  const seed = mod(Math.sin(day * 127.1 + 311.7) * 43758.5453, 1);
  if (seed < 0.58) return 0;
  const wave = Math.sin(seconds * (0.23 + seed * 0.12) + day * 2.31);
  return smooth((wave - 0.4) / 0.6) * (0.25 + seed * 0.35);
}

export function filmGeometry(width: number, height: number) {
  const compact = width < 700;
  const short = height < 520;
  const top = height * (short ? 0.14 : compact ? 0.125 : 0.105);
  const filmHeight = height * (short ? 0.66 : compact ? 0.685 : 0.79);
  const margin = Math.max(
    short ? 24 : compact ? 39 : 52,
    height * (compact ? 0.058 : 0.077)
  );
  return {
    top,
    filmHeight,
    innerTop: top + margin,
    innerHeight: Math.max(60, filmHeight - margin * 2),
    // Five dark days fit between apertures: two different weekends never share a screen.
    frameWidth: width / (compact ? 3.15 : 5),
  };
}
