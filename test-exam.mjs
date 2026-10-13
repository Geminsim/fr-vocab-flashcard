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
assert.equal(cards.filter(card => core.levelEligible(card, "ultimate")).length, cards.length);
assert.equal(cards.filter(card => core.eligibleInView(card, "ultimate", "group:地区口语")).length > 50, true);
assert.deepEqual(Array.from(exam.groupsForLevel(cards, "A1", core)), ["分级词汇"]);
assert.equal(exam.groupsForLevel(cards, "B2", core).length, 7);
assert.equal(exam.questionCount("ultimate", "all", cards.length), 60);
assert.equal(exam.questionCount("B2", "topic:写作句型", 9), 9);
const questions = exam.makeQuestions(cards, cards, "ultimate", "all", "forward", core, Math.random);
assert.equal(questions.length, 60);
assert.equal(new Set(questions.map(question => question.cardId)).size, 60);
for (const question of questions) {
  assert.equal(question.options.length, 4);
  assert.ok(question.correctIndex >= 0 && question.correctIndex < 4);
}
const first = { id: "exam-test-123", key: exam.key("en", "forward", "A1", "all"),
  language: "en", direction: "forward", level: "A1", scope: "all",
  questions: questions.slice(0, 4), cursor: 0, remainingMs: 15000,
  status: "active", seq: 0, startedAt: Date.now(), updatedAt: Date.now() };
const paused = exam.transition(first, "pause", 7200);
assert.equal(paused.remainingMs, 7200);
assert.equal(paused.status, "paused");
const resumed = exam.transition(paused, "resume");
assert.equal(resumed.status, "active");
const wrong = exam.transition(resumed, "wrong");
assert.equal(wrong.status, "failed");
assert.equal(wrong.cursor, 0);

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
const progress = { records: { "sample-card": { attempts: 2, firstCorrect: true,
  cleanCount: 2, streak: 2, misses: 0, mastered: true, due: 0 } },
  totalAnswers: 2, generation: 0, deviceSeq: {}, studyLanguage: "en",
  exam: { active: null, history: {} } };
assert.equal(server.checkpointExam(progress, first), true);
assert.equal(server.checkpointExam(progress, paused), true);
assert.equal(server.checkpointExam(progress, wrong), true);
assert.equal(progress.exam.active, null);
assert.equal(progress.exam.history[first.key].best, 0);
assert.equal(progress.exam.history[first.key].passed, false);
assert.equal(progress.records["sample-card"].attempts, 2);
assert.equal(progress.totalAnswers, 2);
const passed = { ...first, id: "exam-test-456", seq: 4, cursor: first.questions.length,
  status: "passed", updatedAt: Date.now() + 1 };
assert.equal(server.checkpointExam(progress, passed), true);
assert.equal(progress.exam.history[first.key].best, 4);
assert.equal(progress.exam.history[first.key].passed, true);
assert.equal(exam.medalEarned({ [first.key]: progress.exam.history[first.key] },
  "en", "forward", "A1", cards, core), false);
const groupKey = exam.key("en", "forward", "A1", "group:分级词汇");
assert.equal(exam.medalEarned({ [first.key]: progress.exam.history[first.key],
  [groupKey]: { best: 20, total: 20, passed: true } }, "en", "forward", "A1", cards, core), true);
assert.throws(() => server.checkpointExam(progress, { ...first, key: "wrong" }), /Invalid exam/);
console.log("PASS: all-deck eligibility, exam transitions, account checkpoints, best scores and medals");
