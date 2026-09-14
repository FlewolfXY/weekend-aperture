import { useEffect, useRef } from "react";
import {
  DAYS,
  SEASON_CN,
  mod,
  clamp,
  smooth,
  alphaColor,
  seasonState,
  timeResistance,
  currentMarker,
  roundedPath,
  drawWorld,
} from "@/lib/aperture-world";
import {
  filmGeometry,
  openingCamera,
  shotFor,
  sourceCrop,
  weekdayLeak,
  type Shot,
} from "@/lib/aperture-scenes";

export type WorldStatus = {
  season: string;
  week: number;
  day: string;
  speed: number;
  marker?: string;
  immersed?: boolean;
  caption?: string;
  shot?: string;
  rain?: boolean;
};
type TimeFilmProps = {
  speed: number;
  paused: boolean;
  reducedMotion: boolean;
  seekWeek: number | null;
  seekToken: number;
  returnToken: number;
  onSpeedChange: (value: number) => void;
  onPauseChange: (value: boolean) => void;
  onStatus: (status: WorldStatus) => void;
};
type Cell = {
  x: number;
  day: number;
  dayOfWeek: number;
  frameWeek: number;
  weekend: boolean;
};
type Portal = {
  shot: Shot;
  week: number;
  rect: { x: number; y: number; w: number; h: number };
  progress: number;
  age: number;
  closing: boolean;
};

function paintWindow(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  shot: Shot,
  pointer: { x: number; y: number },
  t: number,
  intensity = 1,
  opening = 0
) {
  ctx.save();
  roundedPath(ctx, x, y, w, h, 6 + opening * 10);
  ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  if (shot.inverted) ctx.rotate(Math.PI * (1 - smooth(opening / 0.65)));
  const camera = openingCamera(shot, opening);
  camera.x += (pointer.x - 0.5) * 0.014 + Math.sin(t * 0.13) * 0.003;
  camera.y += (pointer.y - 0.5) * 0.009;
  const crop = sourceCrop(source.width, source.height, w, h, camera);
  ctx.globalAlpha = intensity;
  ctx.filter = shot.rain
    ? "saturate(.66) contrast(1.1) brightness(1.18)"
    : "saturate(1.42) contrast(1.05) brightness(1.16)";
  // A real source rectangle, with the camera's aspect ratio. Never squeeze a world into a frame.
  ctx.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -w / 2,
    -h / 2,
    w,
    h
  );
  ctx.filter = "none";
  if (opening < 0.8) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.08 * intensity * (1 - opening);
    ctx.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -w / 2 + 1.6,
      -h / 2,
      w,
      h
    );
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.globalAlpha = intensity;
  ctx.scale(w / 2, h / 2);
  const vignette = ctx.createRadialGradient(0, 0, 0.22, 0, 0, 1.4);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.58, "rgba(0,0,0,.04)");
  vignette.addColorStop(1, `rgba(1,4,10,${0.66 - opening * 0.25})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}
function drawWorkstation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  t: number,
  day: number
) {
  ctx.save();
  roundedPath(ctx, x, y, width, height, 6);
  ctx.clip();

  const room = ctx.createLinearGradient(x, y, x + width, y + height);
  room.addColorStop(
    0,
    day === 4 ? "rgba(47, 38, 38, .94)" : "rgba(17, 24, 28, .96)"
  );
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
  const monitor = ctx.createLinearGradient(
    monitorX,
    monitorY,
    monitorX + monitorW,
    monitorY + monitorH
  );
  monitor.addColorStop(0, "rgba(33, 53, 58, .76)");
  monitor.addColorStop(0.45, "rgba(19, 35, 40, .84)");
  monitor.addColorStop(
    1,
    day === 4 ? "rgba(75, 48, 43, .6)" : "rgba(27, 44, 47, .7)"
  );
  ctx.fillStyle = monitor;
  ctx.fillRect(monitorX, monitorY, monitorW, monitorH);

  ctx.fillStyle = "rgba(154, 193, 187, .2)";
  for (let i = 0; i < 9; i += 1) {
    const lineW = monitorW * (0.18 + mod(i * 0.37 + day * 0.11, 1) * 0.63);
    ctx.fillRect(
      monitorX + monitorW * 0.1,
      monitorY + monitorH * (0.13 + i * 0.075),
      lineW,
      1
    );
  }
  const cursor = mod(t * (9 + day * 1.3), monitorW * 0.68);
  ctx.fillStyle =
    day === 4 ? "rgba(255, 148, 96, .34)" : "rgba(171, 224, 215, .38)";
  ctx.fillRect(
    monitorX + monitorW * 0.1 + cursor,
    monitorY + monitorH * 0.85,
    1,
    monitorH * 0.075
  );

  ctx.fillStyle = "rgba(5, 8, 10, .96)";
  ctx.fillRect(x, y + height * 0.69, width, height * 0.31);
  ctx.fillStyle = "rgba(123, 139, 137, .16)";
  ctx.fillRect(x, y + height * 0.69, width, 2);
  ctx.fillStyle = "rgba(25, 31, 33, .98)";
  ctx.fillRect(
    x + width * 0.29,
    y + height * 0.59,
    width * 0.42,
    height * 0.035
  );
  ctx.fillRect(
    x + width * 0.485,
    y + height * 0.56,
    width * 0.03,
    height * 0.13
  );

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
    y + height
  );
  ctx.stroke();

  ctx.fillStyle = "rgba(12, 16, 18, .9)";
  ctx.beginPath();
  ctx.roundRect(
    x + width * 0.08,
    y + height * 0.73,
    width * 0.13,
    height * 0.13,
    3
  );
  ctx.fill();
  ctx.strokeStyle =
    day === 0 ? "rgba(113, 140, 137, .18)" : "rgba(180, 204, 199, .2)";
  ctx.stroke();

  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(116, 150, 146, .026)";
  for (let row = 0; row < 12; row += 1) {
    const scanY = y + mod(row * 47 + t * (8 + day), height);
    ctx.fillRect(x, scanY, width, day === 2 ? 3 : 1);
  }
  ctx.restore();
}

export default function TimeFilm({
  speed,
  paused,
  reducedMotion,
  seekWeek,
  seekToken,
  returnToken,
  onSpeedChange,
  onPauseChange,
  onStatus,
}: TimeFilmProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef(4 + 5.35 / 7);
  const pointerRef = useRef({ x: 0.5, y: 0.5, active: false });
  const dragRef = useRef({
    down: false,
    startX: 0,
    lastX: 0,
    moved: 0,
    at: 0,
    velocity: 0,
    day: -1,
  });
  const speedRef = useRef(speed),
    pausedRef = useRef(paused);
  const seekRef = useRef<number | null>(seekWeek);
  const portalRef = useRef<Portal | null>(null);
  const cellsRef = useRef<Cell[]>([]);
  const openRef = useRef<(cell: Cell) => void>(() => {});
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    seekRef.current = seekWeek;
    dragRef.current.velocity = 0;
    if (portalRef.current) portalRef.current.closing = true;
  }, [seekWeek, seekToken]);
  useEffect(() => {
    if (portalRef.current) portalRef.current.closing = true;
  }, [returnToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const world = document.createElement("canvas"),
      film = document.createElement("canvas"),
      memory = document.createElement("canvas"),
      backdrop = document.createElement("canvas");
    const worldCtx = world.getContext("2d"),
      filmCtx = film.getContext("2d"),
      memoryCtx = memory.getContext("2d"),
      backCtx = backdrop.getContext("2d");
    if (!worldCtx || !filmCtx || !memoryCtx || !backCtx) return;
    world.width = 1440;
    world.height = 1080;
    let width = 1,
      height = 1,
      dpr = 1,
      frame = 0,
      last = performance.now(),
      elapsed = 0,
      lastWorld = -100,
      statusAt = 0;
    let dwellDay = -1,
      dwell = 0,
      lastOpenedDay = -1,
      visible = !document.hidden;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 1.75);
      for (const target of [canvas, film, memory]) {
        target.width = Math.round(width * dpr);
        target.height = Math.round(height * dpr);
      }
      backdrop.width = Math.round(width * 0.6);
      backdrop.height = Math.round(height * 0.6);
      lastWorld = -100;
      // Resizing during a visit returns gracefully; no stale portrait/landscape rectangle.
      if (portalRef.current) portalRef.current.closing = true;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
      onSpeedChange(
        clamp(
          speedRef.current *
            Math.exp(clamp(event.deltaY * unit, -180, 180) * 0.0018),
          0.25,
          3
        )
      );
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    const visibility = () => {
      visible = !document.hidden;
      last = performance.now();
    };
    document.addEventListener("visibilitychange", visibility);

    openRef.current = cell => {
      if (!cell.weekend || portalRef.current) return;
      const g = filmGeometry(width, height),
        inset = g.frameWidth * 0.055;
      portalRef.current = {
        shot: shotFor(cell.frameWeek, cell.dayOfWeek),
        week: cell.frameWeek + cell.dayOfWeek / 7,
        rect: {
          x: cell.x + inset,
          y: g.innerTop,
          w: g.frameWidth - inset * 2,
          h: g.innerHeight,
        },
        progress: 0,
        age: 0,
        closing: false,
      };
      lastOpenedDay = cell.day;
      lastWorld = -100;
    };

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (!visible) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt * (reducedMotion ? 0.12 : 1);
      const t = elapsed,
        drag = dragRef.current;
      const resistance = timeResistance(timelineRef.current);
      if (seekRef.current !== null) {
        const delta = mod(seekRef.current - timelineRef.current + 26, 52) - 26;
        if (Math.abs(delta) < 0.012) {
          timelineRef.current = mod(seekRef.current, 52);
          seekRef.current = null;
        } else
          timelineRef.current = mod(
            timelineRef.current + delta * Math.min(1, dt * 11),
            52
          );
      } else if (!pausedRef.current && !drag.down) {
        timelineRef.current = mod(
          timelineRef.current +
            dt * (reducedMotion ? 0.025 : 0.2) * speedRef.current * resistance +
            drag.velocity * dt,
          52
        );
        drag.velocity *= Math.pow(0.025, dt);
      }
      const week = timelineRef.current,
        globalDay = week * 7,
        dayFloor = Math.floor(globalDay),
        dayFraction = globalDay - dayFloor;
      const {
        top: filmTop,
        filmHeight,
        innerTop,
        innerHeight,
        frameWidth,
      } = filmGeometry(width, height);
      const centerX = width * 0.5,
        pointer = pointerRef.current;
      const cells: Cell[] = [];
      for (let offset = -4; offset <= 4; offset++) {
        const day = dayFloor + offset,
          dayOfWeek = mod(day, 7),
          x = centerX + (offset - dayFraction) * frameWidth;
        if (x > width || x + frameWidth < 0) continue;
        cells.push({
          x,
          day,
          dayOfWeek,
          frameWeek: mod(Math.floor(day / 7), 52),
          weekend: dayOfWeek >= 5,
        });
      }
      cellsRef.current = cells;
      const hovered =
        pointer.active &&
        pointer.y * height > innerTop &&
        pointer.y * height < innerTop + innerHeight
          ? cells.find(
              c =>
                pointer.x * width >= c.x && pointer.x * width < c.x + frameWidth
            )
          : undefined;
      if (hovered?.day === dwellDay && (!drag.down || drag.moved < 8))
        dwell += dt;
      else {
        dwell = 0;
        dwellDay = hovered?.day ?? -1;
      }
      const held = drag.down && drag.moved < 8 && now - drag.at > 1100;
      if (
        hovered?.weekend &&
        hovered.day !== lastOpenedDay &&
        !reducedMotion &&
        (held || dwell > 4.2)
      )
        openRef.current(hovered);
      const centered = cells.find(
        c => centerX >= c.x && centerX < c.x + frameWidth
      );
      // Very occasionally an unhurried distant weekend opens on its own.
      if (
        !portalRef.current &&
        !reducedMotion &&
        centered?.weekend &&
        centered.day !== lastOpenedDay &&
        shotFor(centered.frameWeek).wide &&
        centered.dayOfWeek === 6 &&
        dayFraction > 0.4
      )
        openRef.current(centered);

      const portal = portalRef.current;
      if (portal) {
        portal.progress = clamp(
          portal.progress + dt * (portal.closing ? -0.7 : 0.46),
          0,
          1
        );
        if (portal.progress >= 1) portal.age += dt;
        if (portal.age > 11) portal.closing = true;
        if (portal.closing && portal.progress <= 0) {
          portalRef.current = null;
          dwell = 0;
          lastWorld = -100;
        }
      }
      const activeShot = portal?.shot ?? shotFor(week);
      const worldWeek = portal ? portal.week : week;
      if (now - lastWorld >= (width < 700 ? 40 : 30)) {
        worldCtx.setTransform(1, 0, 0, 1, 0, 0);
        drawWorld(worldCtx, 1440, 1080, t, worldWeek, pointer, activeShot.rain);
        backCtx.save();
        backCtx.clearRect(0, 0, backdrop.width, backdrop.height);
        backCtx.filter = "saturate(.4) brightness(.32) blur(1.5px)";
        const crop = sourceCrop(world.width, world.height, width, height, {
          x: 0.52,
          y: 0.5,
          height: 1,
        });
        backCtx.drawImage(
          world,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          backdrop.width,
          backdrop.height
        );
        backCtx.restore();
        lastWorld = now;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(backdrop, 0, 0, width, height);
      for (const cell of cells) {
        if (!cell.weekend) continue;
        const inset = frameWidth * 0.055;
        paintWindow(
          ctx,
          world,
          cell.x + inset,
          innerTop,
          frameWidth - inset * 2,
          innerHeight,
          shotFor(cell.frameWeek, cell.dayOfWeek),
          pointer,
          t
        );
      }

      filmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      filmCtx.clearRect(0, 0, width, height);
      const surface = filmCtx.createLinearGradient(
        0,
        filmTop,
        0,
        filmTop + filmHeight
      );
      surface.addColorStop(0, "rgba(13,16,22,.95)");
      surface.addColorStop(0.16, "rgba(18,20,26,.97)");
      surface.addColorStop(0.5, "rgba(4,7,12,.97)");
      surface.addColorStop(0.85, "rgba(20,20,25,.97)");
      surface.addColorStop(1, "rgba(7,10,15,.96)");
      filmCtx.fillStyle = surface;
      filmCtx.fillRect(0, filmTop, width, filmHeight);
      filmCtx.save();
      filmCtx.globalCompositeOperation = "destination-out";
      for (const cell of cells)
        if (cell.weekend) {
          roundedPath(
            filmCtx,
            cell.x + frameWidth * 0.055,
            innerTop,
            frameWidth * 0.89,
            innerHeight,
            6
          );
          filmCtx.fill();
        }
      // Perforations travel with the emulsion, instead of remaining fixed in the viewport.
      const holeStep = frameWidth / 5,
        holeW = Math.min(18, holeStep * 0.52),
        holeH = Math.min(24, (innerTop - filmTop) * 0.42);
      const holeOffset = mod(globalDay * frameWidth, holeStep);
      for (
        let x = -holeStep - holeOffset;
        x < width + holeStep;
        x += holeStep
      ) {
        roundedPath(filmCtx, x, filmTop + 11, holeW, holeH, 4);
        filmCtx.fill();
        roundedPath(
          filmCtx,
          x,
          filmTop + filmHeight - 11 - holeH,
          holeW,
          holeH,
          4
        );
        filmCtx.fill();
      }
      filmCtx.restore();

      for (const cell of cells) {
        const inset = frameWidth * 0.055,
          x = cell.x + inset,
          w = frameWidth - inset * 2;
        if (!cell.weekend) {
          drawWorkstation(
            filmCtx,
            x,
            innerTop,
            w,
            innerHeight,
            t + cell.frameWeek * 0.17,
            cell.dayOfWeek
          );
          filmCtx.save();
          roundedPath(filmCtx, x, innerTop, w, innerHeight, 6);
          filmCtx.clip();
          // Different perceptual faults, with weekly variation and no guaranteed happy Friday.
          const strength =
            0.04 + mod(Math.sin(cell.day * 13.17) * 2718, 1) * 0.09;
          if (cell.dayOfWeek === 0) {
            filmCtx.fillStyle = `rgba(0,2,8,${0.12 + strength})`;
            filmCtx.fillRect(x, innerTop, w, innerHeight);
          }
          if (cell.dayOfWeek === 1) {
            for (let i = 0; i < 9; i++) {
              filmCtx.fillStyle = `rgba(119,148,162,${strength * 0.28})`;
              filmCtx.fillRect(x + (i * w) / 9, innerTop, 1, innerHeight);
            }
          }
          if (cell.dayOfWeek === 2) {
            for (let i = 0; i < 5; i++) {
              filmCtx.fillStyle = `rgba(93,143,146,${strength * 0.4})`;
              filmCtx.fillRect(
                x + mod(i * 27, w * 0.7),
                innerTop + mod(i * 83 + t * 3, innerHeight),
                w * 0.28,
                8 + i * 3
              );
            }
          }
          if (cell.dayOfWeek === 3) {
            filmCtx.strokeStyle = `rgba(197,96,133,${strength})`;
            filmCtx.strokeRect(
              x + w * 0.13 + Math.sin(t * 0.6) * 3,
              innerTop + innerHeight * 0.22,
              w * 0.74,
              innerHeight * 0.35
            );
          }
          if (cell.dayOfWeek === 4) {
            filmCtx.fillStyle = `rgba(230,110,55,${strength * 0.3})`;
            filmCtx.fillRect(x, innerTop, w, innerHeight);
          }
          filmCtx.restore();

          const spontaneous = weekdayLeak(cell.day, t);
          const seeking =
            hovered?.day === cell.day
              ? (0.25 + smooth(dwell / 3) * 0.55) *
                (0.45 + 0.55 * Math.sin(t * 0.45 + cell.day) ** 2)
              : 0;
          const leak = Math.max(spontaneous, seeking);
          if (leak > 0.025) {
            const cx =
              seeking > spontaneous
                ? pointer.x * width
                : x + w * (0.3 + mod(cell.day * 0.31, 0.4));
            const cy =
              seeking > spontaneous
                ? clamp(
                    pointer.y * height,
                    innerTop + 15,
                    innerTop + innerHeight - 15
                  )
                : innerTop + innerHeight * (0.3 + mod(cell.day * 0.17, 0.4));
            const radius = Math.min(w * 0.58, 34 + leak * 52);
            // Paint the living fragment beneath the film, then erase emulsion with a soft aperture.
            ctx.save();
            roundedPath(ctx, x, innerTop, w, innerHeight, 6);
            ctx.clip();
            paintWindow(
              ctx,
              world,
              x,
              innerTop,
              w,
              innerHeight,
              shotFor(cell.frameWeek),
              pointer,
              t,
              0.82
            );
            ctx.restore();
            filmCtx.save();
            roundedPath(filmCtx, x, innerTop, w, innerHeight, 6);
            filmCtx.clip();
            filmCtx.globalCompositeOperation = "destination-out";
            const light = filmCtx.createRadialGradient(
              cx,
              cy,
              radius * 0.08,
              cx,
              cy,
              radius
            );
            light.addColorStop(0, `rgba(0,0,0,${leak})`);
            light.addColorStop(0.55, `rgba(0,0,0,${leak * 0.55})`);
            light.addColorStop(1, "rgba(0,0,0,0)");
            filmCtx.fillStyle = light;
            filmCtx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
            filmCtx.restore();
          }
        }
        filmCtx.strokeStyle = cell.weekend
          ? "rgba(255,211,134,.48)"
          : "rgba(180,205,210,.14)";
        filmCtx.lineWidth = cell.weekend ? 1.2 : 0.7;
        roundedPath(filmCtx, x, innerTop, w, innerHeight, 6);
        filmCtx.stroke();
        filmCtx.font = `500 ${Math.max(9, width * 0.008)}px "IBM Plex Mono", monospace`;
        filmCtx.letterSpacing = ".13em";
        filmCtx.fillStyle = cell.weekend
          ? "rgba(255,222,161,.85)"
          : "rgba(184,206,209,.42)";
        filmCtx.fillText(DAYS[cell.dayOfWeek], x + 8, innerTop - 12);
        filmCtx.font = `400 ${Math.max(7, width * 0.0058)}px "IBM Plex Mono", monospace`;
        filmCtx.fillStyle = cell.weekend
          ? "rgba(232,191,132,.5)"
          : "rgba(158,181,186,.27)";
        const label =
          cell.weekend && width >= 700
            ? shotFor(cell.frameWeek, cell.dayOfWeek).title
            : `W${String(cell.frameWeek + 1).padStart(2, "0")} · ${String(cell.dayOfWeek + 1).padStart(2, "0")}`;
        filmCtx.fillText(label, x + 8, innerTop + innerHeight + 20, w - 16);
        if (cell.weekend && hovered?.day === cell.day && !portal) {
          filmCtx.strokeStyle = "rgba(255,218,151,.7)";
          filmCtx.lineWidth = 1;
          filmCtx.beginPath();
          filmCtx.arc(
            x + w - 19,
            innerTop - 16,
            5,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * clamp(dwell / 4.2, 0.04, 1)
          );
          filmCtx.stroke();
        }
      }

      const oil = filmCtx.createLinearGradient(
        0,
        filmTop,
        width,
        filmTop + filmHeight
      );
      oil.addColorStop(0, "rgba(87,255,218,0)");
      oil.addColorStop(
        0.28 + Math.sin(t * 0.05) * 0.05,
        "rgba(65,195,207,.045)"
      );
      oil.addColorStop(0.48, "rgba(255,78,130,.025)");
      oil.addColorStop(0.72, "rgba(255,198,79,.035)");
      oil.addColorStop(1, "rgba(87,255,218,0)");
      filmCtx.fillStyle = oil;
      filmCtx.fillRect(0, filmTop, width, filmHeight);
      filmCtx.strokeStyle = "rgba(211,236,232,.14)";
      filmCtx.lineWidth = 1;
      filmCtx.beginPath();
      filmCtx.moveTo(0, filmTop);
      filmCtx.lineTo(width, filmTop + Math.sin(t * 0.32) * 2);
      filmCtx.moveTo(0, filmTop + filmHeight);
      filmCtx.lineTo(width, filmTop + filmHeight + Math.sin(t * 0.27) * 2);
      filmCtx.stroke();
      // Fine physical wear accumulates gently during a viewing session.
      for (let i = 0; i < Math.min(13, 3 + Math.floor(t / 70)); i++) {
        const x = mod(i * 179.3 - globalDay * frameWidth, width);
        filmCtx.strokeStyle = "rgba(171,201,220,.035)";
        filmCtx.lineWidth = 0.5;
        filmCtx.beginPath();
        filmCtx.moveTo(x, filmTop + 4);
        filmCtx.lineTo(x + 2, filmTop + filmHeight - 4);
        filmCtx.stroke();
      }
      ctx.drawImage(film, 0, 0, width, height);
      for (const cell of cells)
        if (cell.weekend) {
          const glow = ctx.createRadialGradient(
            cell.x + frameWidth / 2,
            innerTop + innerHeight * 0.5,
            0,
            cell.x + frameWidth / 2,
            innerTop + innerHeight * 0.5,
            frameWidth * 0.8
          );
          glow.addColorStop(0, "rgba(255,187,90,.065)");
          glow.addColorStop(1, "rgba(255,65,45,0)");
          ctx.fillStyle = glow;
          ctx.fillRect(
            cell.x - frameWidth * 0.4,
            innerTop,
            frameWidth * 1.8,
            innerHeight
          );
        }
      const marker = currentMarker(week);
      if (marker && height > 520) {
        ctx.font = `500 ${Math.max(7, width * 0.006)}px "IBM Plex Mono", monospace`;
        ctx.fillStyle = "rgba(255,211,147,.55)";
        ctx.letterSpacing = ".16em";
        ctx.fillText(
          marker.code,
          centerX - ctx.measureText(marker.code).width / 2,
          filmTop + 29
        );
      }
      ctx.save();
      ctx.strokeStyle = "rgba(255,235,205,.14)";
      ctx.lineWidth = 0.7;
      ctx.setLineDash([2, 8]);
      ctx.beginPath();
      ctx.moveTo(centerX, filmTop - 10);
      ctx.lineTo(centerX, filmTop + filmHeight + 10);
      ctx.stroke();
      ctx.restore();

      if (portal && portalRef.current) {
        memoryCtx.setTransform(1, 0, 0, 1, 0, 0);
        memoryCtx.clearRect(0, 0, memory.width, memory.height);
        memoryCtx.drawImage(canvas, 0, 0);
        const p = smooth(portal.progress),
          r = portal.rect;
        const x = r.x * (1 - p),
          y = r.y * (1 - p),
          w = r.w + (width - r.w) * p,
          h = r.h + (height - r.h) * p;
        ctx.save();
        ctx.fillStyle = `rgba(1,4,9,${p * 0.7})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        paintWindow(ctx, world, x, y, w, h, portal.shot, pointer, t, 1, p);
        if (p > 0.7) {
          // A distant trace of the machine keeps moving while the viewer is outside it.
          ctx.save();
          ctx.globalAlpha = (p - 0.7) * 0.8;
          ctx.drawImage(
            memory,
            0,
            filmTop * dpr,
            memory.width,
            filmHeight * dpr,
            width * 0.3,
            height * 0.82,
            width * 0.4,
            height * 0.06
          );
          ctx.restore();
        }
      }
      canvas.dataset.engine = "living-apertures";
      if (now - statusAt > 180) {
        statusAt = now;
        canvas.dataset.week = week.toFixed(3);
        canvas.dataset.shot = activeShot.kind;
        canvas.dataset.baseSpeed = speedRef.current.toFixed(2);
        canvas.dataset.portal = portalRef.current
          ? portalRef.current.progress.toFixed(2)
          : "0";
        onStatus({
          season: SEASON_CN[seasonState(worldWeek).key],
          week: Math.floor(week) + 1,
          day: DAYS[Math.floor(mod(globalDay, 7))],
          speed: speedRef.current * resistance,
          marker: marker?.name,
          immersed: !!portalRef.current,
          caption: portal?.shot.caption,
          shot: activeShot.kind,
          rain: activeShot.rain,
        });
      }
    };
    draw(performance.now());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("wheel", wheel);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [onStatus, onSpeedChange, reducedMotion]);

  const updatePointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
      active: true,
    };
    return rect;
  };
  const release = (
    event: React.PointerEvent<HTMLCanvasElement>,
    cancelled = false
  ) => {
    const drag = dragRef.current;
    if (!drag.down) return;
    drag.down = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled) {
      drag.velocity = 0;
      return;
    }
    if (drag.moved < 8 && performance.now() - drag.at < 900) {
      if (portalRef.current) portalRef.current.closing = true;
      else {
        const cell = cellsRef.current.find(c => c.day === drag.day);
        if (cell) openRef.current(cell);
      }
    }
  };
  return (
    <canvas
      ref={canvasRef}
      className="time-film-canvas"
      tabIndex={0}
      aria-label="流动的四季胶卷。拖动翻阅，点击周末进入世界；空格暂停，方向键逐日，Escape 返回。"
      onPointerMove={event => {
        const rect = updatePointer(event),
          drag = dragRef.current;
        if (drag.down && !portalRef.current) {
          const dx = event.clientX - drag.lastX;
          drag.moved += Math.abs(dx);
          if (drag.moved > 5) {
            seekRef.current = null;
            const frameWidth = filmGeometry(rect.width, rect.height).frameWidth;
            timelineRef.current = mod(
              timelineRef.current - dx / frameWidth / 7,
              52
            );
            drag.velocity = clamp((-dx / frameWidth) * 0.7, -0.7, 0.7);
          }
          drag.lastX = event.clientX;
        }
      }}
      onPointerDown={event => {
        if (!event.isPrimary) return;
        const rect = updatePointer(event);
        const g = filmGeometry(rect.width, rect.height),
          p = pointerRef.current;
        const cell =
          p.y * rect.height > g.innerTop &&
          p.y * rect.height < g.innerTop + g.innerHeight
            ? cellsRef.current.find(
                c =>
                  p.x * rect.width >= c.x &&
                  p.x * rect.width < c.x + g.frameWidth
              )
            : undefined;
        dragRef.current = {
          down: true,
          startX: event.clientX,
          lastX: event.clientX,
          moved: 0,
          at: performance.now(),
          velocity: 0,
          day: cell?.day ?? -1,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={event => release(event)}
      onPointerCancel={event => release(event, true)}
      onPointerLeave={() => {
        if (!dragRef.current.down) pointerRef.current.active = false;
      }}
      onLostPointerCapture={() => {
        dragRef.current.down = false;
      }}
      onKeyDown={event => {
        if (
          [" ", "ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(
            event.key
          )
        )
          event.preventDefault();
        if (event.key === " ") onPauseChange(!pausedRef.current);
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          seekRef.current = mod(
            timelineRef.current + (event.key === "ArrowLeft" ? -1 : 1) / 7,
            52
          );
          dragRef.current.velocity = 0;
        }
        if (event.key === "Escape" && portalRef.current)
          portalRef.current.closing = true;
        if (event.key === "Enter") {
          const cell = cellsRef.current.find(c => c.weekend);
          if (cell) openRef.current(cell);
        }
      }}
    />
  );
}
