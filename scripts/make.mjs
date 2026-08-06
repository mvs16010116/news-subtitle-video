import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { Input, ALL_FORMATS, FilePathSource } from "mediabunny";

const PY = "C:\\Users\\user\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe";
const TTS_SCRIPT = join(import.meta.dirname, "tts_word.py");
const FFMPEG = join(
  import.meta.dirname,
  "..",
  "node_modules",
  "@remotion",
  "compositor-win32-x64-msvc",
  "ffmpeg.exe",
);

const txtPath = resolve(process.argv[2] ?? "news.txt");
const outName = basename(txtPath, ".txt");
const root = resolve(import.meta.dirname, "..");

const audioDir = join(root, "public", "audio");
const dataDir = join(root, "public", "data");
const tempDir = join(root, "data");
mkdirSync(audioDir, { recursive: true });
mkdirSync(dataDir, { recursive: true });
mkdirSync(tempDir, { recursive: true });

const config = {
  voice: "zh-CN-YunyangNeural",
  rate: "-10%",
};

const { buildScreens, layoutLines } = await import(pathToFileURL(join(root, "src", "splitting.ts")).href);

const raw = readFileSync(txtPath, "utf8");
const screens = buildScreens(raw);
console.log(`text: ${raw.length} chars -> ${screens.length} screens`);

// the on-screen subtitle drops punctuation (rendered as spaces) while the TTS
// keeps the original text so speech pauses stay natural
const DISPLAY_PUNCT = /[，。！？!?；;、：:]/g;
const displayTexts = screens.map((s) => s.text.replace(DISPLAY_PUNCT, " "));
const displayLines = displayTexts.map((text) => layoutLines(text));

// synthesize the whole text in ONE pass so speech is a single continuous
// utterance (no forced pauses between screens); then slice it per screen at
// word boundaries with ffmpeg so no word is ever split
const fullText = screens.map((s) => s.text).join("");
const fullAudioFile = join(tempDir, "full.mp3");
const fullWordsFile = join(tempDir, "full-words.json");

console.log(`synthesizing full text (${fullText.length} chars) in one pass ...`);
execFileSync(
  PY,
  [TTS_SCRIPT, config.voice, config.rate, fullText, fullAudioFile, fullWordsFile],
  { stdio: "inherit" },
);
const fullWords = JSON.parse(readFileSync(fullWordsFile, "utf8"));

// edge-tts word boundaries skip punctuation, so map against a punctuation-free
// "spoken stream" of the screens instead of raw char offsets
const PUNCT = /[，。！？!?；;、：:]/g;
const screenSpoken = screens.map((s) => s.text.replace(PUNCT, ""));
const spokenStart = [];
{
  let acc = 0;
  for (const sp of screenSpoken) {
    spokenStart.push(acc);
    acc += sp.length;
  }
}

// spoken char index -> word index, and each word's spoken start position
const wordsWithPos = [];
const charToWord = [];
for (const w of fullWords) {
  wordsWithPos.push({ ...w, startPos: charToWord.length });
  for (let c = 0; c < w.text.length; c++) charToWord.push(wordsWithPos.length - 1);
}

// assign every word that overlaps a screen's spoken range, so no spoken char
// is left without a word (a word spanning a screen boundary appears in both)
const screenWords = screens.map(() => []);
for (let si = 0; si < screens.length; si++) {
  const start = spokenStart[si];
  const end = start + screenSpoken[si].length;
  const seen = new Set();
  for (let c = start; c < end; c++) {
    const wi = charToWord[c];
    if (wi !== undefined && !seen.has(wi)) {
      seen.add(wi);
      screenWords[si].push(wordsWithPos[wi]);
    }
  }
}

// slice boundaries (100ns ticks): a screen starts at its first word that begins
// inside it; screen 0 keeps the natural leading silence from the file start
const sliceStart = [];
for (let i = 0; i < screens.length; i++) {
  if (i === 0) {
    sliceStart.push(0);
    continue;
  }
  const startPos = spokenStart[i];
  const first = screenWords[i].find((w) => w.startPos >= startPos);
  sliceStart.push(
    first ? first.offset : (screenWords[i][0]?.offset ?? sliceStart[i - 1]),
  );
}

const sliceEnd = [];
for (let i = 0; i < screens.length; i++) {
  if (i < screens.length - 1) {
    sliceEnd.push(sliceStart[i + 1]);
  } else {
    const last = screenWords[i].at(-1);
    sliceEnd.push(
      last ? last.offset + last.duration + 6_000_000 : sliceStart[i] + 5_000_000,
    );
  }
}

if (!existsSync(FFMPEG)) {
  throw new Error(`ffmpeg not found: ${FFMPEG}`);
}

const segments = [];
for (let i = 0; i < screens.length; i++) {
  const screen = screens[i];
  const audioFile = join(audioDir, `screen-${screen.id}.mp3`);
  let startSec = sliceStart[i] / 10_000_000;
  let endSec = sliceEnd[i] / 10_000_000;
  if (endSec <= startSec) endSec = startSec + 0.05;

  execFileSync(
    FFMPEG,
    [
      "-y",
      "-i",
      fullAudioFile,
      "-ss",
      startSec.toFixed(4),
      "-to",
      endSec.toFixed(4),
      "-c",
      "copy",
      audioFile,
    ],
    { stdio: "inherit" },
  );

  const input = new Input({
    formats: ALL_FORMATS,
    source: new FilePathSource(audioFile),
  });
  const durationSeconds = Number((await input.computeDuration()).toFixed(3));
  await input.dispose();

  // offsets relative to the slice start, so the word highlight stays in sync
  // with the (now trimmed) per-screen audio
  const words = screenWords[i].map((w) => ({
    text: w.text,
    offset: w.offset - sliceStart[i],
    duration: w.duration,
  }));

  segments.push({
    id: screen.id,
    text: displayTexts[i],
    lines: displayLines[i],
    audioFile: `audio/screen-${screen.id}.mp3`,
    durationSeconds,
    words,
  });
  console.log(
    `  screen ${screen.id}: "${displayTexts[i]}" (${durationSeconds.toFixed(2)}s, ${words.length} words)`,
  );
}

const manifest = {
  title: outName,
  segments,
  config: {
    videoWidth: 1080,
    videoHeight: 1920,
    fps: 60,
    leadInSeconds: 0.8,
    leadOutSeconds: 1.6,
    screenGapSeconds: 0,
    wordHighlightLeadMs: 100,
    wordHighlightLagMs: 150,
  },
};

writeFileSync(join(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`manifest written: public/data/manifest.json (${segments.length} segments)`);

const rendersDir = join(root, "public", "renders");
mkdirSync(rendersDir, { recursive: true });
const outFile = join(rendersDir, `${outName}.mp4`);

if (process.env.SKIP_RENDER === "1") {
  console.log("SKIP_RENDER=1, skipping render step");
  process.exit(0);
}

console.log(`rendering -> ${outFile}`);

execFileSync(
  "npx",
  ["remotion", "render", "NewsVideo", outFile, "--codec", "h264"],
  { stdio: "inherit", cwd: root },
);

// loudness-normalize the final mix (EBU R128): the TTS peaks near -1 dBFS but
// its average sits ~-31 dB, so a plain gain would clip. loudnorm raises the
// perceived loudness while capping true peak, preserving internal timing.
const normFile = `${outFile}.norm.mp4`;
execFileSync(
  FFMPEG,
  [
    "-y",
    "-i",
    outFile,
    "-af",
    "loudnorm=I=-14:TP=-1.5:LRA=11",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    normFile,
  ],
  { stdio: "inherit" },
);
renameSync(normFile, outFile);
console.log(`done: ${outFile}`);
