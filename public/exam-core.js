(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TEFExamCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SECONDS_PER_QUESTION = 15;
  const FORMAT = 2;
  const GROUPS = ["听力", "分级词汇", "阅读", "写作", "同义替换", "连接词", "句型", "日常词汇", "地区口语"];
  const LEVELS = ["A1", "A2", "B1", "B2", "everyday", "ultimate"];

  function key(language, direction, level, scope) {
    return ["full-v2", language, direction, level, scope].join("|");
  }
  function legacyKey(language, direction, level, scope) {
    return [language, direction, level, scope].join("|");
  }
  function questionCount(_level, _scope, available) { return available; }

  function shuffle(items, random = Math.random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ state >>> 15, 1 | state);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function poolHash(pool) {
    let hash = 2166136261;
    for (const id of pool.map(card => card.id).sort()) {
      for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
      hash = Math.imul(hash ^ 10, 16777619);
    }
    return `${pool.length}-${(hash >>> 0).toString(16)}`;
  }
  function orderIds(pool, seed, prefixIds = []) {
    const ids = pool.map(card => card.id).sort();
    const allowed = new Set(ids);
    const prefix = [...new Set(prefixIds)];
    if (prefix.length !== prefixIds.length || prefix.some(id => !allowed.has(id))) {
      throw new Error("Saved exam cards no longer match this deck.");
    }
    const used = new Set(prefix);
    return prefix.concat(shuffle(ids.filter(id => !used.has(id)), seededRandom(seed)));
  }
  function makeQuestion(card, pool, deck, direction, quizCore, random = Math.random) {
    if (!card || !pool.length || deck.length < 4) throw new Error("This category has no usable exam cards.");
    const options = direction === "reverse"
      ? quizCore.reverseOptions(card, pool, random, deck)
      : quizCore.options(card, pool, random, deck);
    const answer = direction === "reverse" ? card.term : card.meaning;
    const correctIndex = options.indexOf(answer);
    if (options.length !== 4 || correctIndex < 0) throw new Error(`Invalid options for ${card.id}`);
    return { cardId: card.id, options, correctIndex };
  }

  function groupsForLevel(cards, level, quizCore) {
    return GROUPS.filter(group => cards.some(card =>
      card.topicMeta.some(ref => ref.group === group && quizCore.sourceEligible(ref, level))));
  }
  function medalEarned(history, language, direction, level, cards, quizCore) {
    if (!LEVELS.includes(level)) return false;
    const scopes = level === "ultimate" ? ["all"]
      : ["all", ...groupsForLevel(cards, level, quizCore).map(group => `group:${group}`)];
    return scopes.every(scope => {
      const total = cards.filter(card => quizCore.eligibleInView(card, level, scope)).length;
      const result = history[key(language, direction, level, scope)];
      return result?.passed === true && result.total === total;
    });
  }

  function transition(attempt, action, remainingMs = attempt.remainingMs) {
    const next = { ...attempt, seq: attempt.seq + 1, updatedAt: Date.now() };
    if (action === "pause") {
      next.status = "paused";
      next.remainingMs = Math.max(1, Math.min(15000, Math.floor(remainingMs)));
    } else if (action === "resume") {
      next.status = "active";
    } else if (action === "correct") {
      next.cursor++;
      next.status = next.cursor === next.total ? "passed" : "active";
      next.remainingMs = 15000;
      if (next.status === "passed") next.question = null;
    } else if (action === "wrong" || action === "timeout" || action === "abandon") {
      next.status = action === "abandon" ? "abandoned" : "failed";
      next.failure = action;
      next.remainingMs = 0;
    } else throw new Error("Invalid exam transition");
    return next;
  }

  return { FORMAT, SECONDS_PER_QUESTION, GROUPS, LEVELS, key, legacyKey, questionCount,
    poolHash, orderIds, makeQuestion, groupsForLevel, medalEarned, transition };
});
