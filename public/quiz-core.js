(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.QuizCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function blankRecord() {
    return { attempts: 0, firstCorrect: null, cleanCount: 0, streak: 0,
      misses: 0, mastered: false, due: 0 };
  }

  function targetForCard(card) {
    return card?.levels?.some(level => level === "A1" || level === "A2") ? 2 : 3;
  }

  function consecutiveCorrect(record) {
    return record.firstCorrect && record.misses === 0
      ? Math.max(record.cleanCount, record.streak) : record.streak;
  }

  function answer(previous, correct, answerNumber, card) {
    const next = Object.assign(blankRecord(), previous || {});
    if (next.attempts === 0) next.firstCorrect = !!correct;
    next.attempts += 1;
    if (correct) {
      next.streak = consecutiveCorrect(next) + 1;
      if (next.firstCorrect && next.misses === 0) next.cleanCount = next.streak;
      next.mastered = next.mastered || next.streak >= targetForCard(card);
    } else {
      next.misses += 1;
      next.cleanCount = 0;
      next.streak = 0;
      next.mastered = false;
    }
    next.due = next.mastered ? 0 : answerNumber + (correct ? 5 : 3);
    return next;
  }

  function progress(record, card) {
    const target = targetForCard(card);
    if (!record || !record.attempts) return { label: "尚未作答", current: 0, target };
    if (record.mastered) return { label: "已掌握", current: 1, target: 1 };
    const current = consecutiveCorrect(record);
    return { label: `连续答对 · ${current}/${target}`, current, target };
  }

  function eligible(card, scope) {
    if (scope === "all") return true;
    const [kind, value] = scope.split(":", 2);
    return kind === "group" ? card.groups.includes(value)
      : kind === "topic" ? card.topics.includes(value) : false;
  }

  function levelEligible(card, level) {
    if (level === "ultimate") return true;
    if (level === "all") return !card.decks.includes("everyday");
    if (level === "everyday") return card.decks.includes("everyday");
    return level === "baseline" ? card.decks.includes("baseline") : card.levels.includes(level);
  }

  function sourceEligible(reference, level) {
    if (level === "ultimate") return true;
    if (level === "all") return reference.deck !== "everyday";
    if (level === "everyday") return reference.deck === "everyday";
    return level === "baseline" ? reference.deck === "baseline" : reference.level === level;
  }

  function eligibleInView(card, level, scope) {
    if (!levelEligible(card, level)) return false;
    if (scope === "all") return true;
    const [kind, value] = scope.split(":", 2);
    return card.topicMeta.some(reference => sourceEligible(reference, level) &&
      (kind === "group" ? reference.group === value
        : kind === "topic" ? reference.topic === value : false));
  }

  function pick(list, random) {
    return list[Math.floor(random() * list.length)];
  }

  function nextCard(cards, records, scope, mode, totalAnswers, sessionAnswers,
                    previousId, random = Math.random) {
    let pool = cards.filter(card => eligible(card, scope));
    pool = pool.filter(card => mode === "mastered"
      ? !!records[card.id]?.mastered : !records[card.id]?.mastered);
    if (!pool.length) return null;
    const withoutPrevious = pool.filter(card => card.id !== previousId);
    if (withoutPrevious.length) pool = withoutPrevious;
    if (mode === "mastered") return pick(pool, random);

    const unseen = pool.filter(card => !records[card.id]?.attempts);
    const due = pool.filter(card => records[card.id]?.attempts &&
      records[card.id].due <= totalAnswers);
    const waiting = pool.filter(card => records[card.id]?.attempts &&
      records[card.id].due > totalAnswers);
    const reviewNow = due.length && (!unseen.length || sessionAnswers % 3 === 2);
    if (reviewNow) {
      due.sort((a, b) => records[a.id].due - records[b.id].due);
      return pick(due.slice(0, Math.min(5, due.length)), random);
    }
    if (unseen.length) return pick(unseen, random);
    if (due.length) return pick(due, random);
    waiting.sort((a, b) => records[a.id].due - records[b.id].due);
    return waiting[0];
  }

  function meaningParts(value) {
    return value.split(/[；;，,、（）()]/).map(x => x.trim()).filter(x => x.length >= 2);
  }

  function tooSimilar(a, b) {
    if (a === b || a.includes(b) || b.includes(a)) return true;
    const aParts = meaningParts(a), bParts = meaningParts(b);
    return aParts.some(x => bParts.some(y => x === y || x.includes(y) || y.includes(x)));
  }

  function shuffle(list, random) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function options(card, cards, random = Math.random, fallbackCards = cards) {
    const choices = [card.meaning];
    const suitable = x => x.id !== card.id &&
      x.term.toLocaleLowerCase() !== card.term.toLocaleLowerCase() &&
      !(card.families || []).some(family => (x.families || []).includes(family)) &&
      !(card.connectorTopics || []).some(topic => (x.connectorTopics || []).includes(topic));
    const others = cards.filter(suitable);
    const tiers = [
      others.filter(x => x.topic === card.topic && x.pos === card.pos),
      others.filter(x => x.groups.some(group => card.groups.includes(group))),
      others,
      fallbackCards.filter(suitable),
    ];
    for (const tier of tiers) {
      for (const candidate of shuffle(tier, random)) {
        if (choices.length === 4) break;
        if (choices.every(existing => !tooSimilar(existing, candidate.meaning))) {
          choices.push(candidate.meaning);
        }
      }
      if (choices.length === 4) break;
    }
    if (choices.length !== 4) throw new Error(`Not enough distinct options for ${card.term}`);
    return shuffle(choices, random);
  }

  function reverseOptions(card, cards, random = Math.random, fallbackCards = cards) {
    const choices = [card.term];
    const suitable = x => x.id !== card.id &&
      x.term.toLocaleLowerCase("fr") !== card.term.toLocaleLowerCase("fr") &&
      !tooSimilar(card.meaning, x.meaning) &&
      !(card.families || []).some(family => (x.families || []).includes(family)) &&
      !(card.connectorTopics || []).some(topic => (x.connectorTopics || []).includes(topic));
    const others = cards.filter(suitable);
    const tiers = [
      others.filter(x => x.topic === card.topic && x.pos === card.pos),
      others.filter(x => x.groups.some(group => card.groups.includes(group))),
      others,
      fallbackCards.filter(suitable),
    ];
    for (const tier of tiers) {
      for (const candidate of shuffle(tier, random)) {
        if (choices.length === 4) break;
        if (!choices.some(existing => existing.toLocaleLowerCase("fr") === candidate.term.toLocaleLowerCase("fr"))) {
          choices.push(candidate.term);
        }
      }
      if (choices.length === 4) break;
    }
    if (choices.length !== 4) throw new Error(`Not enough distinct reverse options for ${card.term}`);
    return shuffle(choices, random);
  }

  return { blankRecord, targetForCard, answer, progress, eligible, levelEligible,
    sourceEligible, eligibleInView, nextCard, options, reverseOptions };
});
