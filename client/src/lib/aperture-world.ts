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
    bottom: "#324d69",
    horizon: "#cb7d75",
    glow: "#ff6b35",
    leaf: "#9be7ff",
    water: "#102c45",
  },
  spring: {
    top: "#082329",
    bottom: "#3c8c77",
    horizon: "#ff86aa",
    glow: "#ffcf4a",
    leaf: "#63f58f",
    water: "#0f5960",
  },
  summer: {
    top: "#04282f",
    bottom: "#00a17d",
    horizon: "#ffe778",
    glow: "#ff5d27",
    leaf: "#14ff94",
    water: "#006e7a",
  },
  autumn: {
    top: "#161329",
    bottom: "#8d3146",
    horizon: "#ff8b38",
    glow: "#ff3d2e",
    leaf: "#ffb12d",
    water: "#49304e",
  },
};

type Palette = (typeof PALETTES)[keyof typeof PALETTES];

type SeedPoint = { x: number; y: number; z: number; s: number };

function seededPoints(count: number, seed = 7127): SeedPoint[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    z: random(),
    s: 0.35 + random() * 1.1,
  }));
}

const SKY_DUST = seededPoints(90, 91);
const LEAVES = seededPoints(310, 1138);
const RAIN = seededPoints(130, 713);
const SNOW = seededPoints(110, 811);
const CITY = seededPoints(38, 9881);

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

function drawBranch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  angle: number,
  depth: number,
  wind: number,
  tips: { x: number; y: number }[]
) {
  if (depth <= 0 || len < 3) {
    tips.push({ x, y });
    return;
  }
  const sway = wind * (6 - depth) * 0.014;
  const a = angle + sway;
  const x2 = x + Math.cos(a) * len;
  const y2 = y + Math.sin(a) * len;
  ctx.lineWidth = Math.max(0.7, depth * 1.25);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo((x + x2) / 2 + wind * 2, (y + y2) / 2, x2, y2);
  ctx.stroke();
  drawBranch(ctx, x2, y2, len * 0.73, a - 0.45, depth - 1, wind, tips);
  drawBranch(ctx, x2, y2, len * 0.68, a + 0.58, depth - 1, wind, tips);
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  week: number,
  pointer: { x: number; y: number },
  rainy = false
) {
  const { key, palette, foliage, winter, autumn } = seasonState(week);
  const wind = Math.sin(t * 0.55) * 0.8 + Math.sin(t * 1.31) * 0.28;
  const daylight = 0.68 + Math.sin(t * 0.08 + week * 0.23) * 0.12;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, palette.top);
  sky.addColorStop(0.57, palette.bottom);
  sky.addColorStop(1, palette.water);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const px = (pointer.x - 0.5) * width * 0.035;
  const py = (pointer.y - 0.5) * height * 0.025;

  ctx.save();
  ctx.translate(px * 0.18, py * 0.12);
  for (let band = 0; band < 3; band += 1) {
    ctx.beginPath();
    ctx.moveTo(-width * 0.1, height * (0.15 + band * 0.11));
    for (let i = 0; i <= 8; i += 1) {
      const x = (i / 8) * width;
      const y =
        height * (0.18 + band * 0.105) +
        Math.sin(i * 1.7 + t * (0.18 + band * 0.04)) * height * 0.055;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = alphaColor(
      band === 1 ? palette.horizon : palette.leaf,
      band === 1 ? 0.27 : 0.18
    );
    ctx.lineWidth = height * (0.055 + band * 0.018);
    ctx.shadowBlur = 36;
    ctx.shadowColor = palette.glow;
    ctx.stroke();
  }
  ctx.restore();

  // Long, translucent clouds travel independently of the reel and camera.
  ctx.save();
  for (let c = 0; c < 7; c += 1) {
    const x =
      mod(c * width * 0.21 + t * (2.2 + c * 0.4), width * 1.5) - width * 0.25;
    const y = height * (0.13 + (c % 3) * 0.09) + Math.sin(t * 0.09 + c) * 8;
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, width * 0.19);
    cloud.addColorStop(0, alphaColor(palette.horizon, rainy ? 0.14 : 0.07));
    cloud.addColorStop(1, alphaColor(palette.horizon, 0));
    ctx.save();
    ctx.translate(0, y);
    ctx.scale(1, 0.27);
    ctx.translate(0, -y);
    ctx.fillStyle = cloud;
    ctx.fillRect(x - width * 0.2, y - width * 0.2, width * 0.4, width * 0.4);
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = key === "winter" ? 0.8 : 0.38;
  SKY_DUST.forEach(p => {
    const pulse = 0.35 + 0.65 * Math.sin(t * (0.5 + p.z) + p.x * 12) ** 2;
    ctx.fillStyle = p.z > 0.82 ? palette.glow : "#d9fff8";
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height * 0.58, p.s * pulse, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  const orbX = width * 0.74 + Math.sin(t * 0.11) * width * 0.025;
  const orbY = height * (0.28 + Math.sin(week * 0.35) * 0.025);
  const orb = ctx.createRadialGradient(
    orbX,
    orbY,
    0,
    orbX,
    orbY,
    height * 0.18
  );
  orb.addColorStop(0, alphaColor(palette.glow, 0.96));
  orb.addColorStop(0.16, alphaColor(palette.glow, 0.53));
  orb.addColorStop(1, alphaColor(palette.glow, 0));
  ctx.fillStyle = orb;
  ctx.fillRect(
    orbX - height * 0.2,
    orbY - height * 0.2,
    height * 0.4,
    height * 0.4
  );

  ctx.save();
  ctx.fillStyle = palette.glow;
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 35;
  ctx.beginPath();
  ctx.arc(orbX, orbY, height * 0.024, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = alphaColor(palette.horizon, 0.8);
  ctx.beginPath();
  ctx.arc(orbX - 3, orbY - 3, height * 0.017, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // A distant ridge remains the geographical anchor behind the nearer city.
  ctx.save();
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle = alphaColor(
      layer === 0 ? palette.horizon : palette.top,
      0.12 + layer * 0.16
    );
    ctx.beginPath();
    ctx.moveTo(0, height * 0.74);
    for (let x = -20; x <= width + 20; x += 12) {
      const n = x / width;
      const y =
        height *
        (0.49 +
          layer * 0.055 +
          Math.sin(n * 11 + layer) * 0.045 +
          Math.sin(n * 23 + layer * 2) * 0.024);
      ctx.lineTo(x + px * 0.2, y);
    }
    ctx.lineTo(width, height * 0.78);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(px * 0.34, 0);
  const mountain = ctx.createLinearGradient(0, height * 0.38, 0, height * 0.75);
  mountain.addColorStop(0, "rgba(7, 9, 20, .35)");
  mountain.addColorStop(1, "rgba(3, 7, 13, .95)");
  ctx.fillStyle = mountain;
  ctx.beginPath();
  ctx.moveTo(-30, height * 0.72);
  ctx.lineTo(width * 0.08, height * 0.56);
  ctx.lineTo(width * 0.21, height * 0.65);
  ctx.lineTo(width * 0.34, height * 0.43);
  ctx.lineTo(width * 0.48, height * 0.66);
  ctx.lineTo(width * 0.62, height * 0.49);
  ctx.lineTo(width * 0.82, height * 0.67);
  ctx.lineTo(width + 30, height * 0.53);
  ctx.lineTo(width + 30, height);
  ctx.lineTo(-30, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(px * 0.58, 0);
  CITY.forEach((p, index) => {
    const w = width * (0.012 + p.z * 0.018);
    const h = height * (0.05 + p.s * 0.065);
    const x = p.x * width;
    const y = height * 0.73 - h;
    ctx.fillStyle = `rgba(4, 9, 16, ${0.62 + p.z * 0.3})`;
    ctx.fillRect(x, y, w, h);
    if (Math.sin(t * 0.08 + index * 13) > -0.3) {
      ctx.fillStyle = alphaColor(
        index % 5 === 0 ? palette.glow : palette.leaf,
        0.67
      );
      ctx.fillRect(x + w * 0.28, y + h * 0.2, 1.2, 1.8);
      ctx.fillRect(x + w * 0.63, y + h * 0.55, 1.1, 1.6);
    }
  });
  const trainX = mod(t * width * 0.018, width * 1.25) - width * 0.15;
  ctx.strokeStyle = alphaColor(palette.glow, 0.73);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.705);
  ctx.lineTo(width, height * 0.705);
  ctx.stroke();
  ctx.fillStyle = alphaColor(palette.glow, 0.85);
  ctx.shadowBlur = 12;
  ctx.shadowColor = palette.glow;
  ctx.fillRect(trainX, height * 0.69, width * 0.09, 6);
  ctx.shadowBlur = 0;
  for (let carriage = 0; carriage < 6; carriage++) {
    ctx.fillStyle = "#fff1bd";
    ctx.fillRect(
      trainX + carriage * width * 0.014,
      height * 0.691,
      width * 0.007,
      2.2
    );
  }
  // A passing silhouette under a street lamp, small enough to discover.
  const walker = width * (0.76 + Math.sin(t * 0.033) * 0.11);
  ctx.fillStyle = "#09121b";
  ctx.beginPath();
  ctx.arc(walker, height * 0.712 - 7, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(walker - 1.5, height * 0.712 - 5, 3, 8);
  ctx.strokeStyle = "#081118";
  ctx.lineWidth = 1.5;
  for (let leg = 0; leg < 2; leg++) {
    ctx.beginPath();
    ctx.moveTo(walker, height * 0.712 + 2);
    ctx.lineTo(
      walker + Math.sin(t * 4 + leg * Math.PI) * 3,
      height * 0.712 + 7
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  const waterY = height * 0.73;
  const waterGradient = ctx.createLinearGradient(0, waterY, 0, height);
  waterGradient.addColorStop(0, alphaColor(palette.horizon, 0.4));
  waterGradient.addColorStop(0.18, alphaColor(palette.water, 0.87));
  waterGradient.addColorStop(1, "#02070d");
  ctx.fillStyle = waterGradient;
  ctx.fillRect(0, waterY, width, height - waterY);
  for (let i = 0; i < 54; i += 1) {
    const y = waterY + ((i + 1) / 55) * (height - waterY);
    const drift = Math.sin(t * 0.7 + i * 0.9) * width * 0.02;
    ctx.strokeStyle = alphaColor(
      i % 4 === 0 ? palette.glow : palette.horizon,
      i % 4 === 0 ? 0.25 : 0.14
    );
    ctx.lineWidth = 0.6 + (i / 54) * 1.8;
    ctx.beginPath();
    ctx.moveTo(width * 0.18 + drift, y);
    ctx.quadraticCurveTo(
      width * 0.5,
      y + Math.sin(t + i) * 3,
      width * 0.82 - drift,
      y
    );
    ctx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const p = SKY_DUST[i];
    const y = waterY + mod(p.y + t * 0.006, 1) * height * 0.25;
    const x =
      orbX +
      Math.sin(t * 0.42 + p.z * 20) * width * 0.016 +
      (p.x - 0.5) * width * (0.04 + p.y * 0.11);
    ctx.globalAlpha = 0.12 + 0.38 * Math.sin(t * 0.7 + i) ** 2;
    ctx.fillStyle = i % 4 === 0 ? "#fff2c4" : palette.glow;
    ctx.fillRect(x, y, width * (0.003 + p.z * 0.014), 1 + p.y * 1.3);
  }
  ctx.restore();

  ctx.save();
  ctx.translate(width * 0.56 + px * 0.8, height * 0.76);
  ctx.strokeStyle = key === "winter" ? "#17283a" : "#241b21";
  ctx.shadowBlur = 7;
  ctx.shadowColor = alphaColor(palette.leaf, 0.4);
  const tips: { x: number; y: number }[] = [];
  drawBranch(ctx, 0, 0, height * 0.145, -Math.PI / 2, 6, wind, tips);
  ctx.shadowBlur = 0;
  const leafAmount = foliage;
  LEAVES.slice(0, Math.floor(LEAVES.length * leafAmount)).forEach((p, i) => {
    const angle = p.x * Math.PI * 2;
    const tip = tips[i % tips.length];
    const x = tip.x + Math.cos(angle) * (8 + p.y * 24) + wind * p.z * 3;
    const y = tip.y + Math.sin(angle) * (8 + p.y * 22);
    const fall =
      i % 7 === 0 ? autumn * mod(t * 10 * p.s + i * 13, height * 0.39) : 0;
    ctx.fillStyle =
      i % 11 === 0
        ? palette.glow
        : key === "spring" && i % 4 === 0
          ? palette.horizon
          : palette.leaf;
    ctx.globalAlpha = 0.45 + p.z * 0.5;
    ctx.beginPath();
    const leafSize = key === "winter" ? 1.2 : key === "summer" ? 4.2 : 3.3;
    ctx.ellipse(
      x + Math.sin(t * 0.8 + i) * 2,
      y + fall,
      1.4 + p.s * leafSize,
      0.8 + p.s * leafSize * 0.55,
      angle + wind * 0.1,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });
  ctx.restore();

  const precipitation = winter > 0.5 ? SNOW : RAIN;
  ctx.save();
  ctx.globalAlpha =
    winter > 0.5 ? 0.58 * winter : (rainy ? 0.48 : 0.035) * (1 - winter);
  precipitation.forEach((p, i) => {
    const x = mod(
      p.x * width +
        t * (key === "winter" ? 6 : 26) * p.s +
        Math.sin(i) * wind * 8,
      width
    );
    const y = mod(
      p.y * height + t * (key === "winter" ? 18 : 115) * p.s,
      height
    );
    ctx.strokeStyle =
      key === "winter" ? "#e7fbff" : alphaColor(palette.leaf, 0.72);
    ctx.fillStyle = "#ecfbff";
    if (key === "winter") {
      ctx.beginPath();
      ctx.arc(x, y, 0.7 + p.s * 0.75, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 0.5 + p.z;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - wind * 4, y + 8 + p.s * 8);
      ctx.stroke();
    }
  });
  ctx.restore();

  drawRoom(ctx, width, height, t, palette, rainy);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const shimmer = ctx.createLinearGradient(0, 0, width, height);
  shimmer.addColorStop(0, "transparent");
  shimmer.addColorStop(
    0.48 + Math.sin(t * 0.1) * 0.09,
    alphaColor(palette.glow, daylight * 0.11)
  );
  shimmer.addColorStop(0.56, "transparent");
  ctx.fillStyle = shimmer;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawRoom(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  palette: Palette,
  rainy: boolean
) {
  ctx.save();
  const shade = ctx.createLinearGradient(0, 0, w * 0.46, 0);
  shade.addColorStop(0, "rgba(0,2,6,.98)");
  shade.addColorStop(0.4, "rgba(1,5,12,.72)");
  shade.addColorStop(1, "rgba(1,5,12,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w * 0.47, h);
  // Window jamb and sill: every close view belongs to this one room.
  ctx.fillStyle = "rgba(3,8,14,.92)";
  ctx.fillRect(w * 0.105, 0, w * 0.02, h * 0.87);
  ctx.fillStyle = alphaColor(palette.leaf, 0.16);
  ctx.fillRect(w * 0.125, 0, 1.2, h * 0.87);
  ctx.fillStyle = "#070d16";
  ctx.fillRect(0, h * 0.877, w * 0.39, h * 0.123);
  const sill = ctx.createLinearGradient(0, h * 0.873, 0, h * 0.91);
  sill.addColorStop(0, alphaColor(palette.horizon, 0.24));
  sill.addColorStop(1, "#070c13");
  ctx.fillStyle = sill;
  ctx.fillRect(0, h * 0.871, w * 0.42, h * 0.04);

  // A gauze curtain breathes without the camera moving.
  for (let fold = 0; fold < 7; fold++) {
    const x = w * (0.126 + fold * 0.008);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(
      x + Math.sin(t * 0.48 + fold * 0.2) * 17,
      h * 0.28,
      x + Math.sin(t * 0.56 + fold * 0.25) * 30,
      h * 0.62,
      x - 14 + Math.sin(t * 0.4) * 9,
      h * 0.855
    );
    ctx.strokeStyle = alphaColor(palette.horizon, 0.05 + fold * 0.006);
    ctx.lineWidth = w * 0.014;
    ctx.stroke();
  }

  // A single warm lamp survives even the grey, rainy weekends.
  const lampX = w * 0.365,
    lampY = h * 0.58;
  const halo = ctx.createRadialGradient(
    lampX,
    lampY,
    0,
    lampX,
    lampY,
    h * 0.145
  );
  halo.addColorStop(0, "rgba(255,176,67,.65)");
  halo.addColorStop(0.08, "rgba(255,115,36,.30)");
  halo.addColorStop(1, "rgba(255,84,23,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(lampX - h * 0.15, lampY - h * 0.15, h * 0.3, h * 0.3);
  ctx.fillStyle = "#080e15";
  ctx.fillRect(lampX - 2, lampY, 4, h * 0.29);
  ctx.fillStyle = "#ffa350";
  ctx.beginPath();
  ctx.ellipse(lampX, lampY, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#15131a";
  ctx.beginPath();
  ctx.moveTo(lampX - 20, lampY - 2);
  ctx.lineTo(lampX - 11, lampY - 26);
  ctx.lineTo(lampX + 11, lampY - 26);
  ctx.lineTo(lampX + 20, lampY - 2);
  ctx.fill();

  // Cup: glazed ceramic, liquid, reflected light, and three evolving steam filaments.
  const cx = w * 0.2,
    cy = h * 0.866,
    cw = w * 0.048,
    ch = h * 0.083;
  ctx.fillStyle = "rgba(0,0,0,.5)";
  ctx.beginPath();
  ctx.ellipse(cx + cw * 0.5, cy + 5, cw * 0.85, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#967753";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(
    cx + cw * 1.05,
    cy - ch * 0.55,
    cw * 0.25,
    ch * 0.25,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  const ceramic = ctx.createLinearGradient(cx, 0, cx + cw, 0);
  ceramic.addColorStop(0, "#1d3541");
  ceramic.addColorStop(0.3, "#507675");
  ceramic.addColorStop(0.65, "#233f49");
  ceramic.addColorStop(1, "#111d2c");
  ctx.fillStyle = ceramic;
  ctx.beginPath();
  ctx.roundRect(cx, cy - ch, cw, ch, [4, 4, 13, 13]);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,170,78,.7)";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#ff7e25";
  ctx.fillStyle = "#ff9d38";
  ctx.beginPath();
  ctx.ellipse(cx + cw / 2, cy - ch + 3, cw / 2, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#442716";
  ctx.beginPath();
  ctx.ellipse(cx + cw / 2, cy - ch + 3, cw / 2 - 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd27d";
  ctx.fillRect(cx + 3, cy - ch * 0.9, 1.5, ch * 0.63);
  for (let strand = 0; strand < 3; strand++) {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const p = i / 40;
      const x =
        cx +
        cw * (0.3 + strand * 0.18) +
        Math.sin(p * 7 - t * 0.9 + strand) * (3 + p * 15);
      const y = cy - ch - 9 - p * h * 0.135;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = alphaColor(
      strand === 1 ? "#ffd3ac" : "#b9e6ec",
      0.16 + Math.sin(t * 0.7 + strand) * 0.04
    );
    ctx.lineWidth = 1.2 + strand * 0.4;
    ctx.shadowBlur = 3;
    ctx.shadowColor = "#d7ecff";
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Fine rain beads sit on the glass in front of the distant living world.
  if (rainy) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(w * 0.17, 0, w * 0.27, h * 0.866);
    ctx.clip();
    const mist = ctx.createLinearGradient(w * 0.17, 0, w * 0.44, 0);
    mist.addColorStop(0, "rgba(141,166,178,.08)");
    mist.addColorStop(0.65, "rgba(110,140,158,.18)");
    mist.addColorStop(1, "rgba(110,140,158,0)");
    ctx.fillStyle = mist;
    ctx.fillRect(w * 0.17, 0, w * 0.27, h * 0.866);
    RAIN.slice(0, 72).forEach((p, i) => {
      const x = w * (0.17 + p.x * 0.27) + Math.sin(t * 0.1 + i) * 1.4;
      const slide = i % 5 === 0 ? t * (9 + p.s * 7) : t * 0.65;
      const y = mod(p.y * h + slide, h * 0.87);
      const r = 1.2 + p.z * 3.5;
      if (i % 5 === 0) {
        ctx.strokeStyle = "rgba(165,205,224,.13)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y - 42);
        ctx.quadraticCurveTo(x + 2, y - 12, x, y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(3,17,30,.45)";
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (1.2 + p.z * 0.5), 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(194,222,235,.48)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.fillStyle = i % 9 === 0 ? "#ffb563" : "rgba(222,246,255,.7)";
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.4, 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
  ctx.restore();
}
