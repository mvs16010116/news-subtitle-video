import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.cwd());
const { buildScreens } = await import(pathToFileURL(join(root, "src", "splitting.ts")).href);
const raw = readFileSync(join(root, "news.txt"), "utf8");
const screens = buildScreens(raw);
const fullWords = JSON.parse(readFileSync(join(root, "data", "full-words.json"), "utf8"));

const PUNCT = /[，。！？!?；;、：:]/g;
const screenSpoken = screens.map((s) => s.text.replace(PUNCT, ""));
const spokenStart = [];
let acc = 0;
for (const sp of screenSpoken) {
  spokenStart.push(acc);
  acc += sp.length;
}
console.log("screens:", screens.length, "spoken total:", acc, "words concat:", fullWords.map((w) => w.text).join("").length);

// charToWord: spoken char index -> word index covering it
const wordsWithPos = [];
const charToWord = [];
fullWords.forEach((w, wi) => {
  wordsWithPos.push({ ...w, startPos: charToWord.length });
  for (let c = 0; c < w.text.length; c++) charToWord.push(wi);
});
console.log("charToWord length:", charToWord.length);

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
console.log("words assigned:", screenWords.reduce((a, b) => a + b.length, 0));

// slice start = first word STARTING in this screen's spoken range
const sliceStart = [];
for (let i = 0; i < screens.length; i++) {
  if (i === 0) {
    sliceStart.push(0);
    continue;
  }
  const startPos = spokenStart[i];
  let first = null;
  for (const w of screenWords[i]) {
    const wpos = w.startPos;
    if (wpos !== undefined && wpos >= startPos) {
      first = w;
      break;
    }
  }
  sliceStart.push(first ? first.offset : screenWords[i][0]?.offset ?? sliceStart[i - 1]);
}
const sliceEnd = [];
for (let i = 0; i < screens.length; i++) {
  if (i < screens.length - 1) sliceEnd.push(sliceStart[i + 1]);
  else {
    const last = screenWords[i].at(-1);
    sliceEnd.push(last ? last.offset + last.duration + 6_000_000 : sliceStart[i] + 5_000_000);
  }
}

for (let i = 0; i < screens.length; i++) {
  const ws = screenWords[i];
  const start = (sliceStart[i] / 1e7).toFixed(3);
  const end = (sliceEnd[i] / 1e7).toFixed(3);
  const firstW = ws[0] ? ws[0].text + "@" + (ws[0].offset / 1e7).toFixed(3) : "NONE";
  const lastW = ws.at(-1) ? ws.at(-1).text : "NONE";
  console.log(
    `s${i} [${start}->${end}] ${ws.length}w first=${firstW} last=${lastW} text=${screens[i].text}`,
  );
}
