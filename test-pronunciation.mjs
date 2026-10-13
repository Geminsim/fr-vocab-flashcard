import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync(resolve(import.meta.dirname, "public/pronunciation.js"), "utf8"), context);
const { createEngine } = context.TEFPronunciation;

class Utterance {
  constructor(text) { this.text = text; }
}

const spoken = [];
let cancelled = 0;
let voices = [
  { lang: "en-US", name: "English" },
  { lang: "fr-FR", name: "French France" },
  { lang: "fr-CA", name: "French Canada" }
];
const synth = {
  getVoices: () => voices,
  cancel: () => { cancelled++; },
  speak: utterance => { spoken.push(utterance); utterance.onstart?.(); }
};
const engine = createEngine(synth, Utterance);
const reports = [];
const report = (message, error) => reports.push({ message, error });
assert.equal(engine.supported, true);
assert.equal(engine.play("contribuer à", { locale: "fr-FR" }, report), true);
assert.equal(spoken.at(-1).text, "contribuer à");
assert.equal(spoken.at(-1).voice.name, "French France");
assert.equal(spoken.at(-1).rate, 0.95);
assert.equal(engine.play("prendre rendez-vous", { locale: "fr-CA", slow: true }, report), true);
assert.equal(spoken.at(-1).voice.name, "French Canada");
assert.equal(spoken.at(-1).rate, 0.72);
assert.ok(cancelled >= 2);

voices = [{ lang: "fr-FR", name: "French France" }];
assert.equal(engine.play("service public", { locale: "fr-CA" }, report), true);
assert.match(reports.at(-1).message, /已改用法国法语/);
assert.equal(spoken.at(-1).lang, "fr-FR");

const before = spoken.length;
voices = [{ lang: "en-US", name: "English" }];
assert.equal(engine.play("bonjour", {}, report), false);
assert.equal(spoken.length, before);
assert.equal(reports.at(-1).error, true);

const unsupported = createEngine(null, Utterance);
assert.equal(unsupported.supported, false);
assert.equal(unsupported.play("bonjour", {}, report), false);
assert.equal(reports.at(-1).error, true);

const html = readFileSync(resolve(import.meta.dirname, "public/flashcards.html"), "utf8");
for (const id of ["play-pronunciation", "play-pronunciation-slow", "voice-locale",
  "pronunciation-status", "library-pronunciation-status"]) {
  assert.ok(html.includes(`id="${id}"`), id);
}
assert.ok(html.indexOf("pronunciation.js") < html.indexOf("app.js"));
console.log("Pronunciation tests passed.");
