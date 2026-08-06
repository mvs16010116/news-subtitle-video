import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { THEME, VIDEO_HEIGHT, VIDEO_WIDTH } from "../config";

type Particle = {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  phase: number;
  opacity: number;
};

const PARTICLE_COUNT = 12;

const generateParticles = (seed: number): Particle[] => {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: rand() * VIDEO_WIDTH,
    y: rand() * VIDEO_HEIGHT,
    size: 1 + rand() * 2,
    speed: 0.1 + rand() * 0.25,
    drift: (rand() - 0.5) * 0.3,
    phase: rand() * Math.PI * 2,
    opacity: 0.08 + rand() * 0.2,
  }));
};

export const ParticleBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const particles = useMemo(() => generateParticles(42), []);
  const t = frame / fps;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, ${THEME.backgroundTop} 0%, ${THEME.backgroundBottom} 100%)`,
        overflow: "hidden",
      }}
    >
      {particles.map((p, i) => {
        const y = (p.y + t * p.speed * 30) % VIDEO_HEIGHT;
        const x =
          (p.x + Math.sin(t * 0.3 + p.phase) * p.drift * 60 + VIDEO_WIDTH) %
          VIDEO_WIDTH;
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.5 + p.phase);
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
              background: THEME.text,
              opacity: p.opacity * twinkle,
            }}
          />
        );
      })}
    </div>
  );
};
