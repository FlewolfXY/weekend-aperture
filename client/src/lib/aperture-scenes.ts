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
    x: 0.24,
    y: 0.775,
    height: 0.34,
    title: "A LITTLE WARMTH",
    caption: "杯口的热气，还没有散。",
  },
  glass: {
    kind: "glass",
    x: 0.34,
    y: 0.48,
    height: 0.64,
    title: "RAIN, INSIDE",
    caption: "今天哪里也没去。雨一直在下。",
  },
  bloom: {
    kind: "bloom",
    x: 0.475,
    y: 0.407,
    height: 0.22,
    title: "SOMETHING GREW",
    caption: "某一片叶子，比上周更绿了。",
  },
  canopy: {
    kind: "canopy",
    x: 0.565,
    y: 0.51,
    height: 0.65,
    title: "ABOVE THE STREET",
    caption: "风把树梢，吹到窗前。",
  },
  train: {
    kind: "train",
    x: 0.74,
    y: 0.59,
    height: 0.28,
    title: "THE LAST TRAIN",
    caption: "列车经过，带走一小截灯火。",
  },
  tide: {
    kind: "tide",
    x: 0.63,
    y: 0.72,
    height: 0.35,
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

export function shotFor(week: number, day = 5, year = 0): Shot {
  const w = mod(Math.floor(week), 52);
  const kind = JOURNEY[w];
  const base = SHOTS[kind];
  const sunday = day === 6;
  const neighbours: Record<ShotKind, Camera & { caption: string }> = {
    ember: { x: 0.258, y: 0.815, height: 0.3, caption: "翻过一页，茶还温着。" },
    glass: {
      x: 0.344,
      y: 0.415,
      height: 0.46,
      caption: "两颗雨珠，终于碰到了一起。",
    },
    bloom: {
      x: 0.5,
      y: 0.412,
      height: 0.23,
      caption: "叶尖攒了很久的水，落下来了。",
    },
    canopy: {
      x: 0.59,
      y: 0.54,
      height: 0.58,
      caption: "同一阵风，先经过树梢，再经过我。",
    },
    train: { x: 0.8, y: 0.61, height: 0.34, caption: "车灯过后，水面还亮着。" },
    tide: {
      x: 0.68,
      y: 0.77,
      height: 0.3,
      caption: "风过去了，倒影还没有平静。",
    },
    horizon: {
      x: 0.78,
      y: 0.46,
      height: 0.94,
      caption: "远处的岸线，慢慢展开了。",
    },
  };
  const neighbour = sunday ? neighbours[kind] : {};
  return {
    ...base,
    ...neighbour,
    // Variation is stable within a year, subtle enough to preserve the place.
    x:
      (sunday ? neighbours[kind].x : base.x) +
      Math.sin(year * 2.1 + w) * 0.003 * Math.min(1, Math.abs(year)),
    rain: kind === "glass" || mod(w + year * 3, 11) === 7,
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

/** Close visits preserve their subject; only outward views become a journey. */
export function openingCamera(
  shot: Camera & { kind?: ShotKind },
  progress: number
): Camera {
  const p = smooth(progress);
  const destination: Camera =
    shot.kind === "horizon"
      ? { x: 0.64, y: 0.49, height: 1 }
      : shot.kind === "canopy"
        ? { x: 0.59, y: 0.54, height: 0.83 }
        : shot.kind === "tide"
          ? { x: 0.68, y: 0.71, height: 0.56 }
          : shot.kind === "train"
            ? { x: 0.73, y: 0.57, height: 0.52 }
            : { x: shot.x, y: shot.y, height: shot.height * 1.22 };
  return {
    x: shot.x + (destination.x - shot.x) * p,
    y: shot.y + (destination.y - shot.y) * p,
    height: shot.height + (destination.height - shot.height) * p,
  };
}

/** Keep meaningful focal points, including the rainy lamp, in narrow apertures. */
export function responsiveCamera(
  shot: Camera & { kind?: ShotKind },
  aspect: number
): Camera {
  if (aspect >= 0.36) return { ...shot };
  return {
    ...shot,
    x: shot.kind === "glass" ? 0.341 : shot.x,
    height: shot.height * (shot.kind === "horizon" ? 1 : 0.94),
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
  const filmHeight = height * (short ? 0.66 : compact ? 0.66 : 0.79);
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
    frameWidth: width / (compact ? 2.45 : 5),
  };
}
