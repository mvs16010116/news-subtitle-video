import React, { useMemo } from "react";
import { THEME, VIDEO_WIDTH } from "../config";
import { wordEndMs, wordStartMs } from "../manifest";
import type { Segment, TtsWord } from "../manifest";

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
    if (seqIdx < 0) {
      return 0;
    }
    for (let i = ranges.length - 1; i >= 0; i--) {
      if (seqIdx >= cumStart[i]) {
        return i;
      }
    }
    return 0;
  };

  const tokens: CharToken[] = [];
  let seqIdx = 0;

  for (const char of text) {
    const isSpokenChar =
      seqIdx < acc && char === words[wordAtSeq(seqIdx)].text[seqIdx - cumStart[wordAtSeq(seqIdx)]];
    if (isSpokenChar) {
      const wi = wordAtSeq(seqIdx);
      tokens.push({
        char,
        wordIndex: wi,
        wordStartMs: wordStartMs(words[wi]),
        wordEndMs: wordEndMs(words[wi]),
      });
      seqIdx++;
    } else {
      const prevWi = wordAtSeq(seqIdx - 1);
      tokens.push({
        char,
        wordIndex: prevWi,
        wordStartMs: wordStartMs(words[prevWi]),
        wordEndMs: wordEndMs(words[prevWi]),
      });
    }
  }
  return tokens;
};

export const BigTextScreen: React.FC<{
  segment: Segment;
  audioTimeMs: number;
  leadMs: number;
  lagMs: number;
  opacity: number;
}> = ({ segment, audioTimeMs, leadMs, lagMs, opacity }) => {
  const tokens = useMemo(
    () => buildCharTokens(segment.text, segment.words),
    [segment],
  );

  const longestLine = Math.max(...segment.lines.map((l) => l.length), 1);
  const availableWidth = VIDEO_WIDTH - 120;
  const baseFont = 260;
  const gapWidth = 8;
  const scale = Math.min(
    1,
    (availableWidth - (longestLine - 1) * gapWidth) /
      (longestLine * baseFont),
  );
  const fontSize = Math.round(baseFont * scale);

  const isWordActive = (token: CharToken) => {
    return (
      audioTimeMs >= token.wordStartMs - leadMs &&
      audioTimeMs <= token.wordEndMs + lagMs
    );
  };

  let charCursor = 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(fontSize * 0.14),
          padding: "0 60px",
          textAlign: "center",
        }}
    >
        {segment.lines.map((line, lineIndex) => {
          const lineTokens = tokens.slice(
            charCursor,
            charCursor + line.length,
          );
          charCursor += line.length;
          return (
            <div key={lineIndex} style={{ display: "flex", gap: gapWidth }}>
              {lineTokens.map((token, i) => {
                const active = isWordActive(token);
                return (
                  <span
                    key={i}
                    style={{
                      fontSize,
                      lineHeight: 1,
                      fontWeight: 900,
                      fontFamily: "Noto Sans SC",
                      color: active ? THEME.accent : THEME.text,
                      textShadow: active
                        ? `0 0 40px ${THEME.accentSoft}aa, 0 6px 24px rgba(0,0,0,0.6)`
                        : "0 6px 24px rgba(0,0,0,0.6)",
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
    </div>
  );
};
