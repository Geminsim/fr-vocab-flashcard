(function (root, factory) {
  root.TEFExam = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create({ cards, quizCore, examCore, english, reverse, api, labelFor,
                    levelSelect, scopeSelect, ready, restorePractice, stopSpeech }) {
    const L = (zh, en) => english ? en : zh;
    const language = english ? "en" : "zh";
    const direction = reverse ? "reverse" : "forward";
    const $ = id => document.getElementById(id);
    const quizCard = document.querySelector(".quiz-card");
    const practiceArea = $("question-area");
    const emptyArea = $("empty-state");
    const panel = document.createElement("section");
    panel.className = "panel exam-panel";
    panel.setAttribute("aria-labelledby", "exam-panel-title");
    panel.innerHTML = `<div class="section-heading"><span class="section-index">EX</span><h2 id="exam-panel-title">${L("零失误考试", "Zero-miss exams")}</h2></div>
      <p class="exam-intro">${L("每题 15 秒。答错或超时即结束；考试不改动词汇掌握次数。", "15 seconds per card. One error or timeout ends the attempt. Exams do not change mastery counts.")}</p>
      <div class="exam-selected"><strong id="exam-selected-title"></strong><span id="exam-selected-best"></span></div>
      <button type="button" class="exam-start" id="exam-start">${L("挑战当前范围", "Exam this scope")}</button>
      <div class="exam-active-summary" id="exam-active-summary" hidden><p id="exam-active-copy"></p><div class="exam-active-actions"><button type="button" id="exam-resume">${L("继续考试", "Resume exam")}</button><button type="button" id="exam-abandon">${L("放弃本次", "Abandon attempt")}</button></div></div>
      <p class="exam-sync" id="exam-sync" role="status" aria-live="polite"></p>
      <details class="exam-directory"><summary>${L("各分类考试入口与最高分", "Category exams and best scores")}</summary><div class="exam-directory-list" id="exam-directory-list"></div></details>
      <div class="exam-medal-heading"><strong>${L("勋章陈列", "Medal cabinet")}</strong><small>${L("本语言 · 本答题方向", "This language and direction")}</small></div>
      <div class="exam-medals" id="exam-medals"></div>
      <p class="exam-medal-rule">${L("分级勋章：通过该等级总卷与全部大分类。小主题可额外挑战；“全上！”总卷单独授予终极勋章。", "Level medals: pass the level-wide exam and every main category. Topics are optional; the All In! exam earns its own ultimate medal.")}</p>`;
    document.querySelector(".controls-panel").after(panel);
    const shortcut = document.createElement("button");
    shortcut.type = "button";
    shortcut.className = "exam-shortcut";
    shortcut.textContent = L("进入当前分类考试 · 15 秒/题", "Exam this category · 15 sec/card");
    $("scope-help").after(shortcut);

    const area = document.createElement("div");
    area.id = "exam-area";
    area.hidden = true;
    area.innerHTML = `<div class="exam-header"><span class="exam-pill">${L("考试模式 · 零失误", "EXAM · ZERO MISS")}</span><span id="exam-counter"></span></div>
      <div class="exam-timer-row"><div class="exam-timer" id="exam-timer" role="timer" aria-label="${L("本题剩余时间", "Time remaining")}">15</div><div class="exam-timer-track"><span id="exam-timer-fill"></span></div><button type="button" class="exam-pause" id="exam-pause">${L("暂停并保存", "Pause & save")}</button></div>
      <div class="exam-content" id="exam-content"><p class="exam-scope" id="exam-scope"></p><h2 id="exam-heading"></h2><p class="exam-prompt" id="exam-prompt"></p><div class="answers" id="exam-answers" role="group" aria-label="${L("考试选项", "Exam choices")}"></div></div>
      <div class="exam-cover" id="exam-cover" hidden><strong>${L("已暂停 · 题目已遮蔽", "Paused · question hidden")}</strong><p>${L("进度已保存在本机，并在联网时同步到账号。继续后从本题剩余时间答起。", "Saved on this device and synced to your account when online. Resume with this card's remaining time.")}</p><div><button type="button" id="exam-cover-resume">${L("继续考试", "Resume exam")}</button><button type="button" id="exam-exit">${L("返回练习", "Return to practice")}</button></div></div>
      <div class="exam-result" id="exam-result" hidden><div id="exam-result-medal"></div><h2 id="exam-result-title"></h2><p id="exam-result-copy"></p><div class="exam-result-actions"><button type="button" id="exam-retry">${L("再试一次", "Try again")}</button><button type="button" id="exam-result-exit">${L("返回练习", "Return to practice")}</button></div></div>`;
    quizCard.append(area);
    const refs = {
      start: $("exam-start"), shortcut, selectedTitle: $("exam-selected-title"), selectedBest: $("exam-selected-best"),
      activeSummary: $("exam-active-summary"), activeCopy: $("exam-active-copy"),
      resume: $("exam-resume"), abandon: $("exam-abandon"), sync: $("exam-sync"),
      directory: $("exam-directory-list"), medals: $("exam-medals"), counter: $("exam-counter"),
      timer: $("exam-timer"), timerFill: $("exam-timer-fill"), pause: $("exam-pause"),
      timerRow: area.querySelector(".exam-timer-row"), retry: $("exam-retry"),
      content: $("exam-content"), heading: $("exam-heading"), scope: $("exam-scope"),
      prompt: $("exam-prompt"), answers: $("exam-answers"), cover: $("exam-cover"),
      result: $("exam-result"), resultMedal: $("exam-result-medal"),
      resultTitle: $("exam-result-title"), resultCopy: $("exam-result-copy")
    };
    let accountId = null;
    let localKey = null;
    let data = { active: null, history: {}, pendingAttempt: null, dirty: false };
    let running = false;
    let visible = false;
    let syncing = null;
    let timerId = null;
    let deadline = 0;
    let lastResult = null;

    function examKey(level = levelSelect.value, scope = scopeSelect.value) {
      return examCore.key(language, direction, level, scope);
    }
    function levelName(level) {
      return level === "ultimate" ? L("全上！", "All In!")
        : level === "everyday" ? L("日常与地区用语", "Everyday & regional")
          : level === "all" ? "A1–B2" : level;
    }
    function scopeName(scope) {
      return scope === "all" ? L("全部分类", "All categories")
        : labelFor(scope.slice(scope.indexOf(":") + 1));
    }
    function bestText(scope, level = levelSelect.value) {
      const result = data.history[examKey(level, scope)];
      const available = cards.filter(card => quizCore.eligibleInView(card, level, scope)).length;
      const total = examCore.questionCount(level, scope, available);
      return result ? L(`最高 ${result.best}/${result.total}${result.passed ? " · 已通关" : ""}`,
        `Best ${result.best}/${result.total}${result.passed ? " · passed" : ""}`)
        : L(`尚未挑战 · ${total} 题`, `Not attempted · ${total} cards`);
    }
    function saveLocal() {
      if (!localKey) return;
      try { localStorage.setItem(localKey, JSON.stringify(data)); }
      catch (_) { status(L("本机存储不可用；请保持联网完成云端保存。", "Local storage is unavailable. Stay online for cloud saving."), true); }
    }
    function status(message, error = false) {
      refs.sync.textContent = message;
      refs.sync.classList.toggle("error", error);
    }
    function mergeHistory(remote = {}) {
      for (const [key, result] of Object.entries(remote)) {
        if (!result || !Number.isInteger(result.best)) continue;
        const prior = data.history[key];
        data.history[key] = { best: Math.max(prior?.best || 0, result.best),
          total: result.total, passed: !!prior?.passed || !!result.passed };
      }
    }
    function setVisible(show) {
      visible = show;
      quizCard.classList.toggle("exam-mode", show);
      area.hidden = !show;
      practiceArea.hidden = show;
      emptyArea.hidden = show;
      quizCard.setAttribute("aria-labelledby", show ? "exam-heading" : "question-title");
      if (!show) restorePractice();
    }
    function blurQuestion(blur) {
      refs.content.classList.toggle("is-blurred", blur);
      refs.content.inert = blur;
      refs.cover.hidden = !blur;
    }
    function stopTimer() {
      if (timerId) clearInterval(timerId);
      timerId = null;
    }
    function remaining() { return Math.max(0, Math.ceil(deadline - performance.now())); }
    function renderTimer(ms) {
      const seconds = Math.ceil(ms / 1000);
      refs.timer.textContent = String(seconds);
      refs.timer.classList.toggle("urgent", seconds <= 5);
      refs.timerFill.style.width = `${Math.max(0, Math.min(100, ms / 150))}%`;
    }
    function startTimer() {
      stopTimer();
      if (!data.active || !running) return;
      deadline = performance.now() + data.active.remainingMs;
      renderTimer(data.active.remainingMs);
      timerId = setInterval(() => {
        const ms = remaining();
        renderTimer(ms);
        if (ms <= 0) finishAnswer(-1, "timeout");
      }, 100);
    }
    function renderQuestion() {
      const attempt = data.active;
      if (!attempt) return;
      area.classList.remove("is-result");
      const question = attempt.questions[attempt.cursor];
      const card = cards.find(item => item.id === question.cardId);
      if (!card) { status(L("词库已更新，无法继续这场考试。请放弃后重新开始。", "The deck changed. Abandon this attempt and start again."), true); return; }
      refs.result.hidden = true;
      refs.timerRow.hidden = false;
      refs.content.hidden = false;
      refs.counter.textContent = `${attempt.cursor + 1} / ${attempt.questions.length}`;
      refs.scope.textContent = `${levelName(attempt.level)} · ${scopeName(attempt.scope)}`;
      refs.heading.textContent = reverse ? card.meaning : card.term;
      refs.heading.lang = reverse ? (english ? "en" : "zh-CN") : "fr";
      refs.prompt.textContent = reverse ? L("选出对应的法语词汇。", "Choose the matching French expression.")
        : L("选出对应的中文释义。", "Choose the matching English meaning.");
      refs.answers.replaceChildren();
      question.options.forEach((choice, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option";
        const letter = document.createElement("span");
        letter.className = "option-letter";
        letter.textContent = String.fromCharCode(65 + index);
        const value = document.createElement("span");
        value.className = "option-text";
        value.textContent = choice;
        value.lang = reverse ? "fr" : english ? "en" : "zh-CN";
        button.append(letter, value);
        button.addEventListener("click", () => finishAnswer(index));
        refs.answers.append(button);
      });
      renderTimer(attempt.remainingMs);
    }

    function renderMedals() {
      refs.medals.replaceChildren();
      const names = { A1: "A1", A2: "A2", B1: "B1", B2: "B2",
        everyday: L("日常", "Everyday"), ultimate: L("全上！", "All In!") };
      examCore.LEVELS.forEach(level => {
        const earned = examCore.medalEarned(data.history, language, direction, level, cards, quizCore);
        const item = document.createElement("div");
        item.className = `exam-medal ${earned ? "earned" : "locked"} ${level === "ultimate" ? "ultimate" : ""}`;
        const image = document.createElement("img");
        image.src = `medals/${level.toLowerCase()}.svg`;
        image.alt = earned ? L(`${names[level]} 勋章`, `${names[level]} medal`) : "";
        const label = document.createElement("span");
        label.textContent = names[level];
        const state = document.createElement("small");
        state.textContent = earned ? L("已获得", "Earned") : L("未解锁", "Locked");
        item.append(image, label, state);
        refs.medals.append(item);
      });
    }

    function renderDirectory() {
      refs.directory.replaceChildren();
      for (const option of scopeSelect.options) {
        if (option.value === "all") continue;
        const row = document.createElement("div");
        row.className = "exam-directory-row";
        const info = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = option.textContent.replace(/ · \d+(?: 张)?$/, "");
        const score = document.createElement("small");
        score.textContent = bestText(option.value);
        info.append(name, score);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = L("进入", "Enter");
        button.disabled = !!data.active || !ready();
        button.addEventListener("click", () => start(option.value));
        row.append(info, button);
        refs.directory.append(row);
      }
    }

    function renderPanel() {
      const level = levelSelect.value;
      const scope = scopeSelect.value;
      refs.selectedTitle.textContent = `${levelName(level)} · ${scopeSelect.options[scopeSelect.selectedIndex]?.textContent || ""}`;
      refs.selectedBest.textContent = bestText(scope);
      refs.start.disabled = !ready() || !!data.active || !!data.pendingAttempt;
      refs.shortcut.disabled = refs.start.disabled;
      refs.activeSummary.hidden = !data.active;
      if (data.active) {
        const attempt = data.active;
        refs.activeCopy.textContent = L(`${running ? "进行中" : "待继续"}：${levelName(attempt.level)} · ${scopeName(attempt.scope)} · 第 ${attempt.cursor + 1}/${attempt.questions.length} 题`,
          `${running ? "In progress" : "Resume"}: ${levelName(attempt.level)} · ${scopeName(attempt.scope)} · card ${attempt.cursor + 1}/${attempt.questions.length}`);
        const match = attempt.language === language && attempt.direction === direction;
        refs.resume.disabled = !match || !ready() || running;
        refs.resume.textContent = match ? L("继续考试", "Resume exam")
          : L("请切回原语言与方向", "Switch to the original language and direction");
      }
      renderDirectory();
      renderMedals();
    }

    function recordResult(attempt) {
      const prior = data.history[attempt.key];
      data.history[attempt.key] = { best: Math.max(prior?.best || 0, attempt.cursor),
        total: attempt.questions.length, passed: !!prior?.passed || attempt.status === "passed" };
      data.pendingAttempt = attempt;
      data.active = null;
      data.dirty = false;
      saveLocal();
      renderPanel();
      void syncPending();
    }
    function renderResult(attempt) {
      lastResult = attempt;
      setVisible(true);
      area.classList.add("is-result");
      refs.content.hidden = true;
      blurQuestion(false);
      refs.result.hidden = false;
      refs.timerRow.hidden = true;
      refs.counter.textContent = `${attempt.cursor} / ${attempt.questions.length}`;
      refs.resultTitle.textContent = attempt.status === "passed"
        ? L("零失误通关！", "Flawless pass!") : L("本次考试结束", "Attempt ended");
      const reason = attempt.failure === "timeout" ? L("本题超时。", "Time ran out.")
        : attempt.failure === "wrong" ? L("出现一题错误。", "One answer was incorrect.")
          : L("已放弃本次考试。", "This attempt was abandoned.");
      refs.resultCopy.textContent = `${attempt.status === "passed" ? "" : `${reason} `}${L("本次", "Score")} ${attempt.cursor}/${attempt.questions.length} · ${bestText(attempt.scope, attempt.level)}`;
      refs.resultMedal.replaceChildren();
      refs.retry.disabled = !!data.pendingAttempt;
      refs.retry.textContent = data.pendingAttempt
        ? L("同步后可再试", "Retry after sync") : L("再试一次", "Try again");
      if (attempt.status === "passed" && examCore.medalEarned(data.history, language, direction, attempt.level, cards, quizCore)) {
        const img = document.createElement("img");
        img.src = `medals/${attempt.level.toLowerCase()}.svg`;
        img.alt = L(`${attempt.level} 勋章`, `${attempt.level} medal`);
        refs.resultMedal.append(img);
      }
    }

    function finishAnswer(index, forced) {
      if (!running || !data.active) return;
      const attempt = data.active;
      const ms = remaining();
      stopTimer();
      running = false;
      const question = attempt.questions[attempt.cursor];
      const action = forced === "timeout" || ms <= 0 ? "timeout"
        : index === question.correctIndex ? "correct" : "wrong";
      const next = examCore.transition(attempt, action);
      if (next.status === "active") {
        data.active = next;
        data.dirty = true;
        saveLocal();
        renderQuestion();
        running = true;
        startTimer();
        void syncPending();
      } else {
        recordResult(next);
        renderResult(next);
      }
    }

    function pause() {
      if (!running || !data.active) return;
      blurQuestion(true);
      const ms = remaining();
      stopTimer();
      running = false;
      data.active = examCore.transition(data.active, ms <= 0 ? "timeout" : "pause", ms);
      if (data.active.status === "failed") {
        const failed = data.active;
        recordResult(failed);
        renderResult(failed);
        return;
      }
      data.dirty = true;
      saveLocal();
      renderPanel();
      status(L("已暂停并保存在本机，正在同步账号…", "Paused and saved on this device; syncing to your account…"));
      void syncPending();
    }

    function resume() {
      const attempt = data.active;
      if (!attempt || attempt.language !== language || attempt.direction !== direction || !ready()) return;
      if (attempt.status === "active") data.active = examCore.transition(attempt, "pause", attempt.remainingMs);
      data.active = examCore.transition(data.active, "resume");
      data.dirty = true;
      saveLocal();
      stopSpeech();
      setVisible(true);
      refs.content.hidden = false;
      refs.result.hidden = true;
      renderQuestion();
      blurQuestion(false);
      running = true;
      startTimer();
      renderPanel();
      void syncPending();
    }

    function start(scope = scopeSelect.value) {
      if (!ready() || data.active || data.pendingAttempt) return;
      const level = levelSelect.value;
      const pool = cards.filter(card => quizCore.eligibleInView(card, level, scope));
      const deck = cards.filter(card => quizCore.levelEligible(card, level));
      let questions;
      try { questions = examCore.makeQuestions(pool, deck, level, scope, direction, quizCore); }
      catch (error) { status(error.message, true); return; }
      const now = Date.now();
      data.active = { id: typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID()
        : `${now}-${Math.random().toString(36).slice(2, 12)}`, key: examKey(level, scope),
        language, direction, level, scope, questions, cursor: 0, remainingMs: 15000,
        status: "active", seq: 0, startedAt: now, updatedAt: now };
      data.dirty = true;
      saveLocal();
      stopSpeech();
      setVisible(true);
      renderQuestion();
      blurQuestion(false);
      running = true;
      startTimer();
      renderPanel();
      status(L("每题自动保存；断线后可继续。", "Each answer is saved; you can resume after a disconnect."));
      void syncPending();
      area.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function abandon() {
      if (!data.active || !window.confirm(L("放弃本次考试？已答对题数会计入该分类最高分，但不会获得通关勋章。",
        "Abandon this attempt? Correct answers so far can count toward your best score, but not a pass."))) return;
      if (running) { blurQuestion(true); stopTimer(); running = false; }
      const abandoned = examCore.transition(data.active, "abandon");
      recordResult(abandoned);
      renderResult(abandoned);
    }

    async function syncPending() {
      if (!accountId || !ready()) return false;
      if (!data.pendingAttempt && !(data.dirty && data.active)) return true;
      if (syncing) return syncing;
      const operation = (async () => {
        try {
          while (data.pendingAttempt || (data.dirty && data.active)) {
            const snapshot = data.pendingAttempt || data.active;
            const terminal = !!data.pendingAttempt;
            const remote = await api({ type: "exam", attempt: snapshot });
            mergeHistory(remote.exam?.history);
            if (terminal && data.pendingAttempt?.id === snapshot.id && data.pendingAttempt.seq === snapshot.seq) {
              data.pendingAttempt = null;
              if (data.active?.id === snapshot.id) data.active = null;
            } else if (!terminal && data.active?.id === snapshot.id && data.active.seq === snapshot.seq) {
              data.dirty = false;
            }
            saveLocal();
            renderPanel();
            if (lastResult?.id === snapshot.id) {
              refs.retry.disabled = !!data.pendingAttempt;
              refs.retry.textContent = data.pendingAttempt
                ? L("同步后可再试", "Retry after sync") : L("再试一次", "Try again");
            }
          }
          status(L("考试进度已同步到账号。", "Exam progress synced to your account."));
          return true;
        } catch (error) {
          status(L(`考试进度暂存在本机；联网后会重试。${error.message}`, `Exam progress is saved on this device and will retry online. ${error.message}`), true);
          return false;
        }
      })();
      syncing = operation;
      void operation.finally(() => { if (syncing === operation) syncing = null; });
      return syncing;
    }

    function onAccount(id) {
      if (accountId === id) return;
      stopTimer(); running = false; visible = false; area.hidden = true;
      quizCard.classList.remove("exam-mode");
      accountId = id;
      localKey = `tef-exams-v1:${id}`;
      try {
        const raw = JSON.parse(localStorage.getItem(localKey));
        data = raw && typeof raw === "object" ? {
          active: raw.active || null, history: raw.history || {},
          pendingAttempt: raw.pendingAttempt || null, dirty: raw.dirty === true,
        } : { active: null, history: {}, pendingAttempt: null, dirty: false };
      } catch (_) { data = { active: null, history: {}, pendingAttempt: null, dirty: false }; }
      if (data.active?.status === "active") {
        data.active = examCore.transition(data.active, "pause", data.active.remainingMs);
        data.dirty = true;
        saveLocal();
      }
      renderPanel();
    }

    function onCloud(remote) {
      if (!accountId || !remote || typeof remote !== "object") return;
      mergeHistory(remote.history);
      if (remote.active && data.active && remote.active.id !== data.active.id) {
        if (!data.dirty) data.active = remote.active;
        else status(L("另一台设备已有不同的考试。请先在原设备同步，或放弃本机考试。",
          "Another device has a different exam. Sync the first device or abandon this local attempt."), true);
      } else if (remote.active && data.pendingAttempt?.id === remote.active.id) {
        // A completed local attempt is newer than the last cloud checkpoint.
      } else if (remote.active && (!data.active || remote.active.seq > data.active.seq)) {
        if (running) { stopTimer(); running = false; blurQuestion(true); }
        data.active = remote.active;
        data.dirty = false;
      } else if (!remote.active && data.active && !data.dirty) {
        if (running) { stopTimer(); running = false; blurQuestion(true); }
        data.active = null;
      }
      if (data.active?.status === "active" && !running) {
        data.active = examCore.transition(data.active, "pause", data.active.remainingMs);
        data.dirty = true;
      }
      saveLocal();
      renderPanel();
      if (data.dirty || data.pendingAttempt) void syncPending();
    }

    function handleKey(event) {
      if (!visible) return false;
      if (running && !event.altKey && !event.ctrlKey && !event.metaKey && /^[1-4]$/.test(event.key)) {
        event.preventDefault(); finishAnswer(Number(event.key) - 1);
      }
      return true;
    }

    refs.start.addEventListener("click", () => start());
    refs.shortcut.addEventListener("click", () => start());
    refs.resume.addEventListener("click", resume);
    refs.abandon.addEventListener("click", abandon);
    refs.pause.addEventListener("click", pause);
    $("exam-cover-resume").addEventListener("click", resume);
    $("exam-exit").addEventListener("click", () => { if (!running) setVisible(false); });
    $("exam-retry").addEventListener("click", () => { if (!data.pendingAttempt) start(lastResult?.scope || scopeSelect.value); });
    $("exam-result-exit").addEventListener("click", () => setVisible(false));
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
    document.querySelectorAll(".practice-nav a").forEach(link => link.addEventListener("click", pause));
    window.addEventListener("online", () => { void syncPending(); });
    renderPanel();
    return { onAccount, onCloud, onScopeChange: renderPanel, syncPending, pause,
      isRunning: () => running, handleKey };
  }

  return { create };
});
