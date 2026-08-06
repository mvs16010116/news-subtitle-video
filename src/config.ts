export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const FPS = 60;

export const TTS_VOICE = "zh-CN-YunyangNeural";
export const TTS_RATE = "-10%";

export const SCREEN_MAX_CHARS = 10;
export const LINE_MAX_CHARS = 7;
export const SCREEN_MAX_LINES = 3;

// timeline (seconds)
export const LEAD_IN_SECONDS = 0.8;
export const LEAD_OUT_SECONDS = 1.6;
export const SCREEN_GAP_SECONDS = 0.45;

// animations (seconds)
export const SLIDE_IN_SECONDS = 0.35;
export const REFLOW_SECONDS = 0.5;
export const RETIRE_HEAD_START_SECONDS = 0.1;

// ending (seconds)
export const END_ROTATE_SECONDS = 0.45;
export const END_HOLD_SECONDS = 0.2;
export const END_FLY_SECONDS = 0.6;
export const END_FADE_SECONDS = 0.35;
export const END_SCATTER_SECONDS = 0.6;

export const WORD_HIGHLIGHT_LEAD_MS = 100;
export const WORD_HIGHLIGHT_LAG_MS = 150;

// pyramid geometry
export const PYRAMID_TIER_SCALES = [1, 0.7, 0.54, 0.42, 0.33, 0.26];
export const PYRAMID_TIER_BRIGHTNESS = [1, 0.9, 0.78, 0.66, 0.55, 0.47];
export const PYRAMID_READING_Y = 800;
export const PYRAMID_TIER_GAPS = [180, 150, 120, 95, 72]; // between tier centers, decreasing
export const PYRAMID_MAX_TIERS = 3;
// tier fonts scale off this cap (not the current reading font), so the hourglass
// keeps a stable size even when the reading sentence is short
export const PYRAMID_TIER_REF_FONT = 122;

export const SLIDE_IN_SCALE_START = 0.6;

export const THEME = {
  accent: "#FFD700",
  accentSoft: "#FFE566",
  text: "#FFFFFF",
  textDim: "rgba(255,255,255,0.45)",
  backgroundTop: "#0A0E18",
  backgroundBottom: "#04060A",
};
