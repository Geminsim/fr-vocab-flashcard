(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TEFExamCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SECONDS_PER_QUESTION = 15;
  const GROUPS = ["听力", "分级词汇", "阅读", "写作", "同义替换", "连接词", "句型", "日常词汇", "地区口语"];
  const LEVELS = ["A1", "A2", "B1", "B2", "everyday", "ultimate"];

  function key(language, direction, level, scope) {
    return [language, direction, level, scope].join("|");
  }

  function questionCount(level, scope, available) {
    const target = level === "ultimate" && scope === "all" ? 60
      : scope === "all" ? 30 : scope.startsWith("topic:") ? 12 : 20;
    return Math.min(target, available);
  }

  function shuffle(items, random = Math.random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function makeQuestions(pool, allCards, level, scope, direction, quizCore, random = Math.random) {
    if (pool.length < 4) throw new Error("This category needs at least four cards for an exam.");
    const count = questionCount(level, scope, pool.length);
    return shuffle(pool, random).slice(0, count).map(card => {
      const options = direction === "reverse"
        ? quizCore.reverseOptions(card, pool, random, allCards)
        : quizCore.options(card, pool, random, allCards);
      const answer = direction === "reverse" ? card.term : card.meaning;
      const correctIndex = options.indexOf(answer);
      if (options.length !== 4 || correctIndex < 0) throw new Error(`Invalid options for ${card.id}`);
      return { cardId: card.id, options, correctIndex };
    });
  }

  function groupsForLevel(cards, level, quizCore) {
    return GROUPS.filter(group => cards.filter(card =>
      card.topicMeta.some(ref => ref.group === group && quizCore.sourceEligible(ref, level))).length >= 10);
  }

  function medalEarned(history, language, direction, level, cards, quizCore) {
    if (!LEVELS.includes(level)) return false;
    const scopes = level === "ultimate" ? ["all"]
      : ["all", ...groupsForLevel(cards, level, quizCore).map(group => `group:${group}`)];
    return scopes.every(scope => history[key(language, direction, level, scope)]?.passed === true);
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
      next.status = next.cursor === next.questions.length ? "passed" : "active";
      next.remainingMs = 15000;
    } else if (action === "wrong" || action === "timeout" || action === "abandon") {
      next.status = action === "abandon" ? "abandoned" : "failed";
      next.failure = action;
      next.remainingMs = 0;
    } else throw new Error("Invalid exam transition");
    return next;
  }

  return { SECONDS_PER_QUESTION, GROUPS, LEVELS, key, questionCount, makeQuestions,
    groupsForLevel, medalEarned, transition };
});
