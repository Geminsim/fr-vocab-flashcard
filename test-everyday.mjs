import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const root = import.meta.dirname;
const load = file => {
  const context = { window: {} };
  runInNewContext(readFileSync(resolve(root, file), "utf8"), context);
  return context.window;
};
const quiz = {};
runInNewContext(readFileSync(resolve(root, "public/quiz-core.js"), "utf8"), quiz);
const core = quiz.QuizCore;
const exam = load("public/vocab-data.js").TEF_VOCAB_CARDS;
const data = load("public/everyday-data.js");
const daily = data.TEF_EVERYDAY_CARDS;
const normalize = text => text.normalize("NFC").trim().toLocaleLowerCase("fr")
  .replace(/^(?:(?:un|une|le|la|les)\s+|l['’])/, "");

assert.ok(daily.length >= 2500);
assert.equal(data.TEF_EVERYDAY_META.uniqueCards, daily.length);
assert.equal(new Set(daily.map(card => card.id)).size, daily.length);
const examTerms = new Set(exam.map(card => normalize(card.term)));
for (const card of daily) {
  assert.ok(!examTerms.has(normalize(card.term)), `Exam overlap: ${card.term}`);
  assert.deepEqual(Array.from(card.decks), ["everyday"]);
  assert.equal(core.targetForCard(card), 3);
  assert.equal(core.levelEligible(card, "all"), false);
  assert.equal(core.levelEligible(card, "everyday"), true);
  assert.equal(core.eligibleInView(card, "all", "all"), false);
  assert.equal(core.eligibleInView(card, "everyday", "all"), true);
  assert.match(card.meaning, /[\u3400-\u9fff]/);
}
for (const card of exam) {
  assert.equal(core.levelEligible(card, "everyday"), false);
  assert.equal(core.levelEligible(card, "all"), true);
}
assert.ok(daily.filter(card => card.group === "地区口语").length >= 100);
for (const card of daily.filter((_, index) => index % 37 === 0)) {
  assert.equal(core.options(card, daily, () => 0.37, daily).length, 4);
  assert.equal(core.reverseOptions(card, daily, () => 0.37, daily).length, 4);
}
const sample = daily[0];
let record = core.answer(null, false, 1, sample);
for (let i = 2; i <= 3; i++) {
  record = core.answer(record, true, i, sample);
  assert.equal(record.mastered, false);
}
record = core.answer(record, true, 4, sample);
assert.equal(record.mastered, true);
console.log(`PASS: ${daily.length} independent everyday cards and 3-answer mastery`);
