import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { VIDEO_HEIGHT, VIDEO_WIDTH } from "../config";

type Blob = {
  cx: number;
  cy: number;
  size: number;
  color: string;
  opacity: number;
  speed: number;
  amp: number;
  phase: number;
};

type Particle = {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  phase: number;
  opacity: number;
  color: string;
};

type Aurora = {
  y: number;
  height: number;
  color: string;
  opacity: number;
  speed: number;
  ampY: number;
  tilt: number;
  phase: number;
};

type Ray = {
  color: string;
  width: number;
  opacity: number;
  baseAngle: number;
  rotSpeed: number;
};

type Shape = {
  kind: "circle" | "ring" | "square" | "triangle" | "plus";
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  speed: number;
  amp: number;
  rotSpeed: number;
  phase: number;
  depth: number;
};

type Pulse = {
  x: number;
  y: number;
  color: string;
  offset: number;
  maxR: number;
};

type Sparkle = {
  x: number;
  y: number;
  size: number;
  phase: number;
  color: string;
};

const BLOB_SEED = 7;
const PARTICLE_SEED = 42;
const AURORA_SEED = 11;
const RAY_SEED = 23;
const SHAPE_SEED = 99;
const PULSE_SEED = 55;
const SPARKLE_SEED = 88;

const BLOB_COUNT = 8;
const PARTICLE_COUNT = 55;
const AURORA_COUNT = 3;
const RAY_COUNT = 3;
const SHAPE_COUNT = 14;
const PULSE_COUNT = 4;
const SPARKLE_COUNT = 9;
const PULSE_PERIOD = 4.2;

const BLOB_COLORS = ["#FF5E9C", "#00C2FF", "#FFD166", "#9A6BFF", "#5EF0A0", "#FF7A59", "#FF8FB1", "#7DE2FF"];
const PARTICLE_COLORS = ["#FFD166", "#FF8FB1", "#7DE2FF", "#B48AFF", "#9BFFB8"];
const AURORA_COLORS = ["#7DE2FF", "#FF8FB1", "#B48AFF"];
const SHAPE_COLORS = ["#FFE066", "#7DE2FF", "#FF8FB1", "#B48AFF", "#9BFFB8", "#FFFFFF"];

const makeRand = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const generateBlobs = (): Blob[] => {
  const rand = makeRand(BLOB_SEED);
  return Array.from({ length: BLOB_COUNT }, (_, i) => ({
    cx: rand() * 1.1 - 0.05,
    cy: rand() * 1.1 - 0.05,
    size: 550 + rand() * 700,
    color: BLOB_COLORS[i % BLOB_COLORS.length],
    opacity: 0.4 + rand() * 0.4,
    speed: 0.09 + rand() * 0.12,
    amp: 60 + rand() * 110,
    phase: rand() * Math.PI * 2,
  }));
};

const generateParticles = (): Particle[] => {
  const rand = makeRand(PARTICLE_SEED);
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: rand() * VIDEO_WIDTH,
    y: rand() * VIDEO_HEIGHT,
    size: 2 + rand() * 4,
    speed: 0.45 + rand() * 0.7,
    drift: (rand() - 0.5) * 0.9,
    phase: rand() * Math.PI * 2,
    opacity: 0.35 + rand() * 0.45,
    color: PARTICLE_COLORS[Math.floor(rand() * PARTICLE_COLORS.length)],
  }));
};

const generateAuroras = (): Aurora[] => {
  const rand = makeRand(AURORA_SEED);
  return Array.from({ length: AURORA_COUNT }, (_, i) => ({
    y: 0.15 + rand() * 0.7,
    height: VIDEO_HEIGHT * (0.35 + rand() * 0.3),
    color: AURORA_COLORS[i % AURORA_COLORS.length],
    opacity: 0.16 + rand() * 0.18,
    speed: 0.12 + rand() * 0.14,
    ampY: 40 + rand() * 90,
    tilt: (rand() - 0.5) * 14,
    phase: rand() * Math.PI * 2,
  }));
};

const generateRays = (): Ray[] => {
  const rand = makeRand(RAY_SEED);
  return Array.from({ length: RAY_COUNT }, (_, i) => ({
    color: ["#FFE066", "#7DE2FF", "#FF8FB1"][i % 3],
    width: 90 + rand() * 160,
    opacity: 0.1 + rand() * 0.12,
    baseAngle: rand() * 360,
    rotSpeed: (rand() - 0.5) * 14,
  }));
};

const generateShapes = (): Shape[] => {
  const rand = makeRand(SHAPE_SEED);
  const kinds: Shape["kind"][] = ["circle", "ring", "square", "triangle", "plus"];
  return Array.from({ length: SHAPE_COUNT }, (_, i) => ({
    kind: kinds[i % kinds.length],
    x: rand(),
    y: rand(),
    size: 24 + rand() * 68,
    color: SHAPE_COLORS[Math.floor(rand() * SHAPE_COLORS.length)],
    opacity: 0.25 + rand() * 0.4,
    speed: 0.08 + rand() * 0.12,
    amp: 35 + rand() * 100,
    rotSpeed: (rand() - 0.5) * 55,
    phase: rand() * Math.PI * 2,
    depth: 0.55 + rand() * 0.75,
  }));
};

const generatePulses = (): Pulse[] => {
  const rand = makeRand(PULSE_SEED);
  return Array.from({ length: PULSE_COUNT }, (_, i) => ({
    x: 0.18 + rand() * 0.64,
    y: 0.2 + rand() * 0.6,
    color: ["#FFE066", "#7DE2FF", "#FF8FB1", "#9BFFB8"][i % 4],
    offset: (i / PULSE_COUNT) * PULSE_PERIOD,
    maxR: 180 + rand() * 180,
  }));
};

const generateSparkles = (): Sparkle[] => {
  const rand = makeRand(SPARKLE_SEED);
  return Array.from({ length: SPARKLE_COUNT }, () => ({
    x: rand() * VIDEO_WIDTH,
    y: rand() * VIDEO_HEIGHT,
    size: 5 + rand() * 7,
    phase: rand() * Math.PI * 2,
    color: PARTICLE_COLORS[Math.floor(rand() * PARTICLE_COLORS.length)],
  }));
};

const renderShape = (
  s: Shape,
  x: number,
  y: number,
  size: number,
  rot: number,
  key: number,
): React.ReactNode => {
  const base: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    opacity: s.opacity,
    transform: `translate(-50%, -50%) rotate(${rot}deg)`,
  };
  switch (s.kind) {
    case "circle":
      return (
        <div
          key={key}
          style={{
            ...base,
            width: size,
            height: size,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${s.color}dd, ${s.color}55)`,
          }}
        />
      );
    case "ring":
      return (
        <div
          key={key}
          style={{
            ...base,
            width: size,
            height: size,
            borderRadius: "50%",
            border: `${Math.max(2, size * 0.13)}px solid ${s.color}`,
            boxShadow: `0 0 ${size * 0.4}px ${s.color}66`,
          }}
        />
      );
    case "square":
      return (
        <div
          key={key}
          style={{
            ...base,
            width: size,
            height: size,
            borderRadius: size * 0.22,
            background: `linear-gradient(135deg, ${s.color}dd, ${s.color}55)`,
            boxShadow: `0 0 ${size * 0.5}px ${s.color}55`,
          }}
        />
      );
    case "triangle":
      return (
        <div
          key={key}
          style={{
            ...base,
            width: size,
            height: size,
            background: `linear-gradient(180deg, ${s.color}dd, ${s.color}44)`,
            clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
          }}
        />
      );
    case "plus":
      return (
        <div key={key} style={{ ...base, width: size, height: size }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              width: size * 0.16,
              height: size,
              borderRadius: size * 0.08,
              background: `linear-gradient(180deg, ${s.color}dd, ${s.color}77)`,
              transform: "translateX(-50%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              width: size,
              height: size * 0.16,
              borderRadius: size * 0.08,
              background: `linear-gradient(90deg, ${s.color}dd, ${s.color}77)`,
              transform: "translateY(-50%)",
            }}
          />
        </div>
      );
  }
};

export const ParticleBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const blobs = useMemo(generateBlobs, []);
  const particles = useMemo(generateParticles, []);
  const auroras = useMemo(generateAuroras, []);
  const rays = useMemo(generateRays, []);
  const shapes = useMemo(generateShapes, []);
  const pulses = useMemo(generatePulses, []);
  const sparkles = useMemo(generateSparkles, []);
  const t = frame / fps;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: `linear-gradient(${
          140 + Math.sin(t * 0.12) * 25
        }deg, #2B0F5E 0%, #C24E78 42%, #FF9E6D 76%, #FFD37E 100%)`,
        filter: `hue-rotate(${Math.sin(t * 0.05) * 22}deg)`,
      }}
    >
      {/* flowing aurora ribbons (soft gradients, no expensive blur) */}
      {auroras.map((a, i) => {
        const y = a.y * VIDEO_HEIGHT + Math.sin(t * a.speed + a.phase) * a.ampY;
        const tilt = a.tilt + Math.sin(t * a.speed * 0.7 + a.phase) * 5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -400,
              top: y - a.height / 2,
              width: VIDEO_WIDTH + 800,
              height: a.height,
              background: `linear-gradient(100deg, transparent 15%, ${a.color}55 30%, ${a.color}88 50%, ${a.color}55 70%, transparent 85%)`,
              opacity: a.opacity,
              transform: `rotate(${tilt}deg)`,
            }}
          />
        );
      })}

      {/* slow-drifting color blobs (soft radial gradients) */}
      {blobs.map((b, i) => {
        const x =
          b.cx * VIDEO_WIDTH + Math.sin(t * b.speed * 2 + b.phase) * b.amp;
        const y =
          b.cy * VIDEO_HEIGHT +
          Math.cos(t * b.speed * 1.6 + b.phase) * b.amp * 0.8;
        const pulse = 1 + 0.18 * Math.sin(t * 0.6 + b.phase);
        const size = b.size * pulse;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${b.color} 0%, ${b.color}22 45%, transparent 70%)`,
              opacity: b.opacity,
            }}
          />
        );
      })}

      {/* sweeping god-rays rotating around the center */}
      {rays.map((r, i) => {
        const ang = r.baseAngle + t * r.rotSpeed;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: VIDEO_WIDTH * 3,
              height: r.width,
              background: `linear-gradient(90deg, transparent 0%, ${r.color}88 50%, transparent 100%)`,
              opacity: r.opacity,
              transform: `translate(-50%, -50%) rotate(${ang}deg)`,
            }}
          />
        );
      })}

      {/* floating geometric shapes drifting + rotating + pulsing */}
      {shapes.map((s, i) => {
        const x =
          s.x * VIDEO_WIDTH +
          Math.sin(t * s.speed * 1.7 + s.phase) * s.amp;
        const y =
          s.y * VIDEO_HEIGHT +
          Math.cos(t * s.speed * 1.3 + s.phase * 1.4) * s.amp * 0.9;
        const rot = t * s.rotSpeed + s.phase * 57.3;
        const pulse = 1 + 0.22 * Math.sin(t * 0.9 + s.phase * 2);
        const size = s.size * pulse * s.depth;
        return renderShape(s, x, y, size, rot, i);
      })}

      {/* periodically expanding ring pulses */}
      {pulses.map((p, i) => {
        const cycle = (t + p.offset) % PULSE_PERIOD;
        const pt = cycle / PULSE_PERIOD;
        const r = p.maxR * pt;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x * VIDEO_WIDTH - r,
              top: p.y * VIDEO_HEIGHT - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              border: `3px solid ${p.color}`,
              opacity: (1 - pt) * 0.55,
            }}
          />
        );
      })}

      {/* colorful glowing dust drifting upward */}
      {particles.map((p, i) => {
        const y =
          (((p.y - t * p.speed * 50) % VIDEO_HEIGHT) + VIDEO_HEIGHT) %
          VIDEO_HEIGHT;
        const x =
          p.x +
          Math.sin(t * 0.55 + p.phase) * p.drift * 120 +
          Math.sin(t * 0.23 + p.phase * 2) * 25;
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + p.phase));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: p.color,
              boxShadow: `0 0 ${p.size * 5}px ${p.color}99`,
              opacity: p.opacity * twinkle,
            }}
          />
        );
      })}

      {/* twinkling four-point sparkle stars */}
      {sparkles.map((sp, i) => {
        const tw = Math.max(0, Math.sin(t * 1.8 + sp.phase));
        const s = sp.size * tw;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: sp.x,
              top: sp.y,
              width: s,
              height: s,
              background: sp.color,
              clipPath:
                "polygon(50% 0%, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0% 50%, 38% 38%)",
              opacity: tw,
            }}
          />
        );
      })}

      {/* gentle darkening toward the edges so the subtitle text stays readable */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(130% 95% at 50% 45%, rgba(8,10,30,0) 32%, rgba(8,10,30,0.42) 100%)",
        }}
      />
    </div>
  );
};
