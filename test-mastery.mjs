import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = import.meta.dirname;
const quiz = {};
runInNewContext(readFileSync(resolve(root, "public/quiz-core.js"), "utf8"), quiz);
const core = quiz.QuizCore;
const vocabulary = { window: {} };
runInNewContext(readFileSync(resolve(root, "public/vocab-data.js"), "utf8"), vocabulary);
const cards = vocabulary.window.TEF_VOCAB_CARDS;
const meta = vocabulary.window.TEF_VOCAB_META;
const aliases = vocabulary.window.TEF_CARD_ALIASES;
const index = JSON.parse(readFileSync(resolve(root, "db/mastery-index.json"), "utf8"));
assert.equal(index.signature, meta.signature);
assert.deepEqual(index.lowLevelIds, Array.from(cards)
  .filter(card => core.targetForCard(card) === 2).map(card => card.id).sort());

const listening = cards.filter(card => card.groups.includes("听力"));
assert.equal(meta.baselineSignature, "fe6bdceea7587427");
assert.equal(meta.baselineCards, 924);
assert.equal(meta.uniqueCards, cards.length);
assert.equal(meta.listeningCards, 216);
assert.equal(listening.length, 216);
assert.equal(cards.length, 2288);
assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
assert.equal(new Set(cards.map(card => card.term.normalize("NFC").toLocaleLowerCase("fr"))).size, cards.length);
assert.equal(Object.keys(aliases).length, 233);
for (const target of Object.values(aliases)) assert.ok(cards.some(card => card.id === target));
assert.equal(cards.reduce((total, card) => total + card.sourceCount, 0), meta.totalOccurrences);
assert.equal(cards.reduce((total, card) => total + card.baselineSourceCount, 0), meta.sourceOccurrences);
assert.equal(new Set(listening.flatMap(card => card.topicMeta.filter(ref => ref.group === "听力")
  .map(ref => ref.topic))).size, 12);
for (const card of listening) {
  assert.ok(card.levels.includes("B2"));
  assert.ok(core.eligibleInView(card, "B2", "group:听力"));
  assert.match(card.meaning, /[\u3400-\u9fff]/);
  const choices = core.options(card, listening, () => 0.37, cards);
  assert.equal(choices.length, 4, card.term);
  assert.equal(new Set(choices).size, 4, card.term);
  assert.ok(choices.includes(card.meaning), card.term);
}
for (const card of cards) {
  const choices = core.reverseOptions(card, cards, () => 0.37, cards);
  assert.equal(choices.length, 4, card.term);
  assert.equal(new Set(choices.map(choice => choice.toLocaleLowerCase("fr"))).size, 4, card.term);
  assert.ok(choices.includes(card.term), card.term);
}

const low = cards.find(card => card.levels.includes("A1"));
const high = cards.find(card => card.levels.includes("B1") && core.targetForCard(card) === 3);
const overlap = cards.find(card => card.levels.includes("A2") && card.levels.includes("B2"));
assert.equal(core.targetForCard(overlap), 2);

function answerSequence(card, sequence, initial) {
  return sequence.reduce((record, correct, index) =>
    core.answer(record, correct, (initial?.attempts || 0) + index + 1, card), initial);
}

assert.equal(answerSequence(low, [true]).mastered, false);
assert.equal(answerSequence(low, [true, true]).mastered, true);
assert.equal(answerSequence(low, [false, true, true]).mastered, true);
assert.equal(answerSequence(low, [true, false, true, true]).mastered, true);
assert.equal(answerSequence(high, [true, true]).mastered, false);
assert.equal(answerSequence(high, [true, true, true]).mastered, true);
assert.equal(answerSequence(high, [false, true, true, true]).mastered, true);
assert.equal(answerSequence(high, [true, true, false, true, true]).mastered, false);
assert.equal(answerSequence(high, [true, true, false, true, true, true]).mastered, true);

const oldClean = { attempts: 1, firstCorrect: true, cleanCount: 1,
  streak: 0, misses: 0, mastered: false, due: 5 };
const oldCorrected = { attempts: 2, firstCorrect: false, cleanCount: 0,
  streak: 1, misses: 1, mastered: false, due: 5 };
assert.equal(core.progress(oldClean, low).label, "连续答对 · 1/2");
assert.equal(answerSequence(low, [true], oldClean).mastered, true);
assert.equal(answerSequence(low, [true], oldCorrected).mastered, true);
assert.equal(answerSequence(high, [true], { ...oldClean, attempts: 2, cleanCount: 2 }).mastered, true);
assert.equal(answerSequence(high, [true], { ...oldCorrected, mastered: true }).mastered, true);
assert.equal(answerSequence(high, [false], { ...oldCorrected, mastered: true }).mastered, false);

const server = {};
const serverSource = readFileSync(resolve(root, "db/progress.ts"), "utf8");
const compiled = ts.transpileModule(serverSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
runInNewContext(compiled, {
  exports: server,
  require: name => name === "cloudflare:workers" ? { env: {} }
    : name === "./mastery-index.json" ? index
      : name === "./card-aliases.json" ? aliases : assert.fail(`Unexpected import: ${name}`),
});

const [legacyId, canonicalId] = Object.entries(aliases)[0];
const legacyProgress = { records: {
  [legacyId]: { attempts: 2, firstCorrect: true, cleanCount: 2, streak: 2,
    misses: 0, mastered: true, due: 0 },
  [`reverse:${legacyId}`]: { attempts: 1, firstCorrect: false, cleanCount: 0,
    streak: 0, misses: 1, mastered: false, due: 3 },
}, totalAnswers: 3, generation: 0, deviceSeq: {} };
assert.equal(server.upgradeProgress(legacyProgress), true);
assert.equal(legacyProgress.records[canonicalId].mastered, true);
assert.equal(legacyProgress.records[`reverse:${canonicalId}`].misses, 1);
assert.equal(legacyProgress.records[legacyId], undefined);

function serverSequence(card, sequence, initial) {
  const progress = { records: initial ? { [card.id]: { ...initial } } : {},
    totalAnswers: initial?.attempts || 0, generation: 0, deviceSeq: {} };
  sequence.forEach((correct, position) => server.answerProgress(progress, {
    deviceId: "test-device-123", cardId: card.id, correct, seq: position + 1, generation: 0,
  }));
  return progress.records[card.id];
}

for (const card of [low, high, overlap]) {
  for (const sequence of [[true], [true, true], [true, true, true],
    [false, true, true], [false, true, true, true], [true, false, true, true]]) {
    assert.equal(serverSequence(card, sequence).mastered,
      answerSequence(card, sequence).mastered, `${card.term}: ${sequence}`);
  }
}
const oldProgress = { records: {
  [low.id]: { ...oldClean, cleanCount: 2 },
  [high.id]: { ...oldCorrected, mastered: true },
}, totalAnswers: 10, generation: 0, deviceSeq: {} };
assert.equal(server.upgradeProgress(oldProgress), true);
assert.equal(oldProgress.records[low.id].mastered, true);
assert.equal(oldProgress.records[low.id].attempts, 1);
assert.equal(oldProgress.records[high.id].mastered, true);
assert.equal(server.upgradeProgress(oldProgress), false);

const twoDirections = { records: { [low.id]: answerSequence(low, [true, true]) },
  totalAnswers: 2, generation: 0, deviceSeq: {} };
server.answerProgress(twoDirections, { deviceId: "reverse-device-123",
  cardId: `reverse:${low.id}`, correct: true, seq: 1, generation: 0 });
assert.equal(twoDirections.records[low.id].mastered, true);
assert.equal(twoDirections.records[`reverse:${low.id}`].mastered, false);
server.answerProgress(twoDirections, { deviceId: "reverse-device-123",
  cardId: `reverse:${low.id}`, correct: true, seq: 2, generation: 0 });
assert.equal(twoDirections.records[`reverse:${low.id}`].mastered, true);

const languageProgress = { records: structuredClone(twoDirections.records),
  totalAnswers: twoDirections.totalAnswers, generation: 0,
  deviceSeq: structuredClone(twoDirections.deviceSeq), studyLanguage: null };
const savedRecords = structuredClone(languageProgress.records);
assert.equal(server.setStudyLanguage(languageProgress, "en"), true);
assert.equal(server.setStudyLanguage(languageProgress, "en"), false);
assert.equal(server.setStudyLanguage(languageProgress, "zh"), true);
assert.deepEqual(languageProgress.records, savedRecords);
server.resetProgress(languageProgress);
assert.equal(languageProgress.studyLanguage, "zh");
assert.throws(() => server.setStudyLanguage(languageProgress, "fr"), /Invalid study language/);

console.log("PASS: both quiz directions, distinct choices, deduplicated terms, and synced mastery");
