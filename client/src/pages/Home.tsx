import { useCallback, useEffect, useRef, useState } from "react";
import { Info, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import TimeFilm, { type WorldStatus } from "@/components/TimeFilm";

const INITIAL_STATUS: WorldStatus = {
  season: "冬",
  week: 5,
  day: "SAT",
  speed: 1.2,
  marker: "春节",
};

function useGeneratedSound(enabled: boolean, status: WorldStatus) {
  const audioRef = useRef<{
    context: AudioContext;
    master: GainNode;
    world: GainNode;
    mechanical: GainNode;
    filter: BiquadFilterNode;
  } | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (audioRef.current) {
        const { context, master } = audioRef.current;
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setTargetAtTime(0, context.currentTime, 0.08);
        window.setTimeout(() => context.close(), 260);
        audioRef.current = null;
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass();
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const world = context.createGain();
    const mechanical = context.createGain();
    const filter = context.createBiquadFilter();
    master.gain.value = 0.0001;
    world.gain.value = 0.3;
    mechanical.gain.value = 0.34;
    filter.type = "lowpass";
    filter.frequency.value = 580;
    filter.Q.value = 1.2;

    master.connect(compressor).connect(context.destination);
    world.connect(filter).connect(master);
    mechanical.connect(master);

    const drone = context.createOscillator();
    const droneGain = context.createGain();
    drone.type = "sine";
    drone.frequency.value = 54;
    droneGain.gain.value = 0.055;
    drone.connect(droneGain).connect(world);
    drone.start();

    const harmonic = context.createOscillator();
    const harmonicGain = context.createGain();
    harmonic.type = "triangle";
    harmonic.frequency.value = 108.4;
    harmonicGain.gain.value = 0.018;
    harmonic.connect(harmonicGain).connect(world);
    harmonic.start();

    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      const fade = Math.sin((i / channel.length) * Math.PI);
      channel[i] = (Math.random() * 2 - 1) * fade;
    }
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = buffer;
    noise.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1240;
    noiseFilter.Q.value = 0.8;
    noiseGain.gain.value = 0.014;
    noise.connect(noiseFilter).connect(noiseGain).connect(mechanical);
    noise.start();

    const tick = context.createOscillator();
    const tickGain = context.createGain();
    tick.type = "square";
    tick.frequency.value = 29;
    tickGain.gain.value = 0.012;
    tick.connect(tickGain).connect(mechanical);
    tick.start();

    master.gain.setTargetAtTime(0.62, context.currentTime, 0.32);
    audioRef.current = { context, master, world, mechanical, filter };

    return () => {
      master.gain.setTargetAtTime(0, context.currentTime, 0.06);
      window.setTimeout(() => context.close(), 180);
      audioRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const weekend = status.day === "SAT" || status.day === "SUN";
    const now = audio.context.currentTime;
    audio.filter.frequency.setTargetAtTime(weekend ? 3400 : 470, now, 0.22);
    audio.world.gain.setTargetAtTime(weekend ? 0.64 : 0.18, now, 0.25);
    audio.mechanical.gain.setTargetAtTime(weekend ? 0.2 : 0.43, now, 0.2);
  }, [status.day]);
}

const MOON_PHASES = ["●", "◔", "◑", "◕", "○", "◕", "◑", "◔", "●", "◔", "◑", "◕", "○"];

function YearOrbit({ week, onSeek }: { week: number; onSeek: (week: number) => void }) {
  const orbitRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const progress = Math.max(0, Math.min(1, (week - 1) / 51));

  const seekFromPointer = (clientX: number) => {
    const rect = orbitRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = Math.max(0, Math.min(51.999, ((clientX - rect.left) / rect.width) * 52));
    onSeek(next);
  };

  return (
    <div className="year-orbit-wrap">
      <div className="orbit-caption">
        <span>LUNAR / SOLAR YEAR</span>
        <b>拖动时间轨道</b>
        <span>52 WEEKS</span>
      </div>
      <div
        ref={orbitRef}
        className="year-orbit"
        role="slider"
        tabIndex={0}
        aria-label="年度时间轴"
        aria-valuemin={1}
        aria-valuemax={52}
        aria-valuenow={week}
        onPointerDown={(event) => {
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          seekFromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (draggingRef.current) seekFromPointer(event.clientX);
        }}
        onPointerUp={(event) => {
          draggingRef.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") onSeek(Math.max(0, week - 2));
          if (event.key === "ArrowRight") onSeek(Math.min(51.999, week));
        }}
      >
        <svg className="orbit-path" viewBox="0 0 1000 72" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 8 57 Q 500 -14 992 57" />
          <path className="orbit-progress" pathLength="1" d="M 8 57 Q 500 -14 992 57" style={{ strokeDasharray: `${progress} 1` }} />
        </svg>
        <div className="moon-row" aria-hidden="true">
          {MOON_PHASES.map((phase, index) => (
            <span key={`${phase}-${index}`} className={index / (MOON_PHASES.length - 1) <= progress ? "passed" : ""}>{phase}</span>
          ))}
        </div>
        <span className="solar-cursor" style={{ left: `${0.8 + progress * 98.4}%`, top: `${57 - Math.sin(progress * Math.PI) * 48}%` }} aria-hidden="true">
          <i />
        </span>
        <div className="season-marks" aria-hidden="true">
          <span style={{ left: "1%" }}>冬</span>
          <span style={{ left: "18%" }}>春</span>
          <span style={{ left: "43%" }}>夏</span>
          <span style={{ left: "69%" }}>秋</span>
          <span style={{ left: "93%" }}>冬</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [sound, setSound] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [speed, setSpeed] = useState(1.2);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<WorldStatus>(INITIAL_STATUS);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [seekWeek, setSeekWeek] = useState<number | null>(null);
  const [seekToken, setSeekToken] = useState(0);

  useGeneratedSound(sound, status);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const updateStatus = useCallback((next: WorldStatus) => setStatus(next), []);
  const seekTimeline = useCallback((nextWeek: number) => {
    setSeekWeek(nextWeek);
    setSeekToken((value) => value + 1);
    setSpeed((value) => Math.max(value, 1.8));
    setPaused(false);
  }, []);

  const enter = () => {
    setEntered(true);
    setSound(true);
  };

  return (
    <main className="art-shell">
      <section className="art-stage" aria-label="Weekend Aperture 互动艺术原型">
        <TimeFilm
          speed={speed}
          paused={paused}
          reducedMotion={reducedMotion}
          seekWeek={seekWeek}
          seekToken={seekToken}
          onSpeedChange={setSpeed}
          onPauseChange={setPaused}
          onStatus={updateStatus}
        />

        <div className="grain" aria-hidden="true" />
        <div className="edge-vignette" aria-hidden="true" />

        <header className="hud hud-top">
          <div className="identity-block">
            <span className="micro-label">CYCLICAL STUDY / 001</span>
            <h1>WEEKEND<br />APERTURE</h1>
          </div>

          <div className="time-code" aria-live="polite">
            <div className="time-code-main">
              <span className="season-glyph">{status.season}</span>
              <span>W{String(status.week).padStart(2, "0")}</span>
              <span className={status.day === "SAT" || status.day === "SUN" ? "day weekend" : "day"}>{status.day}</span>
            </div>
            <div className="time-code-sub">
              <span>{status.marker ?? "ORDINARY WEEK"}</span>
              <span>{status.speed.toFixed(2)}× FLOW</span>
            </div>
          </div>
        </header>

        <aside className="side-rail" aria-label="作品控制">
          <button
            className="rail-button"
            type="button"
            aria-label={paused ? "继续时间" : "暂停时间"}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            className="rail-button"
            type="button"
            aria-label={sound ? "关闭声音" : "开启声音"}
            onClick={() => setSound((value) => !value)}
          >
            {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button
            className="rail-button"
            type="button"
            aria-label="恢复正常速度"
            onClick={() => {
              setSpeed(1.2);
              setPaused(false);
            }}
          >
            <RotateCcw size={14} />
          </button>
          <span className="rail-rule" />
          <button
            className="rail-button"
            type="button"
            aria-label="查看作品说明"
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen(true)}
          >
            <Info size={15} />
          </button>
        </aside>

        <footer className="hud hud-bottom">
          <div className="instruction">
            <span>滚轮调速</span>
            <i />
            <span>拖拽时间</span>
            <i />
            <span>移动对焦透景</span>
          </div>
          <YearOrbit week={status.week} onSeek={seekTimeline} />
        </footer>

        {!entered && (
          <button className="focus-gate" type="button" onClick={enter} aria-label="进入并启用生成式音景">
            <span className="focus-ring"><span /></span>
            <span className="focus-copy">
              <b>FOCUS</b>
              <small>点击对焦 · 建议佩戴耳机</small>
            </span>
          </button>
        )}

        {infoOpen && (
          <div className="info-panel" role="dialog" aria-modal="true" aria-label="作品说明">
            <button className="info-close" type="button" aria-label="关闭说明" onClick={() => setInfoOpen(false)}>
              <X size={17} />
            </button>
            <span className="micro-label">ARTIST NOTE / PROTOTYPE</span>
            <h2>世界从未停止，<br />只是感知偶尔恢复。</h2>
            <p>
              五个工作日把世界压进失焦、拖影与错帧。到了周末，胶片上的小孔才短暂显影：有时是燃烧般饱和的远方，有时只是阴雨卧室里一盏微小的灯。
            </p>
            <p>
              一年由五十二个星期构成。普通时间快速流过；换季、春节、清明、中秋与冬至会让机器迟疑。画面不是贴图：树、天气、水面、城市与光都在同一个世界里持续运动。
            </p>
            <dl>
              <div><dt>滚轮</dt><dd>改变时间流速</dd></div>
              <div><dt>拖拽</dt><dd>刹停并翻动胶卷</dd></div>
              <div><dt>移动</dt><dd>穿过灰暗工位，对焦背后的世界</dd></div>
              <div><dt>轨道</dt><dd>拖动月相与太阳，快速前往一年中的任意时刻</dd></div>
            </dl>
          </div>
        )}

        <div className="portrait-note">
          <RotateCcw size={16} />
          <span>请旋转设备，以横屏观看这件作品</span>
        </div>
      </section>
    </main>
  );
}
