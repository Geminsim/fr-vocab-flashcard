import { env } from "cloudflare:workers";
import masteryIndex from "./mastery-index.json";
import cardAliases from "./card-aliases.json";

const lowLevelIds = new Set(masteryIndex.lowLevelIds);
const aliases = cardAliases as Record<string, string>;

function canonicalId(cardId: string) {
  const english = cardId.startsWith("en:");
  const unprefixed = english ? cardId.slice(3) : cardId;
  const reverse = unprefixed.startsWith("reverse:");
  const base = reverse ? unprefixed.slice(8) : unprefixed;
  const target = aliases[base] || base;
  return `${english ? "en:" : ""}${reverse ? "reverse:" : ""}${target}`;
}

function mergeLegacyRecords(a: CardRecord, b: CardRecord): CardRecord {
  const mastered = a.mastered || b.mastered;
  return {
    attempts: a.attempts + b.attempts,
    firstCorrect: a.firstCorrect === false || b.firstCorrect === false ? false
      : a.firstCorrect === true || b.firstCorrect === true ? true : null,
    cleanCount: Math.max(a.cleanCount, b.cleanCount),
    streak: Math.max(a.streak, b.streak),
    misses: a.misses + b.misses,
    mastered,
    due: mastered ? 0 : Math.min(a.due, b.due),
  };
}

function masteryTarget(cardId: string) {
  const unprefixed = cardId.startsWith("en:") ? cardId.slice(3) : cardId;
  const baseId = unprefixed.startsWith("reverse:") ? unprefixed.slice(8) : unprefixed;
  return lowLevelIds.has(baseId) ? 2 : 3;
}

function consecutiveCorrect(record: CardRecord) {
  return record.firstCorrect && record.misses === 0
    ? Math.max(record.cleanCount, record.streak) : record.streak;
}

export type CardRecord = {
  attempts: number;
  firstCorrect: boolean | null;
  cleanCount: number;
  streak: number;
  misses: number;
  mastered: boolean;
  due: number;
};

export type CloudProgress = {
  records: Record<string, CardRecord>;
  totalAnswers: number;
  generation: number;
  deviceSeq: Record<string, number>;
  studyLanguage: "en" | "zh" | null;
  exam: ExamState;
};

export type ExamAttempt = {
  id: string;
  key: string;
  language: "en" | "zh";
  direction: "forward" | "reverse";
  level: string;
  scope: string;
  // Version 2 stores a seed and one visible question, not thousands of answer strings.
  format?: 2;
  seed?: number;
  poolHash?: string;
  prefixIds?: string[];
  total?: number;
  question?: { cardId: string; options: string[]; correctIndex: number } | null;
  // Retained only to read an exam started under the former sampled mode.
  questions?: Array<{ cardId: string; options: string[]; correctIndex: number }>;
  cursor: number;
  remainingMs: number;
  status: "active" | "paused" | "failed" | "passed" | "abandoned";
  seq: number;
  startedAt: number;
  updatedAt: number;
  failure?: string;
};

export type ExamState = {
  active: ExamAttempt | null;
  history: Record<string, { best: number; total: number; passed: boolean }>;
  closedIds: string[];
};

function blankExam(): ExamState {
  return { active: null, history: {}, closedIds: [] };
}

function db() {
  if (!env.DB) throw new Error("Progress database is unavailable");
  return env.DB;
}

function blank(): CloudProgress {
  return { records: {}, totalAnswers: 0, generation: 0, deviceSeq: {}, studyLanguage: null,
    exam: blankExam() };
}

function validInt(value: unknown, max = 1_000_000_000) {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max;
}

export function cleanRecord(raw: unknown): CardRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (!validInt(item.attempts, 1_000_000) || Number(item.attempts) === 0) return null;
  const out: CardRecord = {
    attempts: Number(item.attempts),
    firstCorrect: item.firstCorrect === true ? true : item.firstCorrect === false ? false : null,
    cleanCount: 0, streak: 0, misses: 0, mastered: item.mastered === true, due: 0,
  };
  for (const key of ["cleanCount", "streak", "misses", "due"] as const) {
    if (!validInt(item[key])) return null;
    out[key] = Number(item[key]);
  }
  return out;
}

function parsePayload(value: string): CloudProgress {
  const raw = JSON.parse(value) as CloudProgress;
  if (!raw || typeof raw !== "object" || !raw.records) throw new Error("Invalid progress payload");
  // Older accounts have no language choice yet; keep every existing answer intact.
  raw.studyLanguage = raw.studyLanguage === "en" || raw.studyLanguage === "zh" ? raw.studyLanguage : null;
  if (!raw.exam || typeof raw.exam !== "object" || !raw.exam.history) raw.exam = blankExam();
  raw.exam.closedIds = Array.isArray(raw.exam.closedIds) ? raw.exam.closedIds.filter(id =>
    typeof id === "string" && /^[\w-]{8,80}$/.test(id)).slice(-20) : [];
  return raw;
}

function cleanExamQuestion(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Invalid exam question");
  const question = input as Record<string, unknown>;
  if (typeof question.cardId !== "string" ||
      !/^[\w.-]{1,120}$/.test(question.cardId) ||
      !Array.isArray(question.options) || question.options.length !== 4 ||
      question.options.some(option => typeof option !== "string" || !option || option.length > 300) ||
      !validInt(question.correctIndex, 3)) throw new Error("Invalid exam question");
  return { cardId: question.cardId, options: question.options as string[],
    correctIndex: Number(question.correctIndex) };
}

function cleanExamAttempt(input: unknown): ExamAttempt {
  if (!input || typeof input !== "object") throw new Error("Invalid exam attempt");
  const raw = input as Record<string, unknown>;
  const full = raw.format === 2;
  const expectedKey = full ? ["full-v2", raw.language, raw.direction, raw.level, raw.scope].join("|")
    : [raw.language, raw.direction, raw.level, raw.scope].join("|");
  if (typeof raw.id !== "string" || !/^[\w-]{8,80}$/.test(raw.id) ||
      (raw.language !== "en" && raw.language !== "zh") ||
      (raw.direction !== "forward" && raw.direction !== "reverse") ||
      typeof raw.level !== "string" || !["A1", "A2", "B1", "B2", "all", "everyday", "ultimate"].includes(raw.level) ||
      typeof raw.scope !== "string" || !/^(all|(?:group|topic):.{1,80})$/u.test(raw.scope) ||
      raw.key !== expectedKey ||
      !validInt(raw.remainingMs, 15000) ||
      !validInt(raw.seq) || !validInt(raw.startedAt, 9_999_999_999_999) ||
      !validInt(raw.updatedAt, 9_999_999_999_999) ||
      !["active", "paused", "failed", "passed", "abandoned"].includes(String(raw.status))) {
    throw new Error("Invalid exam attempt");
  }
  let versioned: Partial<ExamAttempt>;
  let total: number;
  if (full) {
    if (!validInt(raw.seed, 4_294_967_295) ||
        typeof raw.poolHash !== "string" || !/^\d{1,5}-[0-9a-f]{1,8}$/.test(raw.poolHash) ||
        !validInt(raw.total, 5000) || Number(raw.total) < 1 ||
        !Array.isArray(raw.prefixIds) || raw.prefixIds.length > 60 ||
        raw.prefixIds.some(id => typeof id !== "string" || !/^[\w.-]{1,120}$/.test(id)) ||
        new Set(raw.prefixIds).size !== raw.prefixIds.length) throw new Error("Invalid full-deck exam");
    total = Number(raw.total);
    if (raw.prefixIds.length > total) throw new Error("Invalid full-deck exam");
    const question = raw.question == null ? null : cleanExamQuestion(raw.question);
    if ((raw.status === "active" || raw.status === "paused") && !question) {
      throw new Error("Active exam has no question");
    }
    versioned = { format: 2, seed: Number(raw.seed), poolHash: raw.poolHash,
      prefixIds: raw.prefixIds as string[], total, question };
  } else {
    if (!Array.isArray(raw.questions) || raw.questions.length < 1 || raw.questions.length > 60) {
      throw new Error("Invalid legacy exam");
    }
    const questions = raw.questions.map(cleanExamQuestion);
    total = questions.length;
    versioned = { questions };
  }
  if (!validInt(raw.cursor, total) ||
      (raw.status === "passed") !== (Number(raw.cursor) === total)) {
    throw new Error("Invalid exam result");
  }
  return {
    id: raw.id, key: raw.key as string, language: raw.language, direction: raw.direction,
    level: raw.level, scope: raw.scope, ...versioned,
    cursor: Number(raw.cursor), remainingMs: Number(raw.remainingMs),
    status: raw.status as ExamAttempt["status"], seq: Number(raw.seq),
    startedAt: Number(raw.startedAt), updatedAt: Number(raw.updatedAt),
    failure: typeof raw.failure === "string" ? raw.failure.slice(0, 30) : undefined,
  };
}

export function checkpointExam(progress: CloudProgress, input: unknown): boolean {
  const attempt = cleanExamAttempt(input);
  progress.exam.closedIds ??= [];
  if (progress.exam.closedIds.includes(attempt.id)) return false;
  const current = progress.exam.active;
  if (current && current.id !== attempt.id) throw new Error("Another exam is already in progress");
  if (current && attempt.seq <= current.seq) return false;
  const finished = ["failed", "passed", "abandoned"].includes(attempt.status);
  if (finished) {
    const total = attempt.total ?? attempt.questions!.length;
    const prior = progress.exam.history[attempt.key];
    progress.exam.history[attempt.key] = {
      best: Math.max(prior?.best || 0, attempt.cursor),
      total,
      passed: !!prior?.passed || attempt.status === "passed",
    };
    progress.exam.active = null;
    progress.exam.closedIds = [...progress.exam.closedIds, attempt.id].slice(-20);
  } else progress.exam.active = attempt;
  return true;
}

export function setStudyLanguage(progress: CloudProgress, input: unknown): boolean {
  if (input !== "en" && input !== "zh") throw new Error("Invalid study language");
  if (progress.studyLanguage === input) return false;
  progress.studyLanguage = input;
  return true;
}

export async function readProgress(userId: string): Promise<{ revision: number; progress: CloudProgress }> {
  const row = await db().prepare("SELECT revision, payload FROM flashcard_states WHERE user_id = ?")
    .bind(userId).first<{ revision: number; payload: string }>();
  return row ? { revision: row.revision, progress: parsePayload(row.payload) }
    : { revision: 0, progress: blank() };
}

export async function changeProgress(
  userId: string,
  edit: (progress: CloudProgress) => boolean,
): Promise<{ revision: number; progress: CloudProgress }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { revision, progress } = await readProgress(userId);
    if (!edit(progress)) return { revision, progress };
    const value = JSON.stringify(progress);
    if (revision === 0) {
      const inserted = await db().prepare(
        "INSERT OR IGNORE INTO flashcard_states (user_id, revision, payload) VALUES (?, 1, ?)"
      ).bind(userId, value).run();
      if (inserted.meta.changes === 1) return { revision: 1, progress };
    } else {
      const updated = await db().prepare(
        "UPDATE flashcard_states SET revision = revision + 1, payload = ? WHERE user_id = ? AND revision = ?"
      ).bind(value, userId, revision).run();
      if (updated.meta.changes === 1) return { revision: revision + 1, progress };
    }
  }
  throw new Error("Progress changed on another device; please retry");
}

export function seedProgress(progress: CloudProgress, input: unknown): boolean {
  if (!input || typeof input !== "object") throw new Error("Invalid seed");
  const seed = input as Record<string, unknown>;
  if (!seed.records || typeof seed.records !== "object" || Array.isArray(seed.records)) {
    throw new Error("Invalid card records");
  }
  const entries = Object.entries(seed.records);
  if (entries.length > 25000) throw new Error("Too many cards");
  let changed = false;
  for (const [id, raw] of entries) {
    if (!/^[\w:.-]{1,120}$/.test(id)) continue;
    const record = cleanRecord(raw);
    if (!record) continue;
    const target = canonicalId(id);
    const existing = progress.records[target];
    if (!existing || (record.mastered && !existing.mastered) ||
        (record.mastered === existing.mastered && record.attempts > existing.attempts)) {
      progress.records[target] = record;
      changed = true;
    }
  }
  if (validInt(seed.totalAnswers) && Number(seed.totalAnswers) > progress.totalAnswers) {
    progress.totalAnswers = Number(seed.totalAnswers);
    changed = true;
  }
  return upgradeProgress(progress) || changed;
}

export function upgradeProgress(progress: CloudProgress): boolean {
  let changed = false;
  for (const [id, record] of Object.entries(progress.records)) {
    const target = canonicalId(id);
    if (target === id) continue;
    const existing = progress.records[target];
    progress.records[target] = existing ? mergeLegacyRecords(existing, record) : record;
    delete progress.records[id];
    changed = true;
  }
  for (const [cardId, record] of Object.entries(progress.records)) {
    if (!record.mastered && consecutiveCorrect(record) >= masteryTarget(cardId)) {
      record.mastered = true;
      record.due = 0;
      changed = true;
    }
  }
  return changed;
}

export function answerProgress(progress: CloudProgress, input: Record<string, unknown>): boolean {
  const { deviceId, cardId, correct, seq, generation } = input;
  if (typeof deviceId !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(deviceId) ||
      typeof cardId !== "string" || !/^[\w:.-]{1,120}$/.test(cardId) ||
      typeof correct !== "boolean" || !validInt(seq) || !validInt(generation)) {
    throw new Error("Invalid answer");
  }
  if (Number(generation) !== progress.generation) throw new Error("Progress was reset on another device");
  const previousSeq = progress.deviceSeq[deviceId] || 0;
  if (Number(seq) <= previousSeq) return false;
  if (Number(seq) !== previousSeq + 1) throw new Error("Missing earlier answer from this device");
  const target = canonicalId(cardId);
  const prior = progress.records[target] || {
    attempts: 0, firstCorrect: null, cleanCount: 0, streak: 0,
    misses: 0, mastered: false, due: 0,
  };
  const record = { ...prior };
  if (record.attempts === 0) record.firstCorrect = correct;
  record.attempts++;
  progress.totalAnswers++;
  if (correct) {
    record.streak = consecutiveCorrect(record) + 1;
    if (record.firstCorrect && record.misses === 0) record.cleanCount = record.streak;
    record.mastered = record.mastered || record.streak >= masteryTarget(target);
  } else {
    record.misses++;
    record.cleanCount = 0;
    record.streak = 0;
    record.mastered = false;
  }
  record.due = record.mastered ? 0 : progress.totalAnswers + (correct ? 5 : 3);
  progress.records[target] = record;
  progress.deviceSeq[deviceId] = Number(seq);
  return true;
}

export function replaceProgress(progress: CloudProgress, input: unknown): boolean {
  progress.records = {};
  progress.totalAnswers = 0;
  progress.deviceSeq = {};
  progress.generation++;
  seedProgress(progress, input);
  return true;
}

export function resetProgress(progress: CloudProgress): boolean {
  progress.records = {};
  progress.totalAnswers = 0;
  progress.deviceSeq = {};
  progress.generation++;
  return true;
}
