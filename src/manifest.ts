import { staticFile } from "remotion";
import { REFLOW_SECONDS, RETIRE_HEAD_START_SECONDS } from "./config";

export type TtsWord = {
  text: string;
  offset: number;
  duration: number;
};

export type Segment = {
  id: number;
  text: string;
  lines: string[];
  audioFile: string;
  durationSeconds: number;
  words: TtsWord[];
};

export type ManifestConfig = {
  videoWidth: number;
  videoHeight: number;
  fps: number;
  leadInSeconds: number;
  leadOutSeconds: number;
  screenGapSeconds: number;
  wordHighlightLeadMs: number;
  wordHighlightLagMs: number;
};

export type Manifest = {
  title: string;
  segments: Segment[];
  config: ManifestConfig;
};

export const loadManifest = async (): Promise<Manifest> => {
  const res = await fetch(staticFile("data/manifest.json"));
  if (!res.ok) {
    throw new Error(
      `manifest.json not found (${res.status}). Run \`npm run make -- news.txt\` first.`,
    );
  }
  return res.json() as Promise<Manifest>;
};

export type TimelineSegment = {
  segment: Segment;
  startFrame: number;
  audioStartFrame: number;
  audioEndFrame: number;
  retireStartFrame: number;
  retireEndFrame: number;
  endFrame: number;
};

export const computeTimeline = (manifest: Manifest) => {
  const {
    leadInSeconds,
    leadOutSeconds,
    screenGapSeconds,
    fps,
  } = manifest.config;

  const gapFrames = Math.round(screenGapSeconds * fps);
  const leadInFrames = Math.round(leadInSeconds * fps);
  const retireHeadStartFrames = Math.round(RETIRE_HEAD_START_SECONDS * fps);
  const reflowFrames = Math.round(REFLOW_SECONDS * fps);

  const segments: TimelineSegment[] = [];

  for (let i = 0; i < manifest.segments.length; i++) {
    const segment = manifest.segments[i];
    const audioFrames = Math.round(segment.durationSeconds * fps);

    const startFrame =
      i === 0 ? 0 : segments[i - 1].audioEndFrame + gapFrames;
    const audioStartFrame =
      i === 0 ? leadInFrames : startFrame;
    const audioEndFrame = audioStartFrame + audioFrames;
    const isLast = i === manifest.segments.length - 1;
    // the last segment never retires; it flies out during the ending instead
    const retireStartFrame = isLast
      ? Number.POSITIVE_INFINITY
      : audioEndFrame - retireHeadStartFrames;
    const retireEndFrame = retireStartFrame + reflowFrames;
    const endFrame = isLast ? audioEndFrame : retireEndFrame;

    segments.push({
      segment,
      startFrame,
      audioStartFrame,
      audioEndFrame,
      retireStartFrame,
      retireEndFrame,
      endFrame,
    });
  }

  const last = segments[segments.length - 1];
  const totalFrames = last ? last.audioEndFrame + Math.round(leadOutSeconds * fps) : 0;

  return { segments, totalFrames, fadeFrames: reflowFrames };
};

export const wordStartMs = (word: TtsWord) => word.offset / 10000;

export const wordEndMs = (word: TtsWord) => (word.offset + word.duration) / 10000;
