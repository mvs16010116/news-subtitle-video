import React, { useMemo } from "react";
import {
  END_FADE_SECONDS,
  END_FLY_SECONDS,
  END_HOLD_SECONDS,
  END_ROTATE_SECONDS,
  END_SCATTER_SECONDS,
  FPS,
  PYRAMID_MAX_TIERS,
  PYRAMID_READING_Y,
  PYRAMID_TIER_BRIGHTNESS,
  PYRAMID_TIER_REF_FONT,
  PYRAMID_TIER_SCALES,
  REFLOW_SECONDS,
  VIDEO_WIDTH,
  WORD_HIGHLIGHT_LAG_MS,
  WORD_HIGHLIGHT_LEAD_MS,
} from "../config";
import { wordEndMs, wordStartMs } from "../manifest";
import type { Segment, TtsWord } from "../manifest";
import type { TimelineSegment } from "../manifest";

const BASE_FONT = 260;
const GAP_WIDTH = 10;
const LINE_HEIGHT_RATIO = 1.18;
const LINE_GAP_RATIO = 0.55;
const AVAILABLE_WIDTH = VIDEO_WIDTH - 120;

// layered shadows: a tight white halo thickens the glyph, a soft black outline
// keeps edges readable over bright backgrounds, then a hard solid backing +
// soft falloff gives the "solid, full" look
const TEXT_SHADOW = [
  "0 0 0.025em rgba(255,255,255,0.55)",
  "0 0 0.05em rgba(0,0,0,0.7)",
  "0 0.05em 0 rgba(0,0,0,0.9)",
  "0 0.09em 0.045em rgba(0,0,0,0.7)",
  "0 0.16em 0.08em rgba(0,0,0,0.5)",
  "0 0.28em 0.14em rgba(0,0,0,0.35)",
].join(", ");

const ACTIVE_TEXT_SHADOW = [
  "0 0 0.05em #FFE566cc",
  "0 0 0.16em #FFE56655",
  "0 0 0.05em rgba(0,0,0,0.7)",
  "0 0.05em 0 rgba(0,0,0,0.9)",
  "0 0.09em 0.045em rgba(0,0,0,0.7)",
  "0 0.16em 0.08em rgba(0,0,0,0.5)",
  "0 0.28em 0.14em rgba(0,0,0,0.35)",
].join(", ");

// same-color stroke thickens the already-heavy Black glyphs into a fuller shape
const strokeWidthFor = (fontSize: number): number =>
  Math.max(2, Math.round(fontSize * 0.06));

type CharToken = {
  char: string;
  wordIndex: number;
  wordStartMs: number;
  wordEndMs: number;
};

const buildCharTokens = (text: string, words: TtsWord[]): CharToken[] => {
  const ranges = words.map((w) => w.text.length);
  const cumStart: number[] = [];
  let acc = 0;
  for (const len of ranges) {
    cumStart.push(acc);
    acc += len;
  }

  const wordAtSeq = (seqIdx: number): number => {
    if (seqIdx < 0) return 0;
    for (let i = ranges.length - 1; i >= 0; i--) {
      if (seqIdx >= cumStart[i]) return i;
    }
    return 0;
  };

  const tokens: CharToken[] = [];
  let seqIdx = 0;

  for (const char of text) {
    const wi = wordAtSeq(seqIdx);
    const word = words[wi];
    const isSpokenChar =
      seqIdx < acc && char === word.text[seqIdx - cumStart[wi]];
    if (isSpokenChar) {
      tokens.push({
        char,
        wordIndex: wi,
        wordStartMs: wordStartMs(word),
        wordEndMs: wordEndMs(word),
      });
      seqIdx++;
    } else {
      tokens.push({
        char,
        wordIndex: wi,
        wordStartMs: wordStartMs(word),
        wordEndMs: wordEndMs(word),
      });
    }
  }
  return tokens;
};

const readingFontFor = (segment: Segment): number => {
  const longestLine = Math.max(...segment.lines.map((l) => l.length), 1);
  return Math.min(
    BASE_FONT,
    (AVAILABLE_WIDTH - (longestLine - 1) * GAP_WIDTH) / longestLine,
  );
};

const blockHeight = (segment: Segment, fontSize: number): number => {
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  return (
    segment.lines.length * lineHeight +
    (segment.lines.length - 1) * fontSize * LINE_GAP_RATIO
  );
};

// hourglass geometry: the reading sentence sits at the slot (PYRAMID_READING_Y)
// with the widest tier; finished sentences stack below it, shrinking as they go
// down, and upcoming sentences stack above it, shrinking as they go up. the
// tier-1 bases touch the reading block's top/bottom, so the two pyramids join
// at the reading slot. actual block heights keep the anchors continuous
const TIER_SEP = 46;

const readingTopOf = (segment: Segment): number =>
  PYRAMID_READING_Y - blockHeight(segment, readingFontFor(segment)) / 2;

const readingBottomOf = (segment: Segment): number =>
  PYRAMID_READING_Y + blockHeight(segment, readingFontFor(segment)) / 2;

// top edge of the block at below-degree `tier` (1 = just below the reading
// block), stacked downward from the reading block's bottom
const stackBelowTop = (
  segments: TimelineSegment[],
  readingIdx: number,
  tier: number,
  refFont: number,
): number => {
  const reading = segments[readingIdx]?.segment ?? segments[segments.length - 1].segment;
  let top = readingBottomOf(reading);
  for (let j = 1; j < tier; j++) {
    const below = segments[readingIdx - j];
    if (!below) break;
    top +=
      blockHeight(below.segment, Math.round(refFont * PYRAMID_TIER_SCALES[j])) +
      TIER_SEP;
  }
  return top;
};

// bottom edge of the block at above-degree `tier` (1 = just above the reading
// block), stacked upward from the reading block's top
const stackAboveBottom = (
  segments: TimelineSegment[],
  readingIdx: number,
  tier: number,
  refFont: number,
): number => {
  const reading = segments[readingIdx]?.segment ?? segments[segments.length - 1].segment;
  let bottom = readingTopOf(reading);
  for (let j = 1; j < tier; j++) {
    const above = segments[readingIdx + j];
    if (!above) break;
    bottom -=
      blockHeight(above.segment, Math.round(refFont * PYRAMID_TIER_SCALES[j])) +
      TIER_SEP;
  }
  return bottom;
};

type FrameState = {
  frame: number;
  reading: TimelineSegment | null;
  activeRetiree: TimelineSegment | null;
  reflowProgress: number;
  isEnding: boolean;
  endingT: number;
};

const computeFrameState = (
  frame: number,
  segments: TimelineSegment[],
  endingStartFrame: number,
): FrameState => {
  const isEnding = frame >= endingStartFrame;

  if (isEnding) {
    const reading = segments[segments.length - 1] ?? null;
    return {
      frame,
      reading,
      activeRetiree: null,
      reflowProgress: 0,
      isEnding: true,
      endingT: frame - endingStartFrame,
    };
  }

  const activeRetiree =
    [...segments]
      .reverse()
      .find((s) => frame >= s.retireStartFrame) ?? null;

  // the newest sentence that has appeared (slide-in starts at startFrame)
  const reading =
    [...segments]
      .reverse()
      .find((s) => frame >= s.startFrame) ?? null;

  // if the retiree is still the current reading sentence, its retire window
  // (which starts before the next sentence appears) is a no-op: holding the
  // pyramid static here avoids a phantom up-and-back "breathing" animation
  const reflowProgress =
    activeRetiree && activeRetiree !== reading
      ? Math.min(
          1,
          Math.max(
            0,
            (frame - activeRetiree.retireStartFrame) /
              (REFLOW_SECONDS * FPS),
          ),
        )
      : 0;

  return {
    frame,
    reading,
    activeRetiree,
    reflowProgress,
    isEnding: false,
    endingT: 0,
  };
};

// signed degree of a segment relative to the reading slot: negative = finished
// (below), positive = upcoming (above), 0 = reading
const degreeOf = (
  segment: TimelineSegment,
  state: FrameState,
  segments: TimelineSegment[],
): number => {
  const idx = segments.indexOf(segment);
  if (state.activeRetiree) {
    return idx - (segments.indexOf(state.activeRetiree) + state.reflowProgress);
  }
  const readingIdx = state.reading ? segments.indexOf(state.reading) : segments.length - 1;
  return idx - readingIdx;
};

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

type BlockStyle = {
  fontSize: number;
  top: number;
  brightness: number;
  opacity: number;
};

const readingStyle = (segment: Segment): BlockStyle => ({
  fontSize: readingFontFor(segment),
  top: readingTopOf(segment),
  brightness: 1,
  opacity: 1,
});

const lerpStyle = (a: BlockStyle, b: BlockStyle, t: number): BlockStyle => ({
  fontSize: Math.round(lerp(a.fontSize, b.fontSize, t)),
  top: lerp(a.top, b.top, t),
  brightness: lerp(a.brightness, b.brightness, t),
  opacity: lerp(a.opacity, b.opacity, t),
});

const opacityForDegree = (k: number): number => {
  const exitStart = PYRAMID_MAX_TIERS - 0.5;
  const exitEnd = PYRAMID_MAX_TIERS + 0.5;
  if (k <= exitStart) return 1;
  return Math.max(0, 1 - (k - exitStart) / (exitEnd - exitStart));
};

// style of a block at a signed degree: |degree| >= 1 sits in one of the two
// pyramid chains (below = finished, above = upcoming) and interpolates between
// the integer tier anchors as the degree moves; degree 0 falls back to reading
const tierStyle = (
  segment: TimelineSegment,
  degree: number,
  refFont: number,
  readingIdx: number,
  segments: TimelineSegment[],
): BlockStyle => {
  const k = Math.abs(degree);
  if (k < 1) return readingStyle(segment.segment);
  const below = degree < 0;
  const cap = Math.min(PYRAMID_MAX_TIERS, k);
  const floor = Math.max(1, Math.floor(cap));
  const ceil = Math.min(PYRAMID_MAX_TIERS, floor + 1);
  const frac = easeOutCubic(Math.min(1, cap - floor));

  const fontFloor = Math.round(refFont * PYRAMID_TIER_SCALES[floor]);
  const fontCeil = Math.round(refFont * PYRAMID_TIER_SCALES[ceil]);
  const fontSize = Math.round(lerp(fontFloor, fontCeil, frac));

  const topFloor = below
    ? stackBelowTop(segments, readingIdx, floor, refFont)
    : stackAboveBottom(segments, readingIdx, floor, refFont) -
      blockHeight(segment.segment, fontFloor);
  const topCeil = below
    ? stackBelowTop(segments, readingIdx, ceil, refFont)
    : stackAboveBottom(segments, readingIdx, ceil, refFont) -
      blockHeight(segment.segment, fontCeil);
  const top = lerp(topFloor, topCeil, frac);

  const brightness = lerp(
    PYRAMID_TIER_BRIGHTNESS[floor],
    PYRAMID_TIER_BRIGHTNESS[ceil],
    frac,
  );

  return { fontSize, top, brightness, opacity: opacityForDegree(k) };
};

// continuous geometry for one block: during a reflow the retiree leaves the
// slot (reading -> below 1), the new sentence rises into it (above 1 ->
// reading), and every other block slides one tier within its own chain
const blockStyleFor = (
  segment: TimelineSegment,
  state: FrameState,
  segments: TimelineSegment[],
): BlockStyle => {
  const idx = segments.indexOf(segment);
  const isRetiree = state.activeRetiree === segment;
  const isReading = state.reading === segment;
  const reflowing = state.activeRetiree !== null && state.reflowProgress < 1;
  const rp = reflowing ? easeOutCubic(state.reflowProgress) : 0;

  const readingSeg = (state.reading ?? segments[segments.length - 1]).segment;
  const refFont = Math.min(
    readingFontFor(readingSeg),
    PYRAMID_TIER_REF_FONT,
  );
  const readingIdx = state.reading ? segments.indexOf(state.reading) : segments.length - 1;
  // only meaningful while the reflow is actually running: once it completes the
  // retiree index is stale and would snap blocks back to the reading slot
  const retireeIdx = reflowing && state.activeRetiree
    ? segments.indexOf(state.activeRetiree)
    : readingIdx;

  if (isRetiree && reflowing) {
    return lerpStyle(
      readingStyle(segment.segment),
      tierStyle(segment, -1, refFont, readingIdx, segments),
      rp,
    );
  }

  if (isReading && !state.isEnding) {
    if (reflowing) {
      return lerpStyle(
        tierStyle(segment, 1, refFont, retireeIdx, segments),
        readingStyle(segment.segment),
        rp,
      );
    }
    return readingStyle(segment.segment);
  }

  return lerpStyle(
    tierStyle(segment, idx - retireeIdx, refFont, retireeIdx, segments),
    tierStyle(segment, idx - readingIdx, refFont, readingIdx, segments),
    rp,
  );
};

const isWordActive = (
  token: CharToken,
  audioTimeMs: number,
): boolean =>
  audioTimeMs >= token.wordStartMs - WORD_HIGHLIGHT_LEAD_MS &&
  audioTimeMs <= token.wordEndMs + WORD_HIGHLIGHT_LAG_MS;

const renderTextBlock = (
  segment: Segment,
  tokens: CharToken[],
  fontSize: number,
  brightness: number,
  audioTimeMs: number,
  highlight: boolean,
  key: number,
): React.ReactNode => {
  let charCursor = 0;
  return (
    <div
      key={key}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: Math.round(fontSize * LINE_GAP_RATIO),
        width: "fit-content",
      }}
    >
      {segment.lines.map((line, lineIndex) => {
        const lineTokens = tokens.slice(charCursor, charCursor + line.length);
        charCursor += line.length;
        return (
          <div
            key={lineIndex}
            style={{
              display: "flex",
              justifyContent: "center",
              gap: GAP_WIDTH,
              width: "100%",
            }}
          >
            {lineTokens.map((token, i) => {
              const active = highlight && isWordActive(token, audioTimeMs);
              const fill = active
                ? "#FFD700"
                : `rgba(255,255,255,${brightness})`;
              const strokeWidth = strokeWidthFor(fontSize);
              return (
                <span
                  key={i}
                  style={{
                    flex: "0 0 auto",
                    fontSize,
                    lineHeight: LINE_HEIGHT_RATIO,
                    fontWeight: 900,
                    fontFamily: "Noto Sans SC",
                    color: fill,
                    WebkitTextStroke: `${strokeWidth}px ${fill}`,
                    textShadow: active ? ACTIVE_TEXT_SHADOW : TEXT_SHADOW,
                  }}
                >
                  {token.char}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ---------- ending: rotate horizontal -> vertical column, then fly right ----------

type CharGeom = {
  char: string;
  rotate: number;
  x: number;
  y: number;
  opacity: number;
};

const buildEndingChars = (
  segment: Segment,
  fontSize: number,
  endingT: number,
): CharGeom[] => {
  const rotateFrames = END_ROTATE_SECONDS * FPS;
  const holdFrames = END_HOLD_SECONDS * FPS;
  const flyFrames = END_FLY_SECONDS * FPS;
  const fadeFrames = END_FADE_SECONDS * FPS;

  const stagger = 0.04 * FPS;
  const chars: CharGeom[] = [];

  // column layout: each original line becomes one vertical column,
  // columns placed side by side
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  const lineGap = fontSize * LINE_GAP_RATIO;
  const colGap = fontSize * 0.8;
  const totalCols = segment.lines.length;
  const totalWidth =
    totalCols * fontSize + (totalCols - 1) * colGap;
  const blockCenterX = VIDEO_WIDTH / 2;
  const blockCenterY = PYRAMID_READING_Y;

  // where each line sat while reading (centered, stacked above the reading y)
  const readingHeight =
    segment.lines.length * lineHeight +
    (segment.lines.length - 1) * lineGap;

  let charIdx = 0;
  segment.lines.forEach((line, col) => {
    const colX = blockCenterX - totalWidth / 2 + col * (fontSize + colGap);
    const n = line.length;
    const totalH = n * lineHeight;
    const readingY =
      blockCenterY - readingHeight / 2 + lineHeight / 2 + col * (lineHeight + lineGap);

    line.split("").forEach((ch, row) => {
      // horizontal position while reading
      const hx = blockCenterX + (row - (n - 1) / 2) * fontSize;
      const hy = readingY;
      // vertical position in the column
      const vx = colX + fontSize / 2;
      const vy = blockCenterY - totalH / 2 + lineHeight / 2 + row * lineHeight;

      const start = charIdx * stagger;
      const rp = Math.min(1, Math.max(0, (endingT - start) / rotateFrames));
      const r = easeOutCubic(rp) * 90;

      const flyT = Math.min(
        1,
        Math.max(0, (endingT - (rotateFrames + holdFrames)) / flyFrames),
      );
      const flyX = easeOutCubic(flyT) * (VIDEO_WIDTH * 1.4);

      const fadeT = Math.min(
        1,
        Math.max(
          0,
          (endingT - (rotateFrames + holdFrames + flyFrames)) / fadeFrames,
        ),
      );

      const x = lerp(hx, vx, rp) + flyX;
      const y = lerp(hy, vy, rp);

      chars.push({
        char: ch,
        rotate: r,
        x,
        y,
        opacity: 1 - fadeT,
      });
      charIdx++;
    });
  });

  return chars;
};

export const PyramidScreen: React.FC<{
  segments: TimelineSegment[];
  frame: number;
}> = ({ segments, frame }) => {
  const endingStartFrame =
    segments.length > 0 ? segments[segments.length - 1].audioEndFrame : 0;
  const state = computeFrameState(frame, segments, endingStartFrame);

  // past sentences below + upcoming sentences above (up to the visible tiers)
  const visible = segments.filter(
    (s) => Math.abs(degreeOf(s, state, segments)) <= PYRAMID_MAX_TIERS + 0.5,
  );

  const endingChars = useMemo(() => {
    if (!state.isEnding || !state.reading) return null;
    const fontSize = readingFontFor(state.reading.segment);
    return buildEndingChars(
      state.reading.segment,
      fontSize,
      state.endingT,
    );
  }, [state.isEnding, state.reading, state.endingT]);

  const scatterFade = state.isEnding
    ? Math.max(
        0,
        1 - state.endingT / (END_SCATTER_SECONDS * FPS),
      )
    : 1;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      {/* tiers on both sides of the slot (everything but the reading sentence),
          including during the ending */}
      {visible
        .filter((s) => state.reading !== s)
        .map((s) => {
          const style = blockStyleFor(s, state, segments);
          return (
            <div
              key={s.segment.id}
              style={{
                position: "absolute",
                top: style.top,
                left: "50%",
                transform: "translateX(-50%)",
                opacity: style.opacity * scatterFade,
              }}
            >
              {renderTextBlock(
                s.segment,
                buildCharTokens(s.segment.text, s.segment.words),
                style.fontSize,
                style.brightness,
                0,
                false,
                s.segment.id,
              )}
            </div>
          );
        })}

      {/* reading sentence, or the ending char-by-char animation */}
      {state.reading &&
        (state.isEnding && endingChars ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            {endingChars.map((c, i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: c.x,
                  top: c.y,
                  transform: `translate(-50%, -50%) rotate(${c.rotate}deg)`,
                  transformOrigin: "center",
                  fontSize: readingFontFor(state.reading!.segment),
                  lineHeight: LINE_HEIGHT_RATIO,
                  fontWeight: 900,
                  fontFamily: "Noto Sans SC",
                  color: "#FFFFFF",
                  WebkitTextStroke: `${strokeWidthFor(
                    readingFontFor(state.reading!.segment),
                  )}px #FFFFFF`,
                  opacity: c.opacity,
                  textShadow: TEXT_SHADOW,
                }}
              >
                {c.char}
              </span>
            ))}
          </div>
        ) : (
          (() => {
            const style = blockStyleFor(state.reading, state, segments);
            const audioTimeMs =
              ((state.frame - state.reading.audioStartFrame) / FPS) * 1000;
            return (
              <div
                key={state.reading.segment.id}
                style={{
                  position: "absolute",
                  top: style.top,
                  left: "50%",
                  transform: "translateX(-50%)",
                  opacity: style.opacity * scatterFade,
                }}
              >
                {renderTextBlock(
                  state.reading.segment,
                  buildCharTokens(
                    state.reading.segment.text,
                    state.reading.segment.words,
                  ),
                  style.fontSize,
                  1,
                  audioTimeMs,
                  true,
                  state.reading.segment.id,
                )}
              </div>
            );
          })()
        ))}
    </div>
  );
};
