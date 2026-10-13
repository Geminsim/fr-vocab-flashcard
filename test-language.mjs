import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const window = {};
const quiz = {};
vm.runInNewContext(fs.readFileSync("public/quiz-core.js", "utf8"), quiz);
const QuizCore = quiz.QuizCore;
for (const file of ["vocab-data.js", "everyday-data.js", "english-data.js"]) {
  vm.runInNewContext(fs.readFileSync(`public/${file}`, "utf8"), { window });
}
const original = [...window.TEF_VOCAB_CARDS, ...window.TEF_EVERYDAY_CARDS];
const english = window.TEF_ENGLISH_MEANINGS;
assert.equal(Object.keys(english).length, original.length, "Every card needs an English meaning");
const cards = original.map(card => ({ ...card, meaning: english[card.id] }));
assert(cards.every(card => typeof card.meaning === "string" && card.meaning.trim()));
assert(cards.every(card => !/[\u3400-\u9fff]/u.test(card.meaning)), "English prompts must not contain Chinese characters");

const samples = cards.filter((_, index) => index % 23 === 0);
for (const card of samples) {
  const pool = card.decks.includes("everyday") ? cards.filter(x => x.decks.includes("everyday"))
    : cards.filter(x => !x.decks.includes("everyday"));
  const forward = QuizCore.options(card, pool, Math.random);
  const reverse = QuizCore.reverseOptions(card, pool, Math.random);
  assert.equal(forward.length, 4);
  assert.equal(reverse.length, 4);
  assert.equal(forward.filter(answer => answer === card.meaning).length, 1);
  assert.equal(reverse.filter(answer => answer === card.term).length, 1);
}
console.log(`PASS: ${cards.length} bilingual cards and ${samples.length} sampled four-choice questions in both directions`);
