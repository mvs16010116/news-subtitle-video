import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ParticleBackground } from "./components/ParticleBackground";
import { PyramidScreen } from "./components/PyramidScreen";
import { computeTimeline, type Manifest } from "./manifest";

export const NewsVideo: React.FC<{ manifest: Manifest }> = ({ manifest }) => {
  const frame = useCurrentFrame();
  const { segments } = useMemo(() => computeTimeline(manifest), [manifest]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#05070D" }}>
      <ParticleBackground />
      <PyramidScreen segments={segments} frame={frame} />
      {segments.map((seg) => (
        <Sequence
          key={seg.segment.id}
          from={seg.audioStartFrame}
          durationInFrames={seg.audioEndFrame - seg.audioStartFrame}
        >
          <Audio src={staticFile(seg.segment.audioFile)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
