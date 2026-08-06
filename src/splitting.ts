import {
  LINE_MAX_CHARS,
  SCREEN_MAX_CHARS,
  SCREEN_MAX_LINES,
} from "./config.ts";

export type Screen = {
  id: number;
  text: string;
  lines: string[];
};

const SENTENCE_END = /[。！？!?；;]/;

export const splitIntoSentences = (raw: string): string[] => {
  const cleaned = raw
    .replace(/\r/g, "")
    .replace(/\s+/g, "")
    .replace(/[“”"']/g, "")
    .trim();

  if (!cleaned) {
    return [];
  }

  const sentences: string[] = [];
  let buffer = "";

  for (const ch of cleaned) {
    buffer += ch;
    if (SENTENCE_END.test(ch)) {
      sentences.push(buffer);
      buffer = "";
    }
  }
  if (buffer) {
    sentences.push(buffer);
  }

  return sentences.filter((s) => s.trim().length > 0);
};

const COMMA = /[，,、：:；;]/;

const splitPhraseIntoChunks = (phrase: string): string[] => {
  if (phrase.length <= SCREEN_MAX_CHARS) {
    return [phrase];
  }
  const k = Math.ceil(phrase.length / SCREEN_MAX_CHARS);
  const base = Math.ceil(phrase.length / k);
  const chunks: string[] = [];
  for (let i = 0; i < k - 1; i++) {
    chunks.push(phrase.slice(i * base, (i + 1) * base));
  }
  chunks.push(phrase.slice((k - 1) * base));
  return chunks;
};

export const splitSentenceIntoScreens = (
  sentence: string,
  startId: number,
): Screen[] => {
  const screens: Screen[] = [];
  let id = startId;

  const phrases: string[] = [];
  let phraseBuffer = "";
  for (const ch of sentence) {
    phraseBuffer += ch;
    if (COMMA.test(ch)) {
      phrases.push(phraseBuffer);
      phraseBuffer = "";
    }
  }
  if (phraseBuffer) {
    phrases.push(phraseBuffer);
  }

  const chunks = phrases.flatMap(splitPhraseIntoChunks);
  const pushScreen = (text: string) => {
    screens.push({
      id: id++,
      text,
      lines: layoutLines(text),
    });
  };

  let screenBuffer = "";
  for (const chunk of chunks) {
    if (screenBuffer.length + chunk.length <= SCREEN_MAX_CHARS) {
      screenBuffer += chunk;
    } else if (screenBuffer.length > 0) {
      pushScreen(screenBuffer);
      screenBuffer = chunk;
    } else {
      pushScreen(chunk);
    }
  }
  if (screenBuffer) {
    pushScreen(screenBuffer);
  }

  return screens;
};

export const layoutLines = (text: string): string[] => {
  const lines: string[] = [];
  let current = "";

  for (const ch of text) {
    current += ch;
    if (current.length >= LINE_MAX_CHARS) {
      lines.push(current);
      current = "";
    }
  }
  if (current) {
    lines.push(current);
  }

  while (lines.length > SCREEN_MAX_LINES) {
    const excess = lines.length - SCREEN_MAX_LINES;
    const last = lines[SCREEN_MAX_LINES - 1];
    const tail = lines.slice(SCREEN_MAX_LINES).join("");
    lines[SCREEN_MAX_LINES - 1] = last + tail;
    lines.length = SCREEN_MAX_LINES;
    void excess;
  }

  return lines;
};

export const buildScreens = (raw: string): Screen[] => {
  const sentences = splitIntoSentences(raw);
  let id = 0;
  const screens: Screen[] = [];

  for (const sentence of sentences) {
    screens.push(...splitSentenceIntoScreens(sentence, id));
    id = screens.length;
  }

  return screens;
};
