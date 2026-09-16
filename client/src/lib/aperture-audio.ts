import { useEffect, useRef } from "react";
import type { WorldStatus } from "@/components/TimeFilm";

type SoundState = {
  context: AudioContext;
  master: GainNode;
  world: GainNode;
  mechanical: GainNode;
  filter: BiquadFilterNode;
  airFilter: BiquadFilterNode;
  airGain: GainNode;
  motor: OscillatorNode;
  train: GainNode;
};

/** No downloaded loops: air, water, a transport motor and small scene-synchronised events. */
export function useGeneratedSound(
  enabled: boolean,
  status: WorldStatus,
  paused: boolean
) {
  const audioRef = useRef<SoundState | null>(null),
    lastEvent = useRef(-1);
  const live = useRef({ status, paused });
  live.current = { status, paused };
  useEffect(() => {
    if (!enabled) return;
    const Audio =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Audio) return;
    const context = new Audio();
    void context.resume().catch(() => {});
    const master = context.createGain(),
      world = context.createGain(),
      mechanical = context.createGain(),
      filter = context.createBiquadFilter(),
      compressor = context.createDynamicsCompressor();
    master.gain.value = 0.0001;
    world.gain.value = 0.18;
    mechanical.gain.value = 0.2;
    filter.type = "lowpass";
    filter.frequency.value = 500;
    filter.Q.value = 0.6;
    master.connect(compressor).connect(context.destination);
    world.connect(filter).connect(master);
    mechanical.connect(master);
    const drone = context.createOscillator(),
      droneGain = context.createGain();
    drone.frequency.value = 73.42;
    drone.type = "sine";
    droneGain.gain.value = 0.018;
    drone.connect(droneGain).connect(world);
    drone.start();
    const harmonic = context.createOscillator(),
      harmonicGain = context.createGain();
    harmonic.frequency.value = 110;
    harmonicGain.gain.value = 0.009;
    harmonic.connect(harmonicGain).connect(world);
    harmonic.start();
    const buffer = context.createBuffer(
      2,
      context.sampleRate * 5,
      context.sampleRate
    );
    for (let channel = 0; channel < 2; channel++) {
      const samples = buffer.getChannelData(channel);
      let brown = 0;
      for (let i = 0; i < samples.length; i++) {
        brown = (brown + (Math.random() * 2 - 1) * 0.035) / 1.025;
        samples[i] = brown * 3;
      }
    }
    const air = context.createBufferSource(),
      airFilter = context.createBiquadFilter(),
      airGain = context.createGain();
    air.buffer = buffer;
    air.loop = true;
    airFilter.type = "bandpass";
    airFilter.frequency.value = 720;
    airFilter.Q.value = 0.45;
    airGain.gain.value = 0.07;
    air.connect(airFilter).connect(airGain).connect(world);
    air.start();
    const breath = context.createOscillator(),
      breathGain = context.createGain();
    breath.frequency.value = 0.12;
    breathGain.gain.value = 0.025;
    breath.connect(breathGain).connect(airGain.gain);
    breath.start();
    const motor = context.createOscillator(),
      motorGain = context.createGain();
    motor.type = "triangle";
    motor.frequency.value = 32;
    motorGain.gain.value = 0.023;
    motor.connect(motorGain).connect(mechanical);
    motor.start();
    const rail = context.createBufferSource(),
      railFilter = context.createBiquadFilter(),
      train = context.createGain();
    rail.buffer = buffer;
    rail.loop = true;
    railFilter.type = "bandpass";
    railFilter.frequency.value = 460;
    railFilter.Q.value = 1.1;
    train.gain.value = 0;
    rail.connect(railFilter).connect(train).connect(world);
    rail.start();
    const visibility = () => {
      if (document.hidden) {
        void context.suspend();
      } else {
        void context.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    master.gain.setTargetAtTime(0.58, context.currentTime, 0.3);
    audioRef.current = {
      context,
      master,
      world,
      mechanical,
      filter,
      airFilter,
      airGain,
      motor,
      train,
    };
    lastEvent.current = -1;
    // Sparse droplets and birds. The conspicuous leaf/glass drop follows the canvas clock.
    const eventTimer = window.setInterval(() => {
      if (document.hidden || context.state !== "running") return;
      const s = live.current.status,
        phase = s.phase ?? 0,
        weekend = s.immersed || s.day === "SAT" || s.day === "SUN";
      const period = s.shot === "bloom" ? 15 : s.rain ? 19 : 23;
      const event = Math.floor(
        (phase - (s.shot === "bloom" ? 6 : 10)) / period
      );
      if (event === lastEvent.current || !weekend) return;
      lastEvent.current = event;
      const now = context.currentTime,
        osc = context.createOscillator(),
        gain = context.createGain(),
        pan = context.createStereoPanner();
      const drop = s.rain || s.shot === "bloom";
      osc.type = "sine";
      osc.frequency.setValueAtTime(drop ? 880 : 1600, now);
      osc.frequency.exponentialRampToValueAtTime(
        drop ? 240 : 2400,
        now + (drop ? 0.07 : 0.14)
      );
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(drop ? 0.028 : 0.008, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + (drop ? 0.22 : 0.25)
      );
      pan.pan.value = drop ? 0.15 : -0.5;
      osc.connect(gain).connect(pan).connect(world);
      osc.start(now);
      osc.stop(now + 0.3);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        pan.disconnect();
      };
    }, 150);
    return () => {
      window.clearInterval(eventTimer);
      document.removeEventListener("visibilitychange", visibility);
      audioRef.current = null;
      master.gain.setTargetAtTime(0, context.currentTime, 0.04);
      window.setTimeout(() => void context.close(), 180);
    };
  }, [enabled]);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const now = a.context.currentTime,
      weekend = status.immersed || status.day === "SAT" || status.day === "SUN";
    a.filter.frequency.setTargetAtTime(weekend ? 4300 : 420, now, 0.3);
    a.world.gain.setTargetAtTime(weekend ? 0.66 : 0.22, now, 0.3);
    a.mechanical.gain.setTargetAtTime(
      paused ? 0 : weekend ? 0.1 : 0.28,
      now,
      0.15
    );
    a.motor.frequency.setTargetAtTime(
      18 + Math.max(0, status.speed) * 16,
      now,
      0.2
    );
    a.airFilter.frequency.setTargetAtTime(
      status.rain ? 2100 : status.shot === "tide" ? 350 : 850,
      now,
      0.8
    );
    a.airGain.gain.setTargetAtTime(status.rain ? 0.13 : 0.065, now, 0.8);
    const trainPhase = ((status.phase ?? 0) * 0.018) % 1.25;
    a.train.gain.setTargetAtTime(
      status.shot === "train"
        ? 0.13 * Math.exp(-(((trainPhase - 0.58) / 0.14) ** 2))
        : 0,
      now,
      0.2
    );
  }, [
    enabled,
    paused,
    status.day,
    status.immersed,
    status.rain,
    status.shot,
    status.phase,
    status.speed,
  ]);
}
