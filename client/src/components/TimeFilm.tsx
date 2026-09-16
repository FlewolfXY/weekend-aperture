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
  responsiveCamera,
  shotFor,
  sourceCrop,
  weekdayLeak,
  type Shot,
} from "@/lib/aperture-scenes";

import {
  advanceTime,
  canOpenAutomatically,
  portalAnchor,
  velocityFromDrag,
  weekendPace,
} from "@/lib/aperture-time";

export type WorldStatus = {
  phase?: number;
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
  blocked?: boolean;
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
  day: number;
  fadeReturn?: boolean;
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
  const camera = responsiveCamera(openingCamera(shot, opening), w / h);
  camera.x += (pointer.x - 0.5) * 0.014 + Math.sin(t * 0.13) * 0.003;
  camera.y += (pointer.y - 0.5) * 0.009;
  const crop = sourceCrop(source.width, source.height, w, h, camera);
  ctx.globalAlpha = intensity;
  ctx.filter = shot.rain
    ? "saturate(.76) contrast(1.06) brightness(1.10)"
    : "saturate(1.25) contrast(1.08) brightness(1.13)";
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
function paintFog(
  ctx: CanvasRenderingContext2D,
  current: HTMLCanvasElement,
  history: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  shot: Shot,
  day: number,
  t: number
) {
  ctx.save();
  roundedPath(ctx, x, y, w, h, 6);
  ctx.clip();
  const camera = responsiveCamera(shot, w / h),
    crop = sourceCrop(current.width, current.height, w, h, camera);
  const draw = (source: HTMLCanvasElement, dx = 0, dy = 0) =>
    ctx.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      x + dx,
      y + dy,
      w,
      h
    );
  ctx.globalAlpha = day === 0 ? 0.28 : 0.36;
  draw(day === 2 ? history : current);
  if (day === 1) {
    ctx.globalAlpha = 0.1;
    for (let i = 1; i < 5; i++) draw(history, 0, i * 9);
  }
  if (day === 3) {
    ctx.globalAlpha = 0.21;
    draw(history, 8 + Math.sin(t * 0.6) * 3, 0);
  }
  ctx.globalAlpha = 1;
  const milk = ctx.createLinearGradient(x, y, x + w, y + h);
  milk.addColorStop(0, "rgba(158,176,179,.065)");
  milk.addColorStop(0.48, "rgba(20,31,39,.34)");
  milk.addColorStop(1, "rgba(105,117,128,.07)");
  ctx.fillStyle = milk;
  ctx.fillRect(x, y, w, h);
  if (day === 2) {
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 4; i++) {
      const sy = mod(i * 71 + Math.floor(t * 2) * 17, h - 12);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y + sy, w, 8 + i * 4);
      ctx.clip();
      draw(current, (i % 2 ? 1 : -1) * 6);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 18; i++) {
    const sx = x + mod(i * 37.37, w);
    lineFog(ctx, sx, y, sx + Math.sin(i) * 4, y + h, "rgba(204,215,213,.022)");
  }
  // Bare traces of imposed time, never a replacement room behind every frame.
  ctx.fillStyle = "rgba(151,174,178,.10)";
  ctx.fillRect(x + w * 0.12, y + h * 0.2, w * 0.43, 1);
  ctx.fillRect(x + w * 0.12, y + h * 0.2 + 6, w * 0.24, 1);
  ctx.restore();
}
function lineFog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export default function TimeFilm({
  speed,
  paused,
  reducedMotion,
  seekWeek,
  seekToken,
  returnToken,
  blocked = false,
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
    lastAt: 0,
    moved: 0,
    at: 0,
    velocity: 0,
    day: -1,
  });
  const manualAtRef = useRef(0),
    yearRef = useRef(0),
    blockedRef = useRef(blocked);
  useEffect(() => {
    blockedRef.current = blocked;
    if (blocked) pointerRef.current.active = false;
  }, [blocked]);
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
    manualAtRef.current = performance.now();
    seekRef.current = seekWeek;
    dragRef.current.velocity = 0;
    if (portalRef.current) portalRef.current.closing = true;
  }, [seekWeek, seekToken]);
  useEffect(() => {
    if (portalRef.current) {
      portalRef.current.closing = true;
      manualAtRef.current = performance.now();
    }
  }, [returnToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const world = document.createElement("canvas"),
      film = document.createElement("canvas"),
      memory = document.createElement("canvas"),
      backdrop = document.createElement("canvas"),
      fog = document.createElement("canvas"),
      history = document.createElement("canvas"),
      visitWorld = document.createElement("canvas");
    const worldCtx = world.getContext("2d"),
      filmCtx = film.getContext("2d"),
      memoryCtx = memory.getContext("2d"),
      backCtx = backdrop.getContext("2d"),
      fogCtx = fog.getContext("2d"),
      historyCtx = history.getContext("2d"),
      visitCtx = visitWorld.getContext("2d");
    if (
      !worldCtx ||
      !filmCtx ||
      !memoryCtx ||
      !backCtx ||
      !fogCtx ||
      !historyCtx ||
      !visitCtx
    )
      return;
    world.width = 1440;
    world.height = 1080;
    visitWorld.width = 1440;
    visitWorld.height = 1080;
    fog.width = history.width = 360;
    fog.height = history.height = 270;
    let historyAt = -100,
      wet = Number(shotFor(timelineRef.current).rain),
      hoveredWeekend = false;
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
      const worldWidth = width < 700 ? 1080 : 1440;
      if (world.width !== worldWidth) {
        world.width = visitWorld.width = worldWidth;
        world.height = visitWorld.height = worldWidth * 0.75;
      }
      dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 1.75);
      for (const target of [canvas, film, memory]) {
        target.width = Math.round(width * dpr);
        target.height = Math.round(height * dpr);
      }
      backdrop.width = Math.round(width * 0.6);
      backdrop.height = Math.round(height * 0.6);
      lastWorld = -100;
      // Resizing during a visit returns gracefully; no stale portrait/landscape rectangle.
      if (portalRef.current) {
        portalRef.current.closing = true;
        portalRef.current.fadeReturn = true;
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      manualAtRef.current = performance.now();
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
      if (!cell.weekend || portalRef.current || blockedRef.current) return;
      const g = filmGeometry(width, height),
        inset = g.frameWidth * 0.055;
      portalRef.current = {
        shot: shotFor(cell.frameWeek, cell.dayOfWeek, yearRef.current),
        day: cell.day,
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
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      elapsed += dt * (reducedMotion ? 0.12 : 1);
      const t = elapsed,
        drag = dragRef.current;
      const resistance =
        timeResistance(timelineRef.current) * weekendPace(timelineRef.current);
      const attention =
        hoveredWeekend && !portalRef.current && !blockedRef.current ? 0.22 : 1;
      const wasSeeking = seekRef.current !== null;
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
        const previous = timelineRef.current;
        timelineRef.current = mod(
          advanceTime(
            previous,
            dt,
            speedRef.current * (reducedMotion ? 0.125 : 1),
            attention
          ) +
            drag.velocity * dt,
          52
        );
        if (previous > 50 && timelineRef.current < 2) yearRef.current++;

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
      hoveredWeekend = !!hovered?.weekend;
      const held = drag.down && drag.moved < 8 && now - drag.at > 650;
      if (
        hovered?.weekend &&
        hovered.day !== lastOpenedDay &&
        !reducedMotion &&
        !blockedRef.current &&
        (held || dwell > 1.4)
      )
        openRef.current(hovered);
      const centered = cells.find(
        c => centerX >= c.x && centerX < c.x + frameWidth
      );
      // Very occasionally an unhurried distant weekend opens on its own.
      if (
        !portalRef.current &&
        !blockedRef.current &&
        canOpenAutomatically(
          pausedRef.current,
          drag.down,
          wasSeeking,
          reducedMotion,
          (now - manualAtRef.current) / 1000
        ) &&
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
        if (portal.age > 14 && !pausedRef.current) portal.closing = true;
        if (portal.closing && portal.fadeReturn === undefined)
          portal.fadeReturn =
            portalAnchor(portal.day, week, width, frameWidth) === null;
        if (portal.closing && portal.progress <= 0) {
          portalRef.current = null;
          dwell = 0;
          lastWorld = -100;
        }
      }
      const activeShot = portal?.shot ?? shotFor(week, 5, yearRef.current);
      wet +=
        (Number(shotFor(week, 5, yearRef.current).rain) - wet) *
        (1 - Math.exp(-dt * 0.8));
      const worldWeek = portal ? portal.week : week;
      if (now - lastWorld >= (width < 700 ? 40 : 30)) {
        worldCtx.setTransform(1, 0, 0, 1, 0, 0);
        drawWorld(worldCtx, world.width, world.height, t, week, pointer, wet, {
          year: yearRef.current,
          focus: shotFor(week).kind,
        });
        if (portal) {
          const outward =
            portal.shot.kind === "horizon"
              ? 1
              : portal.shot.kind === "tide"
                ? 0.35
                : portal.shot.kind === "canopy"
                  ? 0.12
                  : 0;
          const travel =
            outward * smooth(portal.fadeReturn ? 1 : portal.progress);
          drawWorld(
            visitCtx,
            visitWorld.width,
            visitWorld.height,
            t,
            portal.week,
            pointer,
            Number(portal.shot.rain),
            { travel, year: yearRef.current, focus: portal.shot.kind }
          );
        }
        if (now - historyAt > 240) {
          historyCtx.clearRect(0, 0, 360, 270);
          historyCtx.drawImage(fog, 0, 0);
          historyAt = now;
        }
        fogCtx.filter = "blur(2.6px) saturate(.14) brightness(.72)";
        fogCtx.drawImage(world, 0, 0, 360, 270);
        fogCtx.filter = "none";
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
          shotFor(cell.frameWeek, cell.dayOfWeek, yearRef.current),
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
          paintFog(
            filmCtx,
            fog,
            history,
            x,
            innerTop,
            w,
            innerHeight,
            shotFor(cell.frameWeek, 5, yearRef.current),
            cell.dayOfWeek,
            t
          );

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
            ? shotFor(cell.frameWeek, cell.dayOfWeek, yearRef.current).title
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
            -Math.PI / 2 + Math.PI * 2 * clamp(dwell / 1.4, 0.04, 1)
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
      // Small continuous curvature gives the emulsion tension without bending its subjects.
      const slice = 24;
      for (let x = 0; x < width; x += slice) {
        const span = Math.min(slice, width - x),
          bend = Math.sin((x / width) * Math.PI) * Math.sin(t * 0.42) * 1.7;
        ctx.drawImage(
          film,
          x * dpr,
          0,
          span * dpr,
          film.height,
          x,
          bend,
          span,
          height
        );
      }
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
        const p = smooth(portal.progress);
        const anchor = portalAnchor(portal.day, week, width, frameWidth);
        if (portal.closing && anchor === null) portal.fadeReturn = true;
        const fade = portal.closing && portal.fadeReturn;
        const r = portal.rect;
        const destinationX =
          portal.closing && anchor !== null ? anchor + frameWidth * 0.055 : r.x;
        const x = fade ? 0 : destinationX * (1 - p),
          y = fade ? 0 : innerTop * (1 - p),
          w = fade ? width : r.w + (width - r.w) * p,
          h = fade ? height : innerHeight + (height - innerHeight) * p;
        ctx.save();
        ctx.globalAlpha = fade ? p : 1;
        ctx.fillStyle = `rgba(1,4,9,${p * 0.7})`;
        ctx.fillRect(0, 0, width, height);
        paintWindow(
          ctx,
          visitWorld,
          x,
          y,
          w,
          h,
          portal.shot,
          pointer,
          t,
          1,
          fade ? 1 : p
        );
        ctx.restore();
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
      canvas.dataset.engine = "living-apertures-v2";
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
          speed: pausedRef.current
            ? 0
            : speedRef.current * resistance * attention,
          phase: t,
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
    if (drag.moved < 8 && performance.now() - drag.at < 650) {
      if (portalRef.current) {
        portalRef.current.closing = true;
        portalRef.current.fadeReturn = true;
      } else {
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
            drag.velocity = velocityFromDrag(
              dx,
              frameWidth,
              performance.now() - drag.lastAt
            );
          }
          drag.lastX = event.clientX;
          drag.lastAt = performance.now();
        }
      }}
      onPointerDown={event => {
        if (!event.isPrimary || blockedRef.current) return;
        manualAtRef.current = performance.now();
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
          lastAt: performance.now(),
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
        if (blockedRef.current) return;
        manualAtRef.current = performance.now();
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
          const cell = cellsRef.current
            .filter(c => c.weekend)
            .sort(
              (a, b) =>
                Math.abs(a.x - window.innerWidth * 0.5) -
                Math.abs(b.x - window.innerWidth * 0.5)
            )[0];
          if (cell) openRef.current(cell);
        }
      }}
    />
  );
}
