import React from "react";
import { Composition, staticFile } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { NewsVideo } from "./NewsVideo";
import { loadManifest, computeTimeline, type Manifest } from "./manifest";

const calculateMetadata: CalculateMetadataFunction<{ manifest: Manifest }> =
  async () => {
    const manifest = await loadManifest();
    const { totalFrames } = computeTimeline(manifest);
    return {
      durationInFrames: totalFrames,
      props: { manifest },
    };
  };

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NewsVideo"
      component={NewsVideo}
      calculateMetadata={calculateMetadata}
      defaultProps={{ manifest: null as unknown as Manifest }}
      durationInFrames={120}
      fps={60}
      width={1080}
      height={1920}
    />
  );
};

export { staticFile };
