import { alphaColor, clamp, mod, seasonState, smooth } from "./aperture-world";

type Ctx = CanvasRenderingContext2D;
export type WorldView = { travel?: number; year?: number; focus?: string };
const TAU = Math.PI * 2;
const random = (n: number) => mod(Math.sin(n * 127.1 + 311.7) * 43758.5453, 1);
const points = (count: number, seed: number) =>
  Array.from({ length: count }, (_, i) => ({
    x: random(i + seed),
    y: random(i * 3 + seed + 21),
    z: random(i * 7 + seed + 93),
  }));
const dust = points(90, 50),
  leaves = points(760, 600),
  rain = points(120, 310),
  snow = points(95, 713);

function glow(
  c: Ctx,
  x: number,
  y: number,
  radius: number,
  color: string,
  opacity: number
) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, alphaColor(color, opacity));
  g.addColorStop(0.2, alphaColor(color, opacity * 0.36));
  g.addColorStop(1, alphaColor(color, 0));
  c.fillStyle = g;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
function line(
  c: Ctx,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string,
  width: number
) {
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x2, y2);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function leaf(
  c: Ctx,
  x: number,
  y: number,
  size: number,
  angle: number,
  color: string,
  turn: number,
  veins = false
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(0.38 + 0.62 * Math.abs(turn), 1);
  c.beginPath();
  c.moveTo(0, -size);
  c.bezierCurveTo(
    size * 0.8,
    -size * 0.5,
    size * 0.68,
    size * 0.3,
    0,
    size * 0.65
  );
  c.bezierCurveTo(
    -size * 0.58,
    size * 0.16,
    -size * 0.57,
    -size * 0.58,
    0,
    -size
  );
  c.fillStyle = color;
  c.fill();
  if (veins) {
    line(c, 0, -size * 0.87, 0, size * 0.62, "rgba(244,240,167,.64)", 0.7);
    for (let i = 0; i < 4; i++) {
      const y = -size * 0.55 + i * size * 0.24;
      line(c, 0, y, size * 0.35, y - size * 0.23, "rgba(243,241,174,.35)", 0.5);
      line(c, 0, y, -size * 0.31, y - size * 0.19, "rgba(243,241,174,.3)", 0.5);
    }
    c.strokeStyle = "rgba(237,249,158,.55)";
    c.lineWidth = 0.65;
    c.stroke();
  }
  c.restore();
}

// All apertures sample this geography. Travelling changes layer positions and occlusion,
// letting the camera pass the room and near tree while distant land barely moves.
export function drawWorld(
  c: Ctx,
  width: number,
  height: number,
  t: number,
  week: number,
  pointer: { x: number; y: number },
  rainy: boolean | number = false,
  view: WorldView = {}
) {
  const { palette: p, foliage, winter, autumn, key } = seasonState(week);
  const wet = typeof rainy === "boolean" ? Number(rainy) : rainy;
  const flight = smooth(view.travel ?? 0),
    year = view.year ?? 0;
  c.clearRect(0, 0, width, height);
  c.save();
  c.scale(width / 1440, height / 1080);
  const w = 1440,
    h = 1080;
  const wind = Math.sin(t * 0.27) + Math.sin(t * 0.73) * 0.24;
  const px = (pointer.x - 0.5) * 14,
    py = (pointer.y - 0.5) * 8;
  const sky = c.createLinearGradient(0, 0, 0, h * 0.73);
  sky.addColorStop(0, p.top);
  sky.addColorStop(0.47, p.bottom);
  sky.addColorStop(1, p.horizon);
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  const sunX = 1120 + Math.sin(week * 0.19) * 26,
    sunY = 270 + Math.cos(week * 0.2) * 34;
  glow(c, sunX, sunY, 360, p.horizon, 0.49 - wet * 0.2);
  glow(c, sunX, sunY, 95, "#ffdcb0", 0.33 - wet * 0.15);
  c.fillStyle = alphaColor("#fff0cc", 0.74 - wet * 0.36);
  c.beginPath();
  c.arc(sunX, sunY, 22, 0, TAU);
  c.fill();
  // Clouds have broad soft edges, internal streaks and independent wind speeds.
  for (let layer = 0; layer < 5; layer++) {
    const x = mod(layer * 359 + t * (2 + layer * 0.7), 1900) - 240;
    c.save();
    c.translate(x, 115 + layer * 64 + Math.sin(t * 0.035 + layer) * 12);
    c.scale(1, 0.13 + layer * 0.014);
    glow(
      c,
      0,
      0,
      230 + layer * 23,
      layer % 2 ? p.horizon : "#dce9e1",
      0.1 + wet * 0.025
    );
    c.restore();
  }
  dust.forEach((d, i) => {
    if (d.y > 0.52) return;
    c.globalAlpha =
      (0.15 + 0.24 * winter) * (Math.sin(t * 0.3 + i) * 0.25 + 0.75);
    c.fillStyle = "#ecf0df";
    c.fillRect(d.x * w, d.y * 500, 1 + d.z, 1 + d.z);
  });
  c.globalAlpha = 1;
  // Atmospheric perspective: each ridge has its own continuous profile.
  for (let k = 0; k < 5; k++) {
    c.beginPath();
    c.moveTo(-20, 740);
    for (let x = -20; x <= 1460; x += 10) {
      const n = x / w;
      const y =
        430 +
        k * 43 +
        Math.sin(n * 8 + k * 1.5) * 42 +
        Math.sin(n * 17 + k * 0.6) * 20 +
        Math.sin(n * 31 + k) * 6;
      c.lineTo(x + px * (0.1 + k * 0.06) - flight * k * 8, y + flight * k * 3);
    }
    c.lineTo(1460, 750);
    c.closePath();
    c.fillStyle = alphaColor(k < 2 ? p.horizon : p.top, 0.2 + k * 0.115);
    c.fill();
  }
  for (let i = 0; i < 4; i++) {
    c.save();
    c.translate(750, 520 + i * 38);
    c.scale(1, 0.05);
    glow(c, 0, 0, 900, p.horizon, 0.075);
    c.restore();
  }
  // The far city sits on a continuous shoreline. Its train crosses, and light spills on the bay.
  const trainPhase = mod(t * 0.018, 1.25),
    trainX = 480 + trainPhase * 1030;
  c.save();
  c.translate(px * 0.35 - flight * 24, flight * 10);
  for (let i = 0; i < 50; i++) {
    const x = 490 + i * 20,
      bh = 12 + random(i + 31) * 67;
    c.fillStyle = alphaColor("#13292d", 0.62 + random(i) * 0.3);
    c.fillRect(x, 654 - bh, 12 + random(i + 9) * 11, bh);
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        if (random(i * 19 + a * 7 + b) > 0.48) {
          const lit = 0.26 + 0.3 * smooth(Math.sin(t * 0.021 + i * 2));
          c.fillStyle = alphaColor(a === 1 ? "#ffbe70" : "#e3e4b1", lit);
          c.fillRect(x + 3 + a * 4, 657 - bh + b * 11, 1.6, 2.4);
        }
  }
  c.fillStyle = "#173133";
  c.beginPath();
  c.moveTo(440, 655);
  c.bezierCurveTo(780, 637, 1080, 672, 1440, 641);
  c.lineTo(1440, 674);
  c.lineTo(440, 674);
  c.fill();
  line(c, 490, 643, 1440, 643, "rgba(188,184,133,.22)", 1);
  for (let i = 0; i < 6; i++) {
    c.fillStyle = "#9d876c";
    c.fillRect(trainX + i * 14, 637, 13, 6);
    c.fillStyle = "#ffcb83";
    c.fillRect(trainX + i * 14 + 2, 638, 8, 2);
  }
  glow(c, trainX + 80, 640, 25, "#ffc674", 0.34);
  c.restore();
  // True reflected silhouettes, softened by moving bands and scattered wave highlights.
  const waterY = 670;
  c.save();
  c.beginPath();
  c.rect(0, waterY, w, h - waterY);
  c.clip();
  c.translate(0, waterY * 2);
  c.scale(1, -1);
  c.globalAlpha = 0.5;
  c.drawImage(c.canvas, 0, 0, width, height * (waterY / h), 0, 0, w, waterY);
  c.restore();
  const water = c.createLinearGradient(0, waterY, 0, h);
  water.addColorStop(0, alphaColor(p.water, 0.3));
  water.addColorStop(0.48, alphaColor(p.water, 0.78));
  water.addColorStop(1, "#071c23");
  c.fillStyle = water;
  c.fillRect(0, waterY, w, h - waterY);
  for (let i = 0; i < 145; i++) {
    const d = dust[i % 90],
      depth = (i + 0.5) / 145,
      y = waterY + depth * 410;
    const x = mod(d.x * w + t * (1 + depth * 5) * (i % 2 ? 1 : -1), w),
      len = 4 + depth * 28;
    line(
      c,
      x,
      y,
      x + len,
      y + Math.sin(t * 0.6 + i) * 0.6,
      alphaColor(i % 5 === 0 ? p.horizon : p.leaf, 0.035 + depth * 0.1),
      0.4 + depth * 0.7
    );
  }
  for (let i = 0; i < 100; i++) {
    const depth = i / 100,
      x = sunX + Math.sin(i * 33.1) * depth * 150 + Math.sin(t * 0.45 + i) * 6;
    c.fillStyle = alphaColor(
      "#ffd4a0",
      (0.06 + 0.18 * Math.sin(t * 0.6 + i) ** 2) * (1 - wet * 0.4)
    );
    c.fillRect(
      x,
      waterY + depth * 380,
      2 + random(i) * depth * 29,
      0.7 + depth * 1.1
    );
  }
  // One boat drifts slowly across the same reflected sky.
  const boatX = 810 + Math.sin(t * 0.023 + year) * 140,
    boatY = 721 + Math.sin(t * 0.4) * 1.5;
  c.fillStyle = "#152c32";
  c.beginPath();
  c.moveTo(boatX - 13, boatY);
  c.quadraticCurveTo(boatX, boatY + 12, boatX + 15, boatY);
  c.fill();
  line(c, boatX, boatY, boatX, boatY - 34, "#345159", 1);
  c.fillStyle = alphaColor("#e7d7b9", 0.8);
  c.beginPath();
  c.moveTo(boatX - 1, boatY - 34);
  c.lineTo(boatX - 1, boatY - 4);
  c.lineTo(boatX - 18, boatY - 4);
  c.fill();
  // A rooted, winding bank separates water, garden and room.
  c.save();
  c.translate(-flight * 650 + px * 0.9, flight * 370);
  const earth = c.createLinearGradient(0, 730, 0, h);
  earth.addColorStop(0, "#263a32");
  earth.addColorStop(0.3, "#142c27");
  earth.addColorStop(1, "#081a1b");
  c.fillStyle = earth;
  c.beginPath();
  c.moveTo(0, 709);
  c.bezierCurveTo(420, 706, 545, 780, 868, 838);
  c.bezierCurveTo(775, 868, 805, 917, 1050, 1080);
  c.lineTo(0, h);
  c.fill();
  c.strokeStyle = alphaColor(p.horizon, 0.23);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, 709);
  c.bezierCurveTo(420, 706, 545, 780, 868, 838);
  c.stroke();
  for (let i = 0; i < 130; i++) {
    const x = random(i + 9) * 770,
      y = 755 + random(i + 37) * 300;
    line(
      c,
      x,
      y,
      x + Math.sin(t * 0.7 + i) * 3,
      y - 4 - random(i) * 16,
      alphaColor(p.leaf, 0.09 + random(i + 4) * 0.15),
      0.8
    );
  }
  drawTree(
    c,
    792,
    830,
    t,
    wind,
    p.leaf,
    p.horizon,
    p.glow,
    foliage,
    winter,
    autumn
  );
  // A small walking figure gives the landscape a human scale, never a protagonist.
  const walker = 440 + Math.sin(t * 0.018) * 80;
  c.fillStyle = "#122328";
  c.beginPath();
  c.arc(walker, 760, 3, 0, TAU);
  c.fill();
  c.fillRect(walker - 2, 763, 4, 9);
  for (let i = 0; i < 2; i++)
    line(
      c,
      walker,
      772,
      walker + Math.sin(t * 2.4 + i * Math.PI) * 3,
      778,
      "#14252a",
      1.5
    );
  c.restore();
  // Flocks have a destination and briefly cross the close-view windows.
  for (let i = 0; i < 5; i++) {
    const x = mod(t * 13 + i * 24 + year * 113, 1780) - 160,
      y = 280 + Math.sin(i * 0.9) * 22 + Math.sin(t * 0.4 + i) * 3;
    const flap = Math.sin(t * 4 + i) * 3;
    c.strokeStyle = "rgba(17,37,44,.58)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x - 5, y - flap);
    c.quadraticCurveTo(x - 2, y - 2, x, y);
    c.quadraticCurveTo(x + 2, y - 2, x + 5, y - flap);
    c.stroke();
  }
  // Close focus lets the distant branches dissolve while the leaf/rain remains tactile.
  if (["bloom", "glass", "ember"].includes(view.focus ?? "") && flight < 0.1) {
    c.save();
    c.filter = `blur(${((view.focus === "bloom" ? 3.5 : 1.5) * width) / 1440}px)`;
    c.drawImage(c.canvas, 0, 0, width, height, 0, 0, w, h);
    c.restore();
  }
  // A near branch: the leaf, its veins and a suspended drop make spring tactile.
  c.save();
  c.translate(px * 1.3 - flight * 530, py + flight * 130);
  c.globalAlpha = 1 - smooth(flight * 1.4);
  drawNearBranch(c, t, wind, p.leaf, p.horizon, foliage, winter, autumn);
  c.restore();
  // Weather weights crossfade; snow and rain can coexist during the thaw.
  c.save();
  rain.forEach((d, i) => {
    const x = mod(d.x * w + t * (18 + wind * 4), w),
      y = mod(d.y * h + t * (180 + d.z * 150), h);
    line(
      c,
      x,
      y,
      x - 3 - wind * 2,
      y + 9 + d.z * 12,
      alphaColor("#cbe0da", wet * (1 - winter) * (0.1 + d.z * 0.19)),
      0.5 + d.z * 0.45
    );
  });
  snow.forEach((d, i) => {
    c.fillStyle = alphaColor("#edf4ef", winter * (0.22 + d.z * 0.36));
    c.beginPath();
    c.ellipse(
      mod(d.x * w + t * 7 + Math.sin(t * 0.6 + i) * 8, w),
      mod(d.y * h + t * (12 + d.z * 15), h),
      0.8 + d.z * 1.8,
      0.8 + d.z * 1.4,
      0,
      0,
      TAU
    );
    c.fill();
  });
  if (key === "summer")
    for (let i = 0; i < 16; i++) {
      const d = dust[i];
      glow(
        c,
        d.x * w,
        600 + d.y * 300 + Math.sin(t * 0.7 + i) * 11,
        5,
        "#e5e58a",
        0.2 * Math.sin(t * 0.8 + i) ** 2
      );
    }
  c.restore();
  c.save();
  c.translate(-flight * 900 + px * 1.8, flight * 190 + py * 1.5);
  c.globalAlpha = 1 - smooth(flight * 1.1);
  drawRoom(c, t, wind, wet, winter);
  c.restore();
  // Fine drifting dust catches the light in front of the lens.
  dust.slice(0, 32).forEach((d, i) => {
    c.fillStyle = alphaColor(
      "#ffe6b0",
      0.09 + 0.09 * Math.sin(t * 0.5 + i) ** 2
    );
    c.beginPath();
    c.arc(
      mod(d.x * w + t * (1 + d.z), w),
      mod(d.y * h - t * (2 + d.z), h),
      0.4 + d.z,
      0,
      TAU
    );
    c.fill();
  });
  const shade = c.createRadialGradient(780, 510, 260, 780, 510, 980);
  shade.addColorStop(0, "transparent");
  shade.addColorStop(1, "rgba(0,9,15,.4)");
  c.fillStyle = shade;
  c.fillRect(0, 0, w, h);
  c.restore();
}

function drawTree(
  c: Ctx,
  x: number,
  y: number,
  t: number,
  wind: number,
  green: string,
  pink: string,
  warm: string,
  density: number,
  winter: number,
  autumn: number
) {
  c.save();
  c.translate(x, y);
  c.lineCap = "round";
  const tips: { x: number; y: number; s: number }[] = [];
  function branch(
    bx: number,
    by: number,
    len: number,
    a: number,
    depth: number,
    seed: number
  ) {
    const sway = wind * 0.013 * (6 - depth),
      angle = a + sway;
    const ex = bx + Math.cos(angle) * len,
      ey = by + Math.sin(angle) * len;
    c.beginPath();
    c.moveTo(bx, by);
    c.bezierCurveTo(
      bx + Math.cos(angle - 0.22) * len * 0.42,
      by + Math.sin(angle - 0.22) * len * 0.42,
      ex + 8 * Math.sin(seed),
      ey + len * 0.16,
      ex,
      ey
    );
    c.lineWidth = Math.max(0.65, depth * depth * 0.68);
    c.strokeStyle = depth > 3 ? "#24302a" : "#354333";
    c.stroke();
    if (depth > 3) {
      c.lineWidth = 1;
      c.strokeStyle = "rgba(224,181,116,.17)";
      c.stroke();
    }
    if (depth <= 1) {
      tips.push({ x: ex, y: ey, s: seed });
      return;
    }
    branch(
      ex,
      ey,
      len * (0.67 + random(seed) * 0.09),
      angle - 0.34 - random(seed + 5) * 0.28,
      depth - 1,
      seed * 2 + 1
    );
    branch(
      ex,
      ey,
      len * (0.63 + random(seed + 3) * 0.13),
      angle + 0.24 + random(seed + 9) * 0.32,
      depth - 1,
      seed * 2 + 2
    );
    if (depth === 3)
      branch(ex, ey, len * 0.59, angle + 0.04, depth - 1, seed * 2 + 13);
  }
  branch(0, 0, 153, -1.78, 6, 7);
  const count = leaves.length * density;
  for (let i = 0; i < count; i++) {
    const d = leaves[i],
      tip = tips[i % tips.length],
      spread = 16 + d.z * 42;
    const x = tip.x + Math.cos(d.x * TAU) * spread + wind * d.z * 3,
      y = tip.y + Math.sin(d.x * TAU) * spread * 0.72;
    const fade = clamp(count - i, 0, 1);
    c.globalAlpha = fade * (0.43 + d.z * 0.5);
    const color = i % 9 === 0 ? pink : i % 13 === 0 ? warm : green;
    leaf(
      c,
      x,
      y,
      2.6 + d.z * 6,
      d.x * TAU + wind * 0.1,
      color,
      Math.cos(t * 0.6 + i)
    );
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 16; i++) {
    const d = leaves[i * 7],
      fall = mod(t * (15 + d.z * 12) + i * 27, 340),
      tip = tips[i % tips.length];
    c.globalAlpha = autumn * (1 - smooth((fall - 250) / 90));
    leaf(
      c,
      tip.x + Math.sin(fall * 0.025 + i) * 45 + fall * 0.15,
      tip.y + fall,
      4 + d.z * 3,
      fall * 0.022,
      green,
      Math.sin(t + i)
    );
  }
  c.globalAlpha = 1;
  if (winter > 0.01)
    tips.forEach(tip => {
      c.fillStyle = alphaColor("#d2e0db", winter * 0.7);
      c.beginPath();
      c.ellipse(tip.x, tip.y - 1, 4, 1.2, -0.2, 0, TAU);
      c.fill();
    });
  c.restore();
}

function drawNearBranch(
  c: Ctx,
  t: number,
  wind: number,
  green: string,
  pink: string,
  density: number,
  winter: number,
  autumn: number
) {
  c.save();
  const opacity = c.globalAlpha;
  const bend = wind * 3;
  c.strokeStyle = "#394b32";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(380, 530);
  c.bezierCurveTo(510, 481, 570, 430 + bend, 782, 396 + bend);
  c.stroke();
  const positions = [
    [633, 449, -0.6, 24],
    [684, 424, 0.55, 31],
    [724, 432, 1.1, 21],
    [766, 396, -0.4, 19],
    [592, 478, 0.8, 21],
  ];
  positions.forEach(([x, y, a, s], i) => {
    line(c, x - 14, y + 13, x, y, "#617442", 1.2);
    c.globalAlpha = opacity * (0.3 + 0.7 * smooth(density * 2));
    leaf(
      c,
      x,
      y + bend,
      s * (0.48 + density * 0.65),
      a + Math.sin(t * 0.43 + i) * 0.18,
      i === 2 ? pink : green,
      Math.cos(t * 0.35 + i * 0.5),
      true
    );
    c.globalAlpha = opacity;
  });
  // A drop gathers on a leaf tip, falls, and is gradually replaced.
  const phase = mod(t + 4, 15),
    fall = smooth((phase - 10) / 1.5);
  if (phase < 11.5) {
    const x = 689 + Math.sin(t * 0.4) * 2,
      y = 449 + bend + fall * 170;
    const radius = 2 + smooth(phase / 9) * 2;
    c.fillStyle = "rgba(181,222,213,.68)";
    c.beginPath();
    c.ellipse(x, y, radius * (1 - fall * 0.5), radius * 1.5, 0, 0, TAU);
    c.fill();
    glow(c, x - 1, y - 2, 4, "#faffdb", 0.8);
  }
  if (winter > 0.1) {
    line(c, 620, 448, 744, 407, alphaColor("#d8e8df", winter * 0.6), 1);
  }
  c.restore();
}

function drawRoom(c: Ctx, t: number, wind: number, wet: number, frost: number) {
  const shadow = c.createLinearGradient(0, 0, 650, 0);
  shadow.addColorStop(0, "rgba(4,14,20,.97)");
  shadow.addColorStop(0.35, "rgba(5,17,23,.70)");
  shadow.addColorStop(1, "rgba(5,17,23,0)");
  c.fillStyle = shadow;
  c.fillRect(0, 0, 650, 1080);
  // Recessed window, weathered wood and a pale gauze curtain.
  c.fillStyle = "#0b1a20";
  c.fillRect(150, 0, 23, 974);
  line(c, 174, 0, 174, 977, "rgba(158,180,166,.24)", 2);
  for (let i = 0; i < 14; i++) {
    const x = 172 + i * 7.5;
    c.beginPath();
    c.moveTo(x, 0);
    c.bezierCurveTo(
      x + wind * 6,
      310,
      x + 23 + wind * 15,
      670,
      x - 12 + wind * 8,
      956
    );
    c.strokeStyle = alphaColor("#b4b7a5", 0.018 + (i % 3) * 0.012);
    c.lineWidth = 9;
    c.stroke();
  }
  const sill = c.createLinearGradient(0, 961, 0, 1080);
  sill.addColorStop(0, "#76634a");
  sill.addColorStop(0.035, "#9c7953");
  sill.addColorStop(0.07, "#433b30");
  sill.addColorStop(1, "#101d20");
  c.fillStyle = sill;
  c.beginPath();
  c.moveTo(0, 961);
  c.lineTo(599, 961);
  c.lineTo(653, 1080);
  c.lineTo(0, 1080);
  c.fill();
  for (let i = 0; i < 20; i++)
    line(
      c,
      0,
      968 + i * 4,
      585 + i * 2,
      968 + i * 4,
      "rgba(192,151,102,.045)",
      0.7
    );
  // Lamp partially occluded by the curtain, its warm pool survives rainy days.
  const lx = 489,
    ly = 568;
  glow(c, lx, ly + 18, 135, "#ffa540", 0.52);
  glow(c, lx, ly + 38, 54, "#ffb850", 0.3);
  line(c, lx, ly + 10, lx, 957, "#20252a", 5);
  line(c, lx + 2, ly + 14, lx + 2, 957, "rgba(255,194,112,.3)", 1);
  c.fillStyle = "#1a2829";
  c.beginPath();
  c.ellipse(lx, 958, 31, 5, 0, 0, TAU);
  c.fill();
  const shade = c.createLinearGradient(lx - 30, ly - 42, lx + 30, ly + 8);
  shade.addColorStop(0, "#32352d");
  shade.addColorStop(0.5, "#605039");
  shade.addColorStop(1, "#1b2827");
  c.fillStyle = shade;
  c.beginPath();
  c.moveTo(lx - 17, ly - 42);
  c.lineTo(lx + 17, ly - 42);
  c.lineTo(lx + 37, ly + 6);
  c.quadraticCurveTo(lx, ly + 16, lx - 37, ly + 6);
  c.fill();
  c.fillStyle = "#ffd185";
  c.beginPath();
  c.ellipse(lx, ly + 6, 35, 4, 0, 0, TAU);
  c.fill();
  // Glazed cup and saucer: light lives on the rim and liquid, not every outline.
  const cx = 313,
    cy = 951,
    cw = 66,
    ch = 87;
  c.fillStyle = "rgba(0,8,10,.56)";
  c.beginPath();
  c.ellipse(cx + 36, cy + 8, 57, 11, 0, 0, TAU);
  c.fill();
  c.fillStyle = "#647c72";
  c.beginPath();
  c.ellipse(cx + 32, cy + 3, 49, 8, 0, 0, TAU);
  c.fill();
  c.strokeStyle = "#557b76";
  c.lineWidth = 8;
  c.beginPath();
  c.ellipse(cx + cw + 6, cy - ch * 0.54, 17, 22, -0.12, 0, TAU);
  c.stroke();
  c.strokeStyle = "rgba(216,175,107,.5)";
  c.lineWidth = 1.5;
  c.stroke();
  const glaze = c.createLinearGradient(cx, 0, cx + cw, 0);
  glaze.addColorStop(0, "#213e45");
  glaze.addColorStop(0.23, "#87a99b");
  glaze.addColorStop(0.46, "#476f6a");
  glaze.addColorStop(1, "#142e39");
  c.fillStyle = glaze;
  c.beginPath();
  c.roundRect(cx, cy - ch, cw, ch, [3, 3, 19, 15]);
  c.fill();
  c.fillStyle = "#a9c2a9";
  c.beginPath();
  c.ellipse(cx + cw / 2, cy - ch + 2, cw / 2, 8, 0, 0, TAU);
  c.fill();
  c.fillStyle = "#322921";
  c.beginPath();
  c.ellipse(cx + cw / 2, cy - ch + 2, cw / 2 - 3, 5.6, 0, 0, TAU);
  c.fill();
  c.strokeStyle = "#ffb64e";
  c.lineWidth = 1.8;
  c.beginPath();
  c.ellipse(
    cx + cw / 2,
    cy - ch + 1,
    cw / 2,
    7,
    0,
    Math.PI * 0.95,
    Math.PI * 1.9
  );
  c.stroke();
  glow(c, cx + 24, cy - ch, 55, "#ffbb5a", 0.3);
  const gust = Math.sin(t * 0.28) * 0.5 + Math.sin(t * 0.81) * 0.15;
  for (let strand = 0; strand < 7; strand++) {
    c.beginPath();
    for (let i = 0; i < 32; i++) {
      const p = i / 31,
        x =
          cx +
          cw * 0.48 +
          Math.sin(p * 8 - t * 0.72 + strand * 0.6) * (2 + p * 11) +
          gust * p * p * 48,
        y = cy - ch - 8 - p * 167;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.strokeStyle = alphaColor(
      strand % 2 ? "#e9c8a1" : "#c0d7ca",
      0.035 + Math.sin(t * 0.38 + strand) * 0.015
    );
    c.lineWidth = 2 + strand * 0.65;
    c.stroke();
  }
  // A book edge and moving leaf shadow anchor the cup in an inhabited room.
  c.fillStyle = "#293f41";
  c.beginPath();
  c.moveTo(203, 984);
  c.lineTo(324, 988);
  c.lineTo(343, 1010);
  c.lineTo(208, 1004);
  c.fill();
  line(c, 211, 1000, 335, 1006, "#857c63", 3);
  c.save();
  c.globalAlpha = 0.12;
  c.translate(380 + wind * 7, 967);
  c.scale(1, 0.15);
  leaf(c, 0, 0, 40, 0.6, "#050d11", 1);
  c.restore();
  if (wet > 0.005) drawGlass(c, t, wet);
  if (frost > 0.03) {
    for (let i = 0; i < 38; i++) {
      const x = 182 + random(i) * 427,
        y = 946 - random(i + 20) * 34;
      const len = (14 + random(i + 42) * 40) * frost;
      line(
        c,
        x,
        y,
        x + len * 0.2,
        y - len,
        alphaColor("#d6e7df", frost * 0.23),
        0.65
      );
      for (let j = 1; j < 4; j++) {
        line(
          c,
          x + len * 0.05 * j,
          y - (len * j) / 4,
          x + len * 0.05 * j + len * 0.15,
          y - (len * j) / 4 - len * 0.17,
          alphaColor("#d6e7df", frost * 0.2),
          0.5
        );
      }
    }
  }
}
function drawGlass(c: Ctx, t: number, wet: number) {
  c.save();
  c.beginPath();
  c.rect(180, 0, 444, 959);
  c.clip();
  const mist = c.createLinearGradient(175, 0, 620, 0);
  mist.addColorStop(0, "rgba(154,178,171,.015)");
  mist.addColorStop(0.65, alphaColor("#779ea0", wet * 0.13));
  mist.addColorStop(1, "rgba(154,178,171,0)");
  c.fillStyle = mist;
  c.fillRect(180, 0, 444, 959);
  function drop(x: number, y: number, r: number, trail = 0) {
    if (trail > 0)
      line(c, x, y - trail, x, y, "rgba(215,231,222,.10)", r * 0.35);
    c.fillStyle = alphaColor("#183c45", wet * 0.65);
    c.beginPath();
    c.ellipse(x, y, r, r * 1.4, 0, 0, TAU);
    c.fill();
    c.strokeStyle = alphaColor("#c1d8ce", wet * 0.45);
    c.lineWidth = 0.7;
    c.stroke();
    c.fillStyle = alphaColor("#e9efdc", wet * 0.8);
    c.beginPath();
    c.ellipse(x - r * 0.32, y - r * 0.5, r * 0.2, r * 0.38, -0.3, 0, TAU);
    c.fill();
    // A tiny inverted warm highlight changes as the drop passes the lamp.
    c.fillStyle = alphaColor(
      "#ffcb77",
      wet * Math.max(0.1, 1 - Math.abs(x - 489) / 190) * 0.65
    );
    c.beginPath();
    c.ellipse(x + r * 0.2, y + r * 0.45, r * 0.38, r * 0.18, 0, 0, TAU);
    c.fill();
  }
  rain.slice(0, 53).forEach((d, i) => {
    const phase = mod(t * (0.018 + d.z * 0.013) + d.y, 1),
      slip = smooth((phase - 0.72) / 0.28);
    const x = 188 + d.x * 423,
      y = mod(d.y * 950 + slip * 270, 955);
    drop(x, y, 1 + d.z * 3.3, slip * 16);
  });
  // Two beads gather, touch and become one faster drop. The scene has an event, not only a looped translation.
  const phase = mod(t, 19),
    merge = smooth((phase - 5) / 5),
    fall = smooth((phase - 10) / 5),
    x = 493 + Math.sin(t * 0.07) * 2,
    y = 389 + fall * 430;
  if (phase < 15) {
    drop(x, y, 2.3 + merge * 2, fall * 60);
    if (merge < 0.98) drop(x + 12 * (1 - merge), y - 28 * (1 - merge), 2.5);
  }
  c.restore();
}
