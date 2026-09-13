import { useEffect, useRef } from "react";

export type WorldStatus = {
  season: string;
  week: number;
  day: string;
  speed: number;
  marker?: string;
};

type TimeFilmProps = {
  speed: number;
  paused: boolean;
  reducedMotion: boolean;
  seekWeek: number | null;
  seekToken: number;
  onSpeedChange: (value: number) => void;
  onPauseChange: (value: boolean) => void;
  onStatus: (status: WorldStatus) => void;
};

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const SEASON_CN: Record<string, string> = {
  winter: "冬",
  spring: "春",
  summer: "夏",
  autumn: "秋",
};

const FESTIVALS = [
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
const LEAVES = seededPoints(170, 1138);
const RAIN = seededPoints(130, 713);
const SNOW = seededPoints(110, 811);
const CITY = seededPoints(38, 9881);

function mod(value: number, by: number) {
  return ((value % by) + by) % by;
}

function clamp(value: number, min: number, max: number) {
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

function alphaColor(color: string, alpha: number) {
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

function smooth(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function seasonState(week: number): { key: keyof typeof PALETTES; palette: Palette; transition: number } {
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
  const palette = mixPalette(PALETTES[left.key], PALETTES[right.key], transition);
  const key = transition > 0.5 ? right.key : left.key;
  return { key, palette, transition };
}

function circularDistance(a: number, b: number, total = 52) {
  const d = Math.abs(a - b);
  return Math.min(d, total - d);
}

function timeResistance(week: number) {
  const boundaries = [8.5, 21.5, 34.5, 46.5];
  const nearBoundary = Math.min(...boundaries.map((b) => circularDistance(week, b)));
  const nearFestival = Math.min(...FESTIVALS.map((f) => circularDistance(week, f.week + 0.45)));
  if (nearFestival < 0.42) return 0.2;
  if (nearBoundary < 0.65) return 0.32;
  if (nearFestival < 1.05) return 0.55;
  if (nearBoundary < 1.4) return 0.62;
  return 1;
}

function currentMarker(week: number) {
  return FESTIVALS.find((f) => circularDistance(week, f.week + 0.45) < 0.58);
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
) {
  if (depth <= 0 || len < 3) return;
  const sway = wind * (6 - depth) * 0.014;
  const a = angle + sway;
  const x2 = x + Math.cos(a) * len;
  const y2 = y + Math.sin(a) * len;
  ctx.lineWidth = Math.max(0.7, depth * 1.25);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo((x + x2) / 2 + wind * 2, (y + y2) / 2, x2, y2);
  ctx.stroke();
  drawBranch(ctx, x2, y2, len * 0.73, a - 0.45, depth - 1, wind);
  drawBranch(ctx, x2, y2, len * 0.68, a + 0.58, depth - 1, wind);
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  week: number,
  pointer: { x: number; y: number },
) {
  const { key, palette, transition } = seasonState(week);
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
      const y = height * (0.18 + band * 0.105) + Math.sin(i * 1.7 + t * (0.18 + band * 0.04)) * height * 0.055;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = alphaColor(band === 1 ? palette.horizon : palette.leaf, band === 1 ? 0.27 : 0.18);
    ctx.lineWidth = height * (0.055 + band * 0.018);
    ctx.shadowBlur = 36;
    ctx.shadowColor = palette.glow;
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = key === "winter" ? 0.8 : 0.38;
  SKY_DUST.forEach((p) => {
    const pulse = 0.35 + 0.65 * Math.sin(t * (0.5 + p.z) + p.x * 12) ** 2;
    ctx.fillStyle = p.z > 0.82 ? palette.glow : "#d9fff8";
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height * 0.58, p.s * pulse, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  const orbX = width * 0.74 + Math.sin(t * 0.11) * width * 0.025;
  const orbY = height * 0.28;
  const orb = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, height * 0.18);
  orb.addColorStop(0, alphaColor(palette.glow, 0.96));
  orb.addColorStop(0.16, alphaColor(palette.glow, 0.53));
  orb.addColorStop(1, alphaColor(palette.glow, 0));
  ctx.fillStyle = orb;
  ctx.fillRect(orbX - height * 0.2, orbY - height * 0.2, height * 0.4, height * 0.4);

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
    if ((index + Math.floor(t * 0.7)) % 3 === 0) {
      ctx.fillStyle = alphaColor(index % 5 === 0 ? palette.glow : palette.leaf, 0.67);
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
  ctx.fillRect(trainX, height * 0.695, width * 0.07, 2);
  ctx.restore();

  ctx.save();
  const waterY = height * 0.73;
  const waterGradient = ctx.createLinearGradient(0, waterY, 0, height);
  waterGradient.addColorStop(0, alphaColor(palette.horizon, 0.4));
  waterGradient.addColorStop(0.18, alphaColor(palette.water, 0.87));
  waterGradient.addColorStop(1, "#02070d");
  ctx.fillStyle = waterGradient;
  ctx.fillRect(0, waterY, width, height - waterY);
  for (let i = 0; i < 24; i += 1) {
    const y = waterY + ((i + 1) / 25) * (height - waterY);
    const drift = Math.sin(t * 0.7 + i * 0.9) * width * 0.02;
    ctx.strokeStyle = alphaColor(i % 4 === 0 ? palette.glow : palette.horizon, i % 4 === 0 ? 0.25 : 0.14);
    ctx.lineWidth = 0.6 + (i / 24) * 1.8;
    ctx.beginPath();
    ctx.moveTo(width * 0.18 + drift, y);
    ctx.quadraticCurveTo(width * 0.5, y + Math.sin(t + i) * 3, width * 0.82 - drift, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(width * 0.56 + px * 0.8, height * 0.76);
  ctx.strokeStyle = key === "winter" ? "#17283a" : "#241b21";
  ctx.shadowBlur = 7;
  ctx.shadowColor = alphaColor(palette.leaf, 0.4);
  drawBranch(ctx, 0, 0, height * 0.19, -Math.PI / 2, 6, wind);
  ctx.shadowBlur = 0;
  const leafAmount = key === "winter" ? 0.14 + transition * 0.16 : key === "spring" ? 0.64 : key === "summer" ? 1 : 0.74;
  LEAVES.slice(0, Math.floor(LEAVES.length * leafAmount)).forEach((p, i) => {
    const angle = p.x * Math.PI * 2;
    const radiusX = height * (0.03 + p.y * 0.16);
    const radiusY = height * (0.02 + p.y * 0.13);
    const x = Math.cos(angle) * radiusX + wind * p.z * 7;
    const y = -height * 0.15 + Math.sin(angle) * radiusY - p.z * height * 0.08;
    const fall = key === "autumn" && i % 7 === 0 ? mod(t * 10 * p.s + i * 13, height * 0.28) : 0;
    ctx.fillStyle = i % 11 === 0 ? palette.glow : palette.leaf;
    ctx.globalAlpha = 0.3 + p.z * 0.68;
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(t + i) * 2, y + fall, 1.4 + p.s * 1.7, 0.7 + p.s, angle, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  const precipitation = key === "winter" ? SNOW : RAIN;
  ctx.save();
  ctx.globalAlpha = key === "summer" ? 0.52 : key === "winter" ? 0.72 : 0.28;
  precipitation.forEach((p, i) => {
    const x = mod((p.x * width) + t * (key === "winter" ? 6 : 26) * p.s + Math.sin(i) * wind * 8, width);
    const y = mod(p.y * height + t * (key === "winter" ? 18 : 115) * p.s, height);
    ctx.strokeStyle = key === "winter" ? "#e7fbff" : alphaColor(palette.leaf, 0.72);
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

  ctx.save();
  const roomShade = ctx.createLinearGradient(0, 0, width * 0.2, 0);
  roomShade.addColorStop(0, "rgba(0, 2, 5, .95)");
  roomShade.addColorStop(1, "rgba(0, 3, 8, 0)");
  ctx.fillStyle = roomShade;
  ctx.fillRect(0, 0, width * 0.28, height);
  ctx.fillStyle = "rgba(0, 3, 7, .52)";
  ctx.fillRect(0, height * 0.88, width, height * 0.12);
  ctx.strokeStyle = "rgba(194, 230, 232, .13)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.14, 0);
  ctx.lineTo(width * 0.14, height * 0.84);
  ctx.moveTo(0, height * 0.12);
  ctx.lineTo(width, height * 0.12);
  ctx.stroke();
  const cupX = width * 0.18;
  const cupY = height * 0.86;
  ctx.fillStyle = "rgba(6, 10, 16, .92)";
  ctx.beginPath();
  ctx.roundRect(cupX, cupY - 34, 31, 34, 4);
  ctx.fill();
  ctx.strokeStyle = alphaColor(palette.glow, 0.7);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = alphaColor(palette.horizon, 0.4);
  ctx.beginPath();
  ctx.moveTo(cupX + 9, cupY - 38);
  ctx.bezierCurveTo(cupX - 2, cupY - 56, cupX + 24, cupY - 61, cupX + 12, cupY - 81);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const shimmer = ctx.createLinearGradient(0, 0, width, height);
  shimmer.addColorStop(0, "transparent");
  shimmer.addColorStop(0.48 + Math.sin(t * 0.1) * 0.09, alphaColor(palette.glow, daylight * 0.11));
  shimmer.addColorStop(0.56, "transparent");
  ctx.fillStyle = shimmer;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawWorkstation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  t: number,
  day: number,
) {
  ctx.save();
  roundedPath(ctx, x, y, width, height, 6);
  ctx.clip();

  const room = ctx.createLinearGradient(x, y, x + width, y + height);
  room.addColorStop(0, day === 4 ? "rgba(47, 38, 38, .94)" : "rgba(17, 24, 28, .96)");
  room.addColorStop(0.58, "rgba(8, 12, 15, .98)");
  room.addColorStop(1, "rgba(29, 33, 34, .94)");
  ctx.fillStyle = room;
  ctx.fillRect(x, y, width, height);

  const fluorescent = ctx.createLinearGradient(x, y, x, y + height * 0.3);
  fluorescent.addColorStop(0, "rgba(204, 224, 218, .14)");
  fluorescent.addColorStop(1, "rgba(155, 185, 180, 0)");
  ctx.fillStyle = fluorescent;
  ctx.fillRect(x + width * 0.12, y, width * 0.76, height * 0.28);
  ctx.fillStyle = "rgba(226, 237, 233, .28)";
  ctx.fillRect(x + width * 0.2, y + height * 0.055, width * 0.58, 2);

  const monitorX = x + width * 0.13;
  const monitorY = y + height * 0.22;
  const monitorW = width * 0.74;
  const monitorH = height * 0.35;
  ctx.fillStyle = "rgba(2, 5, 7, .98)";
  ctx.fillRect(monitorX - 3, monitorY - 3, monitorW + 6, monitorH + 6);
  const monitor = ctx.createLinearGradient(monitorX, monitorY, monitorX + monitorW, monitorY + monitorH);
  monitor.addColorStop(0, "rgba(33, 53, 58, .76)");
  monitor.addColorStop(0.45, "rgba(19, 35, 40, .84)");
  monitor.addColorStop(1, day === 4 ? "rgba(75, 48, 43, .6)" : "rgba(27, 44, 47, .7)");
  ctx.fillStyle = monitor;
  ctx.fillRect(monitorX, monitorY, monitorW, monitorH);

  ctx.fillStyle = "rgba(154, 193, 187, .2)";
  for (let i = 0; i < 9; i += 1) {
    const lineW = monitorW * (0.18 + mod(i * 0.37 + day * 0.11, 1) * 0.63);
    ctx.fillRect(monitorX + monitorW * 0.1, monitorY + monitorH * (0.13 + i * 0.075), lineW, 1);
  }
  const cursor = mod(t * (9 + day * 1.3), monitorW * 0.68);
  ctx.fillStyle = day === 4 ? "rgba(255, 148, 96, .34)" : "rgba(171, 224, 215, .38)";
  ctx.fillRect(monitorX + monitorW * 0.1 + cursor, monitorY + monitorH * 0.85, 1, monitorH * 0.075);

  ctx.fillStyle = "rgba(5, 8, 10, .96)";
  ctx.fillRect(x, y + height * 0.69, width, height * 0.31);
  ctx.fillStyle = "rgba(123, 139, 137, .16)";
  ctx.fillRect(x, y + height * 0.69, width, 2);
  ctx.fillStyle = "rgba(25, 31, 33, .98)";
  ctx.fillRect(x + width * 0.29, y + height * 0.59, width * 0.42, height * 0.035);
  ctx.fillRect(x + width * 0.485, y + height * 0.56, width * 0.03, height * 0.13);

  ctx.strokeStyle = "rgba(156, 177, 173, .2)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + width * (0.18 + i * 0.11), y + height * 0.75);
    ctx.lineTo(x + width * (0.27 + i * 0.08), y + height * 0.79);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(187, 207, 202, .12)";
  ctx.beginPath();
  ctx.moveTo(x + width * 0.82, y + height * 0.58);
  ctx.bezierCurveTo(
    x + width * 0.91,
    y + height * 0.7,
    x + width * 0.75,
    y + height * 0.82,
    x + width * 0.9,
    y + height,
  );
  ctx.stroke();

  ctx.fillStyle = "rgba(12, 16, 18, .9)";
  ctx.beginPath();
  ctx.roundRect(x + width * 0.08, y + height * 0.73, width * 0.13, height * 0.13, 3);
  ctx.fill();
  ctx.strokeStyle = day === 0 ? "rgba(113, 140, 137, .18)" : "rgba(180, 204, 199, .2)";
  ctx.stroke();

  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(116, 150, 146, .026)";
  for (let row = 0; row < 12; row += 1) {
    const scanY = y + mod(row * 47 + t * (8 + day), height);
    ctx.fillRect(x, scanY, width, day === 2 ? 3 : 1);
  }
  ctx.restore();
}

function drawOpticalWindow(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  pointer: { x: number; y: number },
  t: number,
  intensity = 1,
  inverted = false,
) {
  ctx.save();
  roundedPath(ctx, x, y, width, height, 6);
  ctx.clip();
  ctx.translate(x + width / 2, y + height / 2);
  const breathe = 1.02 + Math.sin(t * 0.9) * 0.006;
  ctx.scale(inverted ? -breathe : breathe, inverted ? -breathe : breathe);
  const ox = (pointer.x - 0.5) * source.width * 0.035;
  const oy = (pointer.y - 0.5) * source.height * 0.03;
  ctx.filter = `saturate(${1.22 + intensity * 0.45}) contrast(1.08) brightness(${0.9 + intensity * 0.2})`;
  ctx.globalAlpha = intensity;
  ctx.drawImage(source, -width / 2 - ox - 16, -height / 2 - oy - 12, width + 32, height + 24);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "screen";
  const ca = 2.2 * intensity;
  ctx.globalAlpha = 0.14;
  ctx.drawImage(source, -width / 2 - ox - 16 + ca, -height / 2 - oy - 12, width + 32, height + 24);
  ctx.globalCompositeOperation = "source-over";
  const vignette = ctx.createRadialGradient(0, 0, width * 0.08, 0, 0, width * 0.63);
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(0.72, "rgba(0,0,0,.06)");
  vignette.addColorStop(1, "rgba(0,0,0,.82)");
  ctx.fillStyle = vignette;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.restore();
}

export default function TimeFilm({
  speed,
  paused,
  reducedMotion,
  seekWeek,
  seekToken,
  onSpeedChange,
  onPauseChange,
  onStatus,
}: TimeFilmProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineRef = useRef(4 + 5.35 / 7);
  const pointerRef = useRef({ x: 0.53, y: 0.46 });
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const dragVelocityRef = useRef(0);
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);
  const seekRef = useRef<number | null>(seekWeek);
  const statusRef = useRef(0);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    seekRef.current = seekWeek;
  }, [seekWeek, seekToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const world = document.createElement("canvas");
    const film = document.createElement("canvas");
    const worldCtx = world.getContext("2d");
    const filmCtx = film.getContext("2d");
    if (!worldCtx || !filmCtx) return;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      world.width = canvas.width;
      world.height = canvas.height;
      film.width = canvas.width;
      film.height = canvas.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      worldCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      filmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const draw = (now: number) => {
      canvas.dataset.engine = "drawing";
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const resistance = timeResistance(timelineRef.current);
      const baseWeeksPerSecond = reducedMotion ? 0.025 : 0.2;
      if (seekRef.current !== null) {
        const delta = mod(seekRef.current - timelineRef.current + 26, 52) - 26;
        if (Math.abs(delta) < 0.012) {
          timelineRef.current = seekRef.current;
          seekRef.current = null;
        } else {
          timelineRef.current = mod(timelineRef.current + delta * Math.min(1, dt * 11), 52);
        }
      } else if (!pausedRef.current && !draggingRef.current) {
        timelineRef.current = mod(
          timelineRef.current + dt * baseWeeksPerSecond * speedRef.current * resistance + dragVelocityRef.current * dt,
          52,
        );
        dragVelocityRef.current *= Math.pow(0.07, dt);
      }

      const week = timelineRef.current;
      const t = now / 1000;

      worldCtx.setTransform(1, 0, 0, 1, 0, 0);
      worldCtx.clearRect(0, 0, world.width, world.height);
      worldCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWorld(worldCtx, width, height, t, week, pointerRef.current);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      ctx.filter = "saturate(.42) contrast(.9) brightness(.34) blur(1.1px)";
      ctx.drawImage(world, 0, 0, width, height);
      ctx.restore();

      const filmTop = height * 0.105;
      const filmHeight = height * 0.79;
      const innerTop = filmTop + Math.max(62, height * 0.105);
      const innerHeight = filmHeight - Math.max(124, height * 0.21);
      const frameWidth = width / 6.08;
      const globalDay = week * 7;
      const dayFloor = Math.floor(globalDay);
      const dayFraction = globalDay - dayFloor;
      const centerX = width * 0.5;
      const visibleFrames: Array<{ x: number; day: number; dayOfWeek: number; frameWeek: number; weekend: boolean }> = [];

      for (let offset = -5; offset <= 5; offset += 1) {
        const day = dayFloor + offset;
        const dayOfWeek = mod(day, 7);
        const x = centerX + (offset - dayFraction) * frameWidth;
        visibleFrames.push({
          x,
          day,
          dayOfWeek,
          frameWeek: mod(Math.floor(day / 7), 52),
          weekend: dayOfWeek >= 5,
        });
      }

      visibleFrames.forEach((cell) => {
        if (!cell.weekend || cell.x + frameWidth < 0 || cell.x > width) return;
        const inset = frameWidth * 0.055;
        drawOpticalWindow(
          ctx,
          world,
          cell.x + inset,
          innerTop,
          frameWidth - inset * 2,
          innerHeight,
          pointerRef.current,
          t + cell.frameWeek * 0.13,
          cell.dayOfWeek === 5 ? 1 : 0.88,
          cell.dayOfWeek === 6 && cell.frameWeek % 17 === 0,
        );
      });

      const hoveredFrame = visibleFrames.find(
        (cell) => pointerRef.current.x * width >= cell.x && pointerRef.current.x * width < cell.x + frameWidth,
      );
      const leakPulse = 0.5 + 0.5 * Math.sin(t * 0.7 + week * 1.77);
      if (hoveredFrame && !hoveredFrame.weekend) {
        const cx = pointerRef.current.x * width;
        const cy = clamp(pointerRef.current.y * height, innerTop + 30, innerTop + innerHeight - 30);
        const radius = 30 + leakPulse * 21;
        ctx.save();
        const inset = frameWidth * 0.055;
        roundedPath(ctx, hoveredFrame.x + inset, innerTop, frameWidth - inset * 2, innerHeight, 6);
        ctx.clip();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.filter = "grayscale(.5) saturate(.48) contrast(1.08) brightness(.82) blur(.25px)";
        ctx.globalAlpha = 0.9;
        ctx.drawImage(world, 0, 0, width, height);
        ctx.restore();
        ctx.save();
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.5);
        glow.addColorStop(0, "rgba(193, 219, 212, .22)");
        glow.addColorStop(0.5, "rgba(165, 194, 189, .08)");
        glow.addColorStop(1, "rgba(255, 100, 60, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(cx - radius * 3, cy - radius * 3, radius * 6, radius * 6);
        ctx.restore();
      }

      filmCtx.setTransform(1, 0, 0, 1, 0, 0);
      filmCtx.clearRect(0, 0, film.width, film.height);
      filmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const filmGradient = filmCtx.createLinearGradient(0, filmTop, 0, filmTop + filmHeight);
      filmGradient.addColorStop(0, "rgba(11, 13, 17, .92)");
      filmGradient.addColorStop(0.14, "rgba(19, 20, 24, .96)");
      filmGradient.addColorStop(0.52, "rgba(5, 7, 10, .94)");
      filmGradient.addColorStop(0.85, "rgba(21, 20, 23, .97)");
      filmGradient.addColorStop(1, "rgba(6, 8, 11, .94)");
      filmCtx.fillStyle = filmGradient;
      filmCtx.fillRect(0, filmTop, width, filmHeight);

      filmCtx.globalCompositeOperation = "destination-out";
      visibleFrames.forEach((cell) => {
        if (!cell.weekend) return;
        const inset = frameWidth * 0.055;
        roundedPath(filmCtx, cell.x + inset, innerTop, frameWidth - inset * 2, innerHeight, 6);
        filmCtx.fill();
      });
      for (let x = -20; x < width + 30; x += Math.max(34, frameWidth * 0.2)) {
        roundedPath(filmCtx, x, filmTop + 17, 18, 24, 5);
        filmCtx.fill();
        roundedPath(filmCtx, x, filmTop + filmHeight - 41, 18, 24, 5);
        filmCtx.fill();
      }
      filmCtx.globalCompositeOperation = "source-over";

      visibleFrames.forEach((cell) => {
        const inset = frameWidth * 0.055;
        const active = Math.abs(cell.x + frameWidth / 2 - centerX) < frameWidth * 0.55;
        filmCtx.strokeStyle = cell.weekend ? "rgba(255, 218, 138, .42)" : "rgba(198, 219, 218, .13)";
        filmCtx.lineWidth = cell.weekend ? 1.35 : 0.8;
        roundedPath(filmCtx, cell.x + inset, innerTop, frameWidth - inset * 2, innerHeight, 6);
        filmCtx.stroke();
        if (!cell.weekend) {
          const weekdayShade = filmCtx.createLinearGradient(cell.x, innerTop, cell.x + frameWidth, innerTop + innerHeight);
          const shades = [
            ["rgba(2,4,7,.78)", "rgba(31,38,45,.7)"],
            ["rgba(10,14,19,.72)", "rgba(44,33,41,.76)"],
            ["rgba(6,10,15,.8)", "rgba(18,40,44,.68)"],
            ["rgba(14,9,18,.76)", "rgba(51,31,43,.68)"],
            ["rgba(8,9,14,.7)", "rgba(72,44,35,.58)"],
          ][cell.dayOfWeek];
          weekdayShade.addColorStop(0, shades[0]);
          weekdayShade.addColorStop(1, shades[1]);
          filmCtx.fillStyle = weekdayShade;
          roundedPath(filmCtx, cell.x + inset, innerTop, frameWidth - inset * 2, innerHeight, 6);
          filmCtx.fill();
          drawWorkstation(
            filmCtx,
            cell.x + inset,
            innerTop,
            frameWidth - inset * 2,
            innerHeight,
            t + cell.frameWeek * 0.17,
            cell.dayOfWeek,
          );
          filmCtx.save();
          roundedPath(filmCtx, cell.x + inset, innerTop, frameWidth - inset * 2, innerHeight, 6);
          filmCtx.clip();
          const scanCount = cell.dayOfWeek === 2 ? 13 : 7;
          for (let s = 0; s < scanCount; s += 1) {
            const y = innerTop + mod(s * 43 + t * (7 + cell.dayOfWeek * 3), innerHeight);
            filmCtx.fillStyle = cell.dayOfWeek === 4 ? "rgba(255,112,74,.055)" : "rgba(190,230,232,.035)";
            filmCtx.fillRect(cell.x + inset, y, frameWidth - inset * 2, cell.dayOfWeek === 2 ? 4 : 1);
          }
          filmCtx.restore();
        }
        filmCtx.font = `${active ? 600 : 500} ${Math.max(9, width * 0.008)}px "IBM Plex Mono", monospace`;
        filmCtx.letterSpacing = "0.16em";
        filmCtx.fillStyle = cell.weekend
          ? active
            ? "rgba(255, 230, 184, .95)"
            : "rgba(255, 224, 171, .68)"
          : active
            ? "rgba(210, 224, 223, .68)"
            : "rgba(180, 195, 196, .38)";
        filmCtx.fillText(DAYS[cell.dayOfWeek], cell.x + inset + 9, innerTop - 19);
        filmCtx.font = `400 ${Math.max(7, width * 0.0063)}px "IBM Plex Mono", monospace`;
        filmCtx.fillStyle = "rgba(168, 187, 187, .28)";
        filmCtx.fillText(`W${String(cell.frameWeek + 1).padStart(2, "0")} · ${String(cell.dayOfWeek + 1).padStart(2, "0")}`, cell.x + inset + 9, innerTop + innerHeight + 28);
      });

      filmCtx.save();
      filmCtx.globalCompositeOperation = "destination-out";
      filmCtx.globalAlpha = 0.09;
      visibleFrames.forEach((cell) => {
        if (cell.weekend) return;
        const inset = frameWidth * 0.055;
        roundedPath(filmCtx, cell.x + inset, innerTop, frameWidth - inset * 2, innerHeight, 6);
        filmCtx.fill();
      });
      filmCtx.restore();

      if (hoveredFrame && !hoveredFrame.weekend) {
        const cx = pointerRef.current.x * width;
        const cy = clamp(pointerRef.current.y * height, innerTop + 30, innerTop + innerHeight - 30);
        const radius = 30 + leakPulse * 21;
        filmCtx.save();
        filmCtx.globalCompositeOperation = "destination-out";
        const aperture = filmCtx.createRadialGradient(cx, cy, radius * 0.34, cx, cy, radius * 1.22);
        aperture.addColorStop(0, "rgba(0, 0, 0, .98)");
        aperture.addColorStop(0.56, "rgba(0, 0, 0, .82)");
        aperture.addColorStop(1, "rgba(0, 0, 0, 0)");
        filmCtx.fillStyle = aperture;
        filmCtx.beginPath();
        filmCtx.arc(cx, cy, radius * 1.24, 0, Math.PI * 2);
        filmCtx.fill();
        filmCtx.restore();
      }

      const oil = filmCtx.createLinearGradient(0, filmTop, width, filmTop + filmHeight);
      oil.addColorStop(0, "rgba(87, 255, 218, 0)");
      oil.addColorStop(0.28 + Math.sin(t * 0.05) * 0.05, "rgba(65, 195, 207, .055)");
      oil.addColorStop(0.48, "rgba(255, 78, 130, .035)");
      oil.addColorStop(0.72, "rgba(255, 198, 79, .045)");
      oil.addColorStop(1, "rgba(87, 255, 218, 0)");
      filmCtx.fillStyle = oil;
      filmCtx.fillRect(0, filmTop, width, filmHeight);
      filmCtx.strokeStyle = "rgba(211, 236, 232, .16)";
      filmCtx.lineWidth = 1;
      filmCtx.beginPath();
      filmCtx.moveTo(0, filmTop);
      filmCtx.lineTo(width, filmTop + Math.sin(t * 0.32) * 2);
      filmCtx.moveTo(0, filmTop + filmHeight);
      filmCtx.lineTo(width, filmTop + filmHeight + Math.sin(t * 0.27) * 2);
      filmCtx.stroke();

      ctx.drawImage(film, 0, 0, width, height);

      visibleFrames.forEach((cell) => {
        if (!cell.weekend || cell.x + frameWidth < 0 || cell.x > width) return;
        const cx = cell.x + frameWidth / 2;
        const cy = innerTop + innerHeight / 2;
        const glow = ctx.createRadialGradient(cx, cy, frameWidth * 0.08, cx, cy, frameWidth * 0.72);
        glow.addColorStop(0, "rgba(255, 187, 90, .08)");
        glow.addColorStop(0.55, "rgba(255, 97, 53, .055)");
        glow.addColorStop(1, "rgba(255, 65, 45, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(cell.x - frameWidth * 0.4, innerTop - 80, frameWidth * 1.8, innerHeight + 160);
      });

      const marker = currentMarker(week);
      if (marker) {
        const pulse = 0.55 + Math.sin(t * 2.2) * 0.18;
        ctx.save();
        ctx.font = `500 ${Math.max(8, width * 0.0068)}px "IBM Plex Mono", monospace`;
        ctx.letterSpacing = "0.2em";
        ctx.fillStyle = `rgba(255, 211, 147, ${pulse})`;
        ctx.fillText(marker.code, width * 0.5 - ctx.measureText(marker.code).width / 2, filmTop + 35);
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = "rgba(255, 235, 205, .18)";
      ctx.lineWidth = 0.7;
      ctx.setLineDash([2, 8]);
      ctx.beginPath();
      ctx.moveTo(centerX, filmTop - 18);
      ctx.lineTo(centerX, filmTop + filmHeight + 18);
      ctx.stroke();
      ctx.restore();

      if (now - statusRef.current > 160) {
        statusRef.current = now;
        const day = Math.floor(mod(globalDay, 7));
        const season = seasonState(week).key;
        onStatus({
          season: SEASON_CN[season],
          week: Math.floor(week) + 1,
          day: DAYS[day],
          speed: speedRef.current * resistance,
          marker: marker?.name,
        });
      }

      frame = requestAnimationFrame(draw);
    };

    // Paint synchronously once so the artwork is never delivered as an empty
    // canvas while the browser is waiting for its first animation frame.
    draw(performance.now());

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [onStatus, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="time-film-canvas"
      aria-label="一条滚动的胶卷遮住不断变化的四季世界，只有周末窗口透出清晰色彩"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointerRef.current = {
          x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
          y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        };
        if (draggingRef.current) {
          const dx = event.clientX - lastXRef.current;
          timelineRef.current = mod(timelineRef.current - (dx / rect.width) * 2.8, 52);
          dragVelocityRef.current = -(dx / rect.width) * 16;
          lastXRef.current = event.clientX;
        }
      }}
      onPointerDown={(event) => {
        draggingRef.current = true;
        lastXRef.current = event.clientX;
        event.currentTarget.setPointerCapture(event.pointerId);
        onPauseChange(true);
      }}
      onPointerUp={(event) => {
        draggingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
        window.setTimeout(() => onPauseChange(false), 140);
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
        onPauseChange(false);
      }}
      onWheel={(event) => {
        event.preventDefault();
        const factor = event.deltaY > 0 ? 1.18 : 0.84;
        onSpeedChange(clamp(speedRef.current * factor, 0.25, 8));
      }}
    />
  );
}
