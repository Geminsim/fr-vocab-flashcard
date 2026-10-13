import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = import.meta.dirname;
const load = name => readFileSync(resolve(root, name), "utf8");
const browser = { window: {} };
runInNewContext(load("public/vocab-data.js"), browser);
runInNewContext(load("public/everyday-data.js"), browser);
runInNewContext(load("public/quiz-core.js"), browser);
runInNewContext(load("public/exam-core.js"), browser);
const cards = [...browser.window.TEF_VOCAB_CARDS, ...browser.window.TEF_EVERYDAY_CARDS];
const core = browser.QuizCore;
const exam = browser.TEFExamCore;
assert.equal(cards.length, 4897);
assert.equal(cards.filter(card => core.levelEligible(card, "ultimate")).length, 4897);
assert.equal(exam.questionCount("ultimate", "all", cards.length), 4897);
assert.equal(exam.questionCount("A1", "all", 553), 553);
assert.equal(exam.questionCount("B2", "topic:写作句型", 9), 9);
assert.deepEqual(Array.from(exam.groupsForLevel(cards, "A1", core)), ["分级词汇"]);

const allOrder = exam.orderIds(cards, 230713);
assert.equal(allOrder.length, cards.length);
assert.equal(new Set(allOrder).size, cards.length);
assert.deepEqual(allOrder, exam.orderIds(cards, 230713));
assert.notDeepEqual(allOrder.slice(0, 20), exam.orderIds(cards, 17).slice(0, 20));
assert.match(exam.poolHash(cards), /^4897-[0-9a-f]+$/);
const firstCard = cards.find(card => card.id === allOrder[0]);
for (const direction of ["forward", "reverse"]) {
  const question = exam.makeQuestion(firstCard, cards, cards, direction, core);
  assert.equal(question.options.length, 4);
  assert.equal(question.options[question.correctIndex], direction === "reverse" ? firstCard.term : firstCard.meaning);
}
const smallScope = cards.filter(card => core.eligibleInView(card, "everyday", "topic:法国粗俗"));
assert.equal(smallScope.length, 3);
assert.equal(exam.questionCount("everyday", "topic:法国粗俗", smallScope.length), 3);
assert.equal(exam.makeQuestion(smallScope[0], smallScope, cards, "forward", core).options.length, 4);

const tiny = cards.slice(0, 4);
const tinyOrder = exam.orderIds(tiny, 314159);
const question = exam.makeQuestion(tiny.find(card => card.id === tinyOrder[0]), tiny, cards, "forward", core);
const first = { id: "exam-test-123", key: exam.key("en", "forward", "A1", "all"),
  language: "en", direction: "forward", level: "A1", scope: "all", format: 2,
  seed: 314159, poolHash: exam.poolHash(tiny), prefixIds: [], total: 4, question,
  cursor: 0, remainingMs: 15000, status: "active", seq: 0,
  startedAt: Date.now(), updatedAt: Date.now() };
const paused = exam.transition(first, "pause", 7200);
assert.equal(paused.remainingMs, 7200);
assert.equal(paused.status, "paused");
const resumed = exam.transition(paused, "resume");
assert.equal(resumed.status, "active");
const wrong = exam.transition(resumed, "wrong");
assert.equal(wrong.status, "failed");
assert.equal(wrong.cursor, 0);
let passed = first;
for (let i = 0; i < 4; i++) passed = exam.transition(passed, "correct");
assert.equal(passed.status, "passed");
assert.equal(passed.cursor, 4);
assert.equal(passed.question, null);

const server = {};
const index = JSON.parse(load("db/mastery-index.json"));
const aliases = JSON.parse(load("db/card-aliases.json"));
const compiled = ts.transpileModule(load("db/progress.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
runInNewContext(compiled, { exports: server,
  require: name => name === "cloudflare:workers" ? { env: {} }
    : name === "./mastery-index.json" ? index
      : name === "./card-aliases.json" ? aliases : assert.fail(name),
});
const record = { attempts: 2, firstCorrect: true, cleanCount: 2,
  streak: 2, misses: 0, mastered: true, due: 0 };
const legacyKey = exam.legacyKey("en", "forward", "A1", "all");
const progress = { records: { "sample-card": record }, totalAnswers: 2,
  generation: 0, deviceSeq: {}, studyLanguage: "en",
  exam: { active: null, history: { [legacyKey]: { best: 27, total: 30, passed: false } } } };
assert.equal(server.checkpointExam(progress, first), true);
assert.equal(server.checkpointExam(progress, paused), true);
assert.equal(server.checkpointExam(progress, wrong), true);
assert.equal(progress.exam.active, null);
assert.equal(progress.exam.history[first.key].best, 0);
assert.equal(progress.exam.history[legacyKey].best, 27);
assert.equal(progress.exam.closedIds.includes(first.id), true);
assert.equal(server.checkpointExam(progress, paused), false);
assert.equal(progress.exam.active, null);
assert.equal(progress.records["sample-card"].attempts, 2);
assert.equal(progress.totalAnswers, 2);
assert.equal(server.checkpointExam(progress, { ...passed, id: "exam-test-456" }), true);
assert.equal(progress.exam.history[first.key].best, 4);
assert.equal(progress.exam.history[first.key].passed, true);
assert.throws(() => server.checkpointExam(progress, { ...first, key: "wrong" }), /Invalid exam/);
assert.throws(() => server.checkpointExam(progress, { ...first, total: 0 }), /Invalid full-deck/);

const a1Total = cards.filter(card => core.eligibleInView(card, "A1", "all")).length;
const a1Group = cards.filter(card => core.eligibleInView(card, "A1", "group:分级词汇")).length;
const a1History = {
  [exam.key("en", "forward", "A1", "all")]: { best: a1Total, total: a1Total, passed: true },
  [exam.key("en", "forward", "A1", "group:分级词汇")]: { best: a1Group, total: a1Group, passed: true },
};
assert.equal(exam.medalEarned(a1History, "en", "forward", "A1", cards, core), true);
assert.equal(exam.medalEarned({ ...a1History, [exam.key("en", "forward", "A1", "all")]:
  { best: 30, total: 30, passed: true } }, "en", "forward", "A1", cards, core), false);
console.log("PASS: every-card exams, compact seeded saves, legacy history, full-scope medals");
