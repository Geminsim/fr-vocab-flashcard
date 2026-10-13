(function () {
  "use strict";

  const examCards = window.TEF_VOCAB_CARDS;
  const everydayCards = window.TEF_EVERYDAY_CARDS;
  const cards = Array.isArray(examCards) && Array.isArray(everydayCards)
    ? examCards.concat(everydayCards) : null;
  const meta = window.TEF_VOCAB_META;
  const everydayMeta = window.TEF_EVERYDAY_META;
  const aliases = window.TEF_CARD_ALIASES || {};
  const core = window.QuizCore;
  const pronunciationApi = window.TEFPronunciation;
  const reverse = document.body.dataset.quizDirection === "reverse";
  if (!Array.isArray(cards) || !meta || !everydayMeta || !core || !pronunciationApi) {
    document.body.textContent = "词库文件未加载。请保持 vocab-data.js、everyday-data.js、quiz-core.js 和 app.js 位于同一文件夹。";
    return;
  }

  const byId = new Map(cards.map(card => [card.id, card]));
  // Never reuse another visitor's cached answers when accounts share a browser.
  let storageKey = null;
  let syncKey = null;
  let accountId = null;
  const voiceKey = "tef-pronunciation-locale-v1";
  const $ = id => document.getElementById(id);
  const ui = {
    level: $("level-select"), scope: $("scope-select"), mode: $("mode-select"), questionArea: $("question-area"),
    empty: $("empty-state"), answers: $("answers"), feedback: $("feedback"),
    reveal: $("reveal-button"), next: $("next-button"), library: $("library"),
    search: $("library-search"), results: $("library-results"), dataMessage: $("data-message"),
    play: $("play-pronunciation"), slow: $("play-pronunciation-slow"), locale: $("voice-locale"),
    termLabel: $("term-label"), dictionaryPopover: $("dictionary-popover"),
    context: $("card-context"), pronunciationActions: $("pronunciation-actions"),
    voiceRow: $("voice-row")
  };
  const pronunciation = pronunciationApi.createEngine(window.speechSynthesis, window.SpeechSynthesisUtterance);
  try {
    if (localStorage.getItem(voiceKey) === "fr-CA") ui.locale.value = "fr-CA";
  } catch (_) { /* Device preference is optional. */ }
  const session = { answered: 0, correct: 0, gained: 0, current: null,
    choices: [], locked: false };
  let state = cleanState(null);
  let syncReady = false;
  let syncBusy = false;
  let syncMeta = loadSyncMeta();
  const dictionaryCache = new Map();
  let dictionaryRequest = null;
  let dictionaryPinned = false;
  let activeDictionaryTrigger = null;

  function recordKey(card) { return reverse ? `reverse:${card.id}` : card.id; }
  function activeRecord(card) { return state.records[recordKey(card)]; }
  function activeRecords(deck) {
    const records = Object.create(null);
    for (const card of deck) {
      const record = activeRecord(card);
      if (record) records[card.id] = record;
    }
    return records;
  }

  const functionWords = new Set([
    "un", "une", "le", "la", "les", "l", "des", "du", "de", "d", "à", "au", "aux",
    "en", "et", "ou", "par", "pour", "sur", "sous", "dans", "chez", "avec", "sans",
    "que", "qu", "qui", "dont", "où", "ce", "cet", "cette", "ces", "se", "s",
    "son", "sa", "ses", "mon", "ma", "mes", "ton", "ta", "tes", "notre", "nos",
    "votre", "vos", "leur", "leurs", "ne", "n", "je", "j", "tu", "il", "elle",
    "ils", "elles", "nous", "vous", "on", "y"
  ]);

  function keywordParts(term) {
    const parts = (term.match(/\s+|[^\s]+/gu) || []).map(piece => {
      if (/^\s+$/.test(piece)) return { text: piece };
      const match = piece.match(/^([^\p{L}]*)([\p{L}\p{M}][\p{L}\p{M}'’\-]*)([^\p{L}\p{M}'’\-]*)$/u);
      if (!match) return { text: piece };
      let [, before, word, after] = match;
      const elision = word.match(/^((?:[cdjlmnst]|qu|jusqu)['’])(.+)$/iu);
      if (elision) { before += elision[1]; word = elision[2]; }
      return { before, word, after, keyword: !functionWords.has(word.toLocaleLowerCase("fr")) };
    });
    if (!parts.some(part => part.keyword)) {
      const fallback = parts.filter(part => part.word).sort((a, b) => b.word.length - a.word.length)[0];
      if (fallback) fallback.keyword = true;
    }
    return parts;
  }

  function renderTerm(card) {
    ui.termLabel.replaceChildren();
    for (const part of keywordParts(card.term)) {
      if (part.text) { ui.termLabel.append(document.createTextNode(part.text)); continue; }
      if (part.before) ui.termLabel.append(document.createTextNode(part.before));
      if (part.keyword) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "term-trigger";
        button.textContent = part.word;
        button.dataset.word = part.word;
        button.disabled = true;
        button.setAttribute("aria-label", `查看关键词 ${part.word} 的详细解释`);
        button.setAttribute("aria-controls", "dictionary-popover");
        button.setAttribute("aria-expanded", "false");
        button.addEventListener("mouseenter", () => showDictionary(button));
        button.addEventListener("focus", () => showDictionary(button));
        button.addEventListener("click", () => {
          if (dictionaryPinned && activeDictionaryTrigger === button) closeDictionary();
          else { showDictionary(button); dictionaryPinned = true; }
        });
        ui.termLabel.append(button);
      } else ui.termLabel.append(document.createTextNode(part.word));
      if (part.after) ui.termLabel.append(document.createTextNode(part.after));
    }
  }

  function closeDictionary() {
    ui.dictionaryPopover.hidden = true;
    if (activeDictionaryTrigger) activeDictionaryTrigger.setAttribute("aria-expanded", "false");
    activeDictionaryTrigger = null;
    dictionaryPinned = false;
  }

  function lookupForm(term) {
    return term.trim().replace(/^(?:un|une|le|la|les|des|du|de la)\s+|^l['’]/i, "").trim();
  }

  function plainText(markup) {
    return new DOMParser().parseFromString(markup || "", "text/html").body.textContent
      .replace(/\s+/g, " ").trim();
  }

  function dictionaryRelations(wikitext, heading) {
    const frenchStart = wikitext.search(/^==\s*\{\{langue\|fr\}\}\s*==/im);
    if (frenchStart < 0) return [];
    const after = wikitext.slice(frenchStart);
    const nextLanguage = after.slice(1).search(/^==\s*\{\{langue\|/im);
    const french = nextLanguage < 0 ? after : after.slice(0, nextLanguage + 1);
    const words = [];
    let inSection = false;
    for (const line of french.split(/\r?\n/)) {
      if (/^={2,6}\s*/.test(line)) {
        inSection = new RegExp(`^={3,6}\\s*\\{\\{S\\|${heading}(?:\\|fr)?\\}\\}`, "i").test(line);
        continue;
      }
      if (!inSection || !/^\s*\*/.test(line)) continue;
      const match = line.match(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/) ||
        line.match(/\{\{lien\|([^|}]+)\|fr(?:\|[^}]*)?\}\}/i);
      const word = match?.[1]?.trim();
      if (word && /^[\p{L}\p{M}'’\- ]{2,55}$/u.test(word) && !words.includes(word)) words.push(word);
      if (words.length >= 8) break;
    }
    return words;
  }

  async function loadDictionary(word, signal) {
    const lookupTerm = word.trim();
    const english = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(lookupTerm)}`;
    const params = new URLSearchParams({ action: "parse", page: lookupTerm, prop: "wikitext",
      format: "json", formatversion: "2", origin: "*" });
    const french = `https://fr.wiktionary.org/w/api.php?${params}`;
    const get = async url => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`词典返回 ${response.status}`);
      return response.json();
    };
    const [englishResult, frenchResult] = await Promise.allSettled([get(english), get(french)]);
    if (englishResult.status === "rejected" && frenchResult.status === "rejected")
      throw new Error("词典暂时不可用");
    const definitions = [];
    const examples = [];
    const frenchEntries = englishResult.status === "fulfilled" ? englishResult.value.fr || [] : [];
    for (const entry of frenchEntries) for (const item of entry.definitions || []) {
      const definition = plainText(item.definition);
      if (definition && definitions.length < 3)
        definitions.push({ partOfSpeech: entry.partOfSpeech || "", text: definition });
      const sample = item.parsedExamples?.length ? item.parsedExamples.map(value => value.example) : item.examples || [];
      for (const markup of sample) {
        const value = plainText(markup);
        if (value && examples.length < 2 && !examples.includes(value)) examples.push(value);
      }
    }
    const source = frenchResult.status === "fulfilled" ? frenchResult.value.parse?.wikitext || "" : "";
    return {
      lookupTerm, definitions, examples,
      synonyms: dictionaryRelations(source, "synonymes"),
      antonyms: dictionaryRelations(source, "antonymes"),
      availability: { definitions: Boolean(frenchEntries.length),
        relations: /^==\s*\{\{langue\|fr\}\}\s*==/im.test(source) },
      sources: {
        english: `https://en.wiktionary.org/wiki/${encodeURIComponent(lookupTerm)}#French`,
        french: `https://fr.wiktionary.org/wiki/${encodeURIComponent(lookupTerm)}#Fran%C3%A7ais`
      }
    };
  }

  function dictionaryList(id, values, fallback, className = "") {
    const target = $(id);
    target.replaceChildren();
    if (!values.length) {
      const empty = document.createElement("span");
      empty.className = "dictionary-muted";
      empty.textContent = fallback;
      target.append(empty);
      return;
    }
    values.forEach(value => {
      const line = document.createElement("span");
      line.className = className;
      line.textContent = value;
      target.append(line);
    });
  }

  function renderDictionary(card, word, data, loading = false, failed = false) {
    const wholeCard = lookupForm(card.term).toLocaleLowerCase("fr") === word.toLocaleLowerCase("fr");
    $("dictionary-term").textContent = word;
    $("dictionary-pos").textContent = wholeCard ? card.pos || card.levels.join(" / ") : "关键词";
    $("dictionary-meaning-label").textContent = wholeCard ? "本题释义" : "原词组／句子释义";
    $("dictionary-meaning").textContent = wholeCard ? card.meaning : `${card.term} — ${card.meaning}`;
    $("dictionary-note-row").hidden = !wholeCard || !card.note;
    $("dictionary-note").textContent = card.note || "";
    dictionaryList("dictionary-definitions", (data?.definitions || []).map(item =>
      `${item.partOfSpeech ? `${item.partOfSpeech} · ` : ""}${item.text}`),
      loading ? "正在查询词典…" : failed ? "词典暂时不可用，请查看原词条。" : "未收录此词条或短语。");
    const localExample = card.example && card.example.toLocaleLowerCase("fr").includes(word.toLocaleLowerCase("fr"))
      ? card.example : "";
    const examples = [localExample, ...(data?.examples || [])].filter(Boolean);
    dictionaryList("dictionary-examples", [...new Set(examples)],
      loading ? "正在查找例句…" : "暂无例句。", "dictionary-example");
    dictionaryList("dictionary-synonyms", data?.synonyms || [],
      loading ? "正在查找…" : failed || !data?.availability?.relations ? "暂未获取。" : "词典未列出。 ");
    dictionaryList("dictionary-antonyms", data?.antonyms || [],
      loading ? "正在查找…" : failed || !data?.availability?.relations ? "暂未获取。" : "词典未列出。 ");
    const lookup = data?.lookupTerm || word;
    $("dictionary-source-fr").href = data?.sources?.french ||
      `https://fr.wiktionary.org/wiki/${encodeURIComponent(lookup)}#Fran%C3%A7ais`;
    $("dictionary-source-en").href = data?.sources?.english ||
      `https://en.wiktionary.org/wiki/${encodeURIComponent(lookup)}#French`;
  }

  function showDictionary(trigger) {
    const card = session.current;
    if (!card || !session.locked || trigger.disabled) return;
    if (activeDictionaryTrigger === trigger && !ui.dictionaryPopover.hidden) return;
    if (dictionaryRequest) dictionaryRequest.abort();
    dictionaryRequest = null;
    if (activeDictionaryTrigger) activeDictionaryTrigger.setAttribute("aria-expanded", "false");
    activeDictionaryTrigger = trigger;
    const word = trigger.dataset.word;
    ui.dictionaryPopover.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    const cached = dictionaryCache.get(word.toLocaleLowerCase("fr"));
    renderDictionary(card, word, cached, !cached);
    if (cached) return;
    const controller = new AbortController();
    dictionaryRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 8500);
    loadDictionary(word, controller.signal).then(data => {
      dictionaryCache.set(word.toLocaleLowerCase("fr"), data);
      if (session.current?.id === card.id && activeDictionaryTrigger === trigger && !ui.dictionaryPopover.hidden)
        renderDictionary(card, word, data);
    }).catch(() => {
      if (session.current?.id === card.id && activeDictionaryTrigger === trigger && !ui.dictionaryPopover.hidden)
        renderDictionary(card, word, null, false, true);
    }).finally(() => {
      clearTimeout(timeout);
      if (dictionaryRequest === controller) dictionaryRequest = null;
    });
  }

  function loadSyncMeta() {
    let saved = null;
    try { if (syncKey) saved = JSON.parse(localStorage.getItem(syncKey)); } catch (_) { /* new device */ }
    return {
      deviceId: typeof saved?.deviceId === "string" ? saved.deviceId : crypto.randomUUID(),
      nextSeq: Number.isSafeInteger(saved?.nextSeq) ? saved.nextSeq : 0,
      generation: Number.isSafeInteger(saved?.generation) ? saved.generation : 0,
      seeded: saved?.seeded === true,
      pending: Array.isArray(saved?.pending) ? saved.pending : []
    };
  }

  function saveSyncMeta() {
    if (!syncKey) return;
    try { localStorage.setItem(syncKey, JSON.stringify(syncMeta)); }
    catch (_) { showMessage("本机暂存失败，请检查浏览器存储设置。", true); }
  }

  function syncStatus(kind, label, detail) {
    $("sync-badge").className = `offline-badge ${kind}`;
    $("sync-label").textContent = label;
    $("sync-detail").textContent = detail;
    $("sync-button").disabled = syncBusy;
  }

  async function api(body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/progress", {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal
      });
      let data = null;
      try { data = await response.json(); } catch (_) { /* unavailable */ }
      if (!response.ok) {
        const error = new Error(data?.error || `同步失败（${response.status}）`);
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("连接超时，请点击“立即同步”重试");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function applyCloud(cloud) {
    const generationChanged = cloud.generation !== syncMeta.generation;
    const cleaned = cleanState({ ...state, records: cloud.records,
      totalAnswers: cloud.totalAnswers });
    state.records = cleaned.records;
    state.totalAnswers = cleaned.totalAnswers;
    syncMeta.generation = cloud.generation;
    syncMeta.nextSeq = cloud.deviceSeq?.[syncMeta.deviceId] ??
      (generationChanged ? 0 : syncMeta.nextSeq);
    saveSyncMeta();
    saveState();
    renderStats();
    if (!session.locked && session.current && ui.mode.value === "learning" &&
        activeRecord(session.current)?.mastered) advance();
  }

  function useAccount(cloud) {
    if (typeof cloud.accountId !== "string" || !cloud.accountId) {
      throw new Error("无法确认当前账号，请刷新页面重试。");
    }
    if (accountId === cloud.accountId) return;
    accountId = cloud.accountId;
    storageKey = `tef-b2-flashcards-v2:${accountId}`;
    syncKey = `tef-b2-flashcards-sync-v2:${accountId}`;
    state = loadState();
    syncMeta = loadSyncMeta();
    syncReady = false;
    session.answered = 0; session.correct = 0; session.gained = 0;
    session.current = null; session.locked = false;
    buildLevelMenu(); buildScopeMenu(); renderStats(); renderSession(); advance();
  }

  async function syncNow({ quiet = false } = {}) {
    if (syncBusy) return;
    syncBusy = true;
    if (!quiet || !syncReady || syncMeta.pending.length) {
      syncStatus("pending", "正在同步", "正在读取这个账号的最新进度…");
    }
    $("sync-button").disabled = true;
    try {
      let cloud = await api();
      useAccount(cloud);
      if (!syncMeta.seeded) {
        const initial = await api({ type: "seed", records: state.records,
          totalAnswers: state.totalAnswers });
        syncMeta.seeded = true;
        syncMeta.generation = initial.generation;
        saveSyncMeta();
      }
      do {
        while (syncMeta.pending.length) {
          syncStatus("pending", "正在同步", `还有 ${syncMeta.pending.length} 道题待同步；记录已暂存在本机。`);
          const event = syncMeta.pending[0];
          const result = await api({ type: "answer", ...event });
          syncMeta.pending.shift();
          syncMeta.generation = result.generation;
          saveSyncMeta();
        }
        cloud = await api();
      } while (syncMeta.pending.length);
      applyCloud(cloud);
      syncReady = true;
      $("sign-in-link").hidden = true;
      syncStatus("", "已同步", `已同步到 ${cloud.account}。手机和电脑请登录同一账号。`);
      if (!session.locked && !session.answered) advance();
    } catch (error) {
      if (error.status === 409 && /reset on another/.test(error.message) && syncMeta.pending.length) {
        const discard = window.confirm("账号进度已在另一设备清空或导入，本机仍有未同步题目。确定丢弃这些未同步题目并读取账号最新进度吗？取消后可先导出本机备份。 ");
        if (discard) {
          try {
            const cloud = await api();
            syncMeta.pending = [];
            syncMeta.generation = cloud.generation;
            syncMeta.nextSeq = cloud.deviceSeq?.[syncMeta.deviceId] || 0;
            saveSyncMeta();
            applyCloud(cloud);
            syncReady = true;
            syncStatus("", "已同步", `已同步到 ${cloud.account}。`);
            return;
          } catch (_) { /* keep the pending backup if recovery fails */ }
        }
      }
      if (error.status === 401) syncReady = false;
      $("sign-in-link").hidden = error.status !== 401;
      const queued = syncMeta.pending.length;
      const detail = error.status === 401
        ? "请使用你自己的 ChatGPT 账号登录，练习进度会单独保存。"
        : queued ? `${queued} 道题暂存在本机，联网后点“立即同步”；在同步前不要清除浏览器数据。`
          : `云端暂不可用：${error.message}。请稍后点“立即同步”。`;
      syncStatus("error", queued ? "待同步" : "同步失败", detail);
      if (!syncReady) showMessage("首次同步完成前暂不能答题，以免手机和电脑重复练习。", true);
    } finally {
      syncBusy = false;
      $("sync-button").disabled = false;
    }
  }

  function cleanRecord(raw) {
    if (!raw || typeof raw !== "object") return null;
    const record = core.blankRecord();
    for (const key of ["attempts", "cleanCount", "streak", "misses", "due"]) {
      record[key] = Number.isSafeInteger(raw[key]) && raw[key] >= 0 ? raw[key] : 0;
    }
    record.firstCorrect = raw.firstCorrect === true ? true : raw.firstCorrect === false ? false : null;
    record.mastered = raw.mastered === true;
    return record.attempts ? record : null;
  }

  function cleanState(raw) {
    const fresh = { version: 2, signature: meta.signature, totalAnswers: 0,
      records: Object.create(null), level: "all", scope: "all", mode: "learning", reverseMode: "learning" };
    if (!raw || typeof raw !== "object") return fresh;
    fresh.totalAnswers = Number.isSafeInteger(raw.totalAnswers) && raw.totalAnswers >= 0 ? raw.totalAnswers : 0;
    if (raw.records && typeof raw.records === "object") {
      for (const [id, value] of Object.entries(raw.records)) {
        const isReverse = id.startsWith("reverse:");
        const baseId = isReverse ? id.slice(8) : id;
        const resolved = aliases[baseId] || baseId;
        if (!byId.has(resolved)) continue;
        const record = cleanRecord(value);
        if (record) {
          const key = isReverse ? `reverse:${resolved}` : resolved;
          const prior = fresh.records[key];
          if (!prior || (record.mastered && !prior.mastered) ||
              (record.mastered === prior.mastered && record.attempts > prior.attempts)) {
            fresh.records[key] = record;
          }
        }
      }
    }
    if (typeof raw.scope === "string") fresh.scope = raw.scope;
    if (["all", "A1", "A2", "B1", "B2", "everyday"].includes(raw.level)) fresh.level = raw.level;
    if (raw.level === "baseline") fresh.level = "B2";
    if (raw.mode === "mastered") fresh.mode = "mastered";
    if (raw.reverseMode === "mastered") fresh.reverseMode = "mastered";
    return fresh;
  }

  function loadState() {
    try { return cleanState(storageKey ? JSON.parse(localStorage.getItem(storageKey)) : null); }
    catch (_) { return cleanState(null); }
  }

  function saveState() {
    state.level = ui.level.value;
    state.scope = ui.scope.value;
    if (reverse) state.reverseMode = ui.mode.value;
    else state.mode = ui.mode.value;
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (_) { showMessage("浏览器未允许本地保存；请用“导出进度”备份。", true); }
  }

  function showMessage(message, error = false) {
    ui.dataMessage.textContent = message;
    ui.dataMessage.style.color = error ? "#a7513e" : "#286f5c";
  }

  function reportPronunciation(message, error = false) {
    for (const id of ["pronunciation-status", "library-pronunciation-status"]) {
      const target = $(id);
      target.textContent = message;
      target.classList.toggle("error", error);
    }
  }

  function playPronunciation(term, slow = false) {
    pronunciation.play(term, { locale: ui.locale.value, slow }, reportPronunciation);
  }

  function inLevel(card, level = ui.level.value) {
    return core.levelEligible(card, level);
  }

  function levelCards() { return cards.filter(card => inLevel(card)); }

  function makeOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function buildLevelMenu() {
    ui.level.replaceChildren();
    ui.level.append(makeOption("all", `A1–B2 累计 · ${examCards.length} 张`));
    for (const level of ["A1", "A2", "B1", "B2"]) {
      ui.level.append(makeOption(level, `${level} · ${meta.levelCounts[level]} 张`));
    }
    ui.level.append(makeOption("everyday", `日常与地区用语 · ${everydayCards.length} 张`));
    ui.level.value = state.level;
  }

  function metaInLevel(ref) {
    return core.sourceEligible(ref, ui.level.value);
  }

  function buildScopeMenu() {
    const deck = levelCards();
    const preferred = state.scope;
    ui.scope.replaceChildren();
    ui.scope.append(makeOption("all", `此词库全部词汇 · ${deck.length} 张`));
    for (const group of ["听力", "分级词汇", "阅读", "写作", "同义替换", "连接词", "句型", "日常词汇", "地区口语"]) {
      const count = deck.filter(card => card.groups.includes(group) &&
        card.topicMeta.some(ref => ref.group === group && metaInLevel(ref))).length;
      if (count >= 10) ui.scope.append(makeOption(`group:${group}`, `${group} · ${count} 张`));
    }
    for (const group of ["听力", "分级词汇", "阅读", "写作", "连接词", "日常词汇", "地区口语"]) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = `${group} · 具体主题`;
      const topics = [...new Set(deck.flatMap(card => card.topicMeta
        .filter(ref => ref.group === group && metaInLevel(ref)).map(ref => ref.topic)))];
      for (const topic of topics) {
        const count = deck.filter(card => card.topicMeta.some(ref =>
          ref.group === group && ref.topic === topic && metaInLevel(ref))).length;
        optgroup.append(makeOption(`topic:${topic}`, `${topic} · ${count} 张`));
      }
      if (topics.length) ui.scope.append(optgroup);
    }
    if ([...ui.scope.options].some(x => x.value === preferred)) ui.scope.value = preferred;
    else ui.scope.value = "all";
    ui.mode.value = reverse ? state.reverseMode : state.mode;
  }

  function scopedCards() {
    return cards.filter(card => core.eligibleInView(card, ui.level.value, ui.scope.value));
  }

  function renderStats() {
    const deck = scopedCards();
    const daily = ui.level.value === "everyday";
    document.querySelector(".eyebrow").textContent = daily
      ? "自我检测 · 日常与地区用语独立词库" : "自我检测 · A1–B2 分级词汇";
    $("deck-size").textContent = (daily ? everydayMeta.uniqueCards : meta.uniqueCards).toLocaleString("zh-CN");
    $("source-size").textContent = daily
      ? "独立日常库 · 与考试库分开"
      : `B2 合并后 ${meta.levelCounts.B2.toLocaleString("zh-CN")} 张`;
    const mastered = deck.filter(c => activeRecord(c)?.mastered).length;
    const learning = deck.filter(c => activeRecord(c)?.attempts &&
      !activeRecord(c).mastered).length;
    const unseen = deck.length - mastered - learning;
    $("stat-total").textContent = deck.length.toLocaleString("zh-CN");
    $("stat-mastered").textContent = mastered.toLocaleString("zh-CN");
    $("stat-learning").textContent = learning.toLocaleString("zh-CN");
    $("stat-new").textContent = unseen.toLocaleString("zh-CN");
    const ratio = deck.length ? Math.round(mastered / deck.length * 100) : 0;
    $("mastery-fill").style.width = `${ratio}%`;
    $("mastery-bar").setAttribute("aria-valuenow", String(ratio));
    $("progress-caption").textContent = `已掌握 ${mastered} / ${deck.length} · ${ratio}%`;
    if (ui.library.open) renderLibrary();
  }

  function renderSession() {
    $("session-answered").textContent = session.answered;
    $("session-accuracy").textContent = session.answered
      ? `${Math.round(session.correct / session.answered * 100)}%` : "—";
    $("session-gained").textContent = session.gained;
  }

  function renderQuestion(card) {
    pronunciation.stop();
    if (dictionaryRequest) dictionaryRequest.abort();
    dictionaryRequest = null;
    closeDictionary();
    if (pronunciation.supported) reportPronunciation("点击播放，使用本机法语语音。");
    session.current = card;
    session.choices = reverse
      ? core.reverseOptions(card, scopedCards(), Math.random, levelCards())
      : core.options(card, scopedCards(), Math.random, levelCards());
    session.locked = false;
    ui.questionArea.hidden = false;
    ui.empty.hidden = true;
    ui.feedback.hidden = true;
    ui.feedback.classList.remove("incorrect");
    ui.reveal.hidden = false;
    $("question-number").textContent = `本次第 ${session.answered + 1} 题`;
    $("card-stage").textContent = core.progress(activeRecord(card), card).label;
    const scopeGroup = ui.scope.value.startsWith("group:") ? ui.scope.value.slice(6) : "";
    const scopeTopic = ui.scope.value.startsWith("topic:") ? ui.scope.value.slice(6) : "";
    const refs = card.topicMeta.filter(metaInLevel);
    const reference = refs.find(ref => ref.topic === scopeTopic) ||
      refs.find(ref => ref.group === scopeGroup) || refs[0] || card.topicMeta[0];
    const shownGroup = scopeGroup || reference.group;
    const shownTopic = scopeTopic || reference.topic;
    const firstLevel = ["A1", "A2", "B1", "B2"].find(level => card.levels.includes(level));
    $("card-level").textContent = ui.level.value === "everyday" ? "日常" :
      ui.level.value === "all" ? firstLevel : ui.level.value;
    $("card-group").textContent = shownGroup;
    $("card-topic").textContent = shownTopic === shownGroup ? "" : shownTopic;
    $("card-pos").textContent = card.pos || "";
    if (reverse) {
      ui.termLabel.textContent = card.meaning;
      ui.termLabel.lang = "zh-CN";
    } else {
      renderTerm(card);
      ui.termLabel.lang = "fr";
    }
    $("question-title").classList.toggle("chinese-cue", reverse);
    ui.context.textContent = card.example ? `“${card.example}”` : "";
    ui.context.hidden = reverse;
    ui.pronunciationActions.hidden = reverse;
    ui.voiceRow.hidden = reverse;
    ui.answers.replaceChildren();
    session.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      button.dataset.index = String(index);
      const letter = document.createElement("span");
      letter.className = "option-letter";
      letter.textContent = String.fromCharCode(65 + index);
      const label = document.createElement("span");
      label.className = "option-text";
      label.textContent = choice;
      if (reverse) label.lang = "fr";
      button.append(letter, label);
      button.addEventListener("click", () => submit(index));
      ui.answers.append(button);
    });
  }

  function showEmpty() {
    pronunciation.stop();
    if (dictionaryRequest) dictionaryRequest.abort();
    dictionaryRequest = null;
    closeDictionary();
    session.current = null;
    ui.questionArea.hidden = true;
    ui.empty.hidden = false;
    if (ui.mode.value === "learning") {
      $("empty-title").textContent = "这个范围的词都已掌握";
      $("empty-copy").textContent = "太好了。可以复查已掌握词，或切换到其他分类继续练。";
      $("empty-action").textContent = "复查已掌握词";
    } else {
      $("empty-title").textContent = "这里还没有已掌握词";
      $("empty-copy").textContent = "先在学习模式完成词条的复现条件，再回到这里复查。";
      $("empty-action").textContent = "开始学习";
    }
  }

  function advance() {
    const previousId = session.current?.id || null;
    const deck = scopedCards();
    const card = core.nextCard(deck, activeRecords(deck), "all", ui.mode.value,
      state.totalAnswers, session.answered, previousId);
    if (card) renderQuestion(card);
    else showEmpty();
  }

  function submit(index) {
    if (!session.current || session.locked) return;
    if (!syncReady) {
      showMessage("首次同步完成前请先点“立即同步”，避免重复练习。", true);
      return;
    }
    const card = session.current;
    const correctAnswer = reverse ? card.term : card.meaning;
    const correct = index >= 0 && session.choices[index] === correctAnswer;
    const key = recordKey(card);
    const before = state.records[key];
    state.totalAnswers += 1;
    state.records[key] = core.answer(before, correct, state.totalAnswers, card);
    session.answered += 1;
    if (correct) session.correct += 1;
    if (!before?.mastered && state.records[key].mastered) session.gained += 1;
    session.locked = true;
    if (reverse) {
      renderTerm(card);
      ui.termLabel.lang = "fr";
      $("question-title").classList.remove("chinese-cue");
      ui.context.hidden = false;
      ui.pronunciationActions.hidden = false;
      ui.voiceRow.hidden = false;
    }
    ui.termLabel.querySelectorAll(".term-trigger").forEach(button => {
      button.disabled = false;
      button.classList.add("is-ready");
    });
    syncMeta.nextSeq += 1;
    syncMeta.pending.push({ deviceId: syncMeta.deviceId, seq: syncMeta.nextSeq,
      cardId: key, correct, generation: syncMeta.generation });
    saveSyncMeta();
    saveState();
    syncStatus("pending", "待同步", "本题已暂存在本机，正在同步到账号…");
    renderStats();
    renderSession();
    $("card-stage").textContent = core.progress(activeRecord(card), card).label;
    [...ui.answers.children].forEach((button, i) => {
      button.disabled = true;
      if (session.choices[i] === correctAnswer) button.classList.add("correct");
      else if (i === index) button.classList.add("wrong");
      else button.classList.add("dim");
    });
    ui.reveal.hidden = true;
    ui.feedback.hidden = false;
    ui.feedback.classList.toggle("incorrect", !correct);
    $("feedback-icon").textContent = correct ? "✓" : "!";
    $("feedback-title").textContent = correct ? "答对了" : index === -1 ? "已查看答案，记为错题" : "这次没选对";
    $("feedback-meaning").textContent = correctAnswer;
    const extra = [card.example ? `例句／搭配：${card.example}` : "",
      card.note ? `用法提示：${card.note}` : "", "悬停或点击题目中的关键词可查看详解"].filter(Boolean);
    $("feedback-extra").textContent = extra.join("  ·  ");
    $("feedback-progress").textContent = core.progress(activeRecord(card), card).label;
    ui.next.focus();
    void syncNow();
  }

  function renderLibrary() {
    const query = ui.search.value.trim().toLocaleLowerCase();
    const currentLibrary = levelCards();
    const matches = currentLibrary.filter(card => !query ||
      `${card.term} ${card.meaning} ${card.topic}`.toLocaleLowerCase().includes(query));
    $("library-count").textContent = query
      ? `找到 ${matches.length} 张卡，显示前 40 张。` : `当前词库 ${currentLibrary.length} 张卡，显示前 40 张；输入关键词可缩小范围。`;
    ui.results.replaceChildren();
    for (const card of matches.slice(0, 40)) {
      const row = document.createElement("div");
      row.className = "library-item";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "library-open";
      const left = document.createElement("span");
      left.textContent = card.term;
      const detail = document.createElement("small");
      detail.textContent = `${card.meaning} · ${card.levels.join(" / ")} · ${card.topic}`;
      left.append(detail);
      const status = document.createElement("em");
      status.textContent = activeRecord(card)?.mastered ? "已掌握"
        : activeRecord(card)?.attempts ? "学习中" : "未见过";
      if (activeRecord(card)?.mastered) status.className = "mastered";
      button.append(left, status);
      button.addEventListener("click", () => {
        ui.level.value = card.decks.includes("everyday") ? "everyday" : "all";
        state.level = ui.level.value;
        state.scope = "all";
        buildScopeMenu();
        ui.scope.value = "all";
        ui.mode.value = activeRecord(card)?.mastered ? "mastered" : "learning";
        saveState();
        renderStats();
        renderQuestion(card);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      const speak = document.createElement("button");
      speak.type = "button";
      speak.className = "library-speak";
      speak.textContent = "播放";
      speak.setAttribute("aria-label", `播放 ${card.term} 的法语发音`);
      speak.disabled = !pronunciation.supported;
      speak.addEventListener("click", () => playPronunciation(card.term));
      row.append(button, speak);
      ui.results.append(row);
    }
  }

  function exportProgress() {
    const payload = Object.assign({}, state, { exportedAt: new Date().toISOString() });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tef-b2-vocab-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage("进度备份已导出。请妥善保存 JSON 文件。 ");
  }

  async function importProgress(file) {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!raw || typeof raw.records !== "object" || !raw.records) throw new Error("缺少答题记录");
      const mismatched = raw.signature !== meta.signature;
      const prompt = mismatched
        ? "备份来自不同版本的词库，只会保留匹配的词条。导入会覆盖这个账号在手机和电脑上的进度，确定继续吗？"
        : "导入会覆盖这个账号在手机和电脑上的全部答题进度，确定继续吗？";
      if (!window.confirm(prompt)) return;
      if (!syncReady || syncBusy || syncMeta.pending.length) {
        showMessage("请先完成同步，再导入备份。", true);
        return;
      }
      const imported = cleanState(raw);
      const cloud = await api({ type: "replace", records: imported.records,
        totalAnswers: imported.totalAnswers });
      state = imported;
      syncMeta.generation = cloud.generation;
      syncMeta.nextSeq = 0;
      saveSyncMeta();
      session.answered = 0; session.correct = 0; session.gained = 0; session.current = null;
      buildLevelMenu();
      buildScopeMenu();
      saveState();
      applyCloud(cloud);
      renderSession(); advance();
      showMessage(`已导入 ${Object.keys(state.records).length} 张卡的答题记录。`);
    } catch (error) {
      showMessage(`无法导入进度：${error.message}`, true);
    } finally {
      $("import-file").value = "";
    }
  }

  async function resetProgress() {
    if (!window.confirm("确定清空这个账号在手机和电脑上的全部答题记录吗？此操作无法撤销；建议先导出备份。")) return;
    if (!syncReady || syncBusy || syncMeta.pending.length) {
      showMessage("请先完成同步，再清空进度。", true);
      return;
    }
    let cloud;
    try { cloud = await api({ type: "reset" }); }
    catch (error) { showMessage(`云端清空失败，本机进度未更改：${error.message}`, true); return; }
    state = cleanState(null);
    state.level = ui.level.value;
    state.scope = ui.scope.value;
    state.mode = "learning";
    state.reverseMode = "learning";
    ui.mode.value = "learning";
    session.answered = 0; session.correct = 0; session.gained = 0; session.current = null;
    syncMeta.generation = cloud.generation;
    syncMeta.nextSeq = 0;
    saveSyncMeta();
    saveState();
    applyCloud(cloud);
    renderSession(); advance();
    showMessage("账号下的答题记录已清空。若有备份，可以重新导入。 ");
  }

  if (reverse) {
    document.title = "TEF A1–B2 中文选法语闪卡自测";
    $("page-lede").textContent = "看中文释义，选出对应的法语词或表达。答题前不显示法语例句与读音。";
    $("question-prompt").textContent = "以下哪一项最符合上面的中文含义？";
    $("answers").setAttribute("aria-label", "选择法语词汇");
    $("feedback-answer-label").textContent = "正确法语：";
  }
  for (const link of document.querySelectorAll(".practice-nav a")) {
    if (link.dataset.direction === (reverse ? "reverse" : "forward"))
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  $("deck-size").textContent = meta.uniqueCards.toLocaleString("zh-CN");
  $("source-size").textContent = `B2 合并后 ${meta.levelCounts.B2.toLocaleString("zh-CN")} 张`;
  buildLevelMenu();
  buildScopeMenu();
  if (!pronunciation.supported) {
    ui.play.disabled = true;
    ui.slow.disabled = true;
    reportPronunciation("当前浏览器不支持语音朗读。请换用支持系统朗读的浏览器。", true);
  }
  renderStats(); renderSession(); advance();
  ui.play.addEventListener("click", () => {
    if (session.current) playPronunciation(session.current.term);
  });
  $("term-lookup").addEventListener("mouseleave", () => {
    if (!dictionaryPinned) closeDictionary();
  });
  $("term-lookup").addEventListener("focusout", event => {
    if (!dictionaryPinned && !$("term-lookup").contains(event.relatedTarget)) closeDictionary();
  });
  $("dictionary-close").addEventListener("click", () => {
    closeDictionary();
    ui.next.focus();
  });
  document.addEventListener("pointerdown", event => {
    if (dictionaryPinned && !$("term-lookup").contains(event.target)) closeDictionary();
  });
  ui.slow.addEventListener("click", () => {
    if (session.current) playPronunciation(session.current.term, true);
  });
  ui.locale.addEventListener("change", () => {
    pronunciation.stop();
    try { localStorage.setItem(voiceKey, ui.locale.value); } catch (_) { /* Optional preference. */ }
    reportPronunciation(`已选择${ui.locale.value === "fr-CA" ? "加拿大" : "法国"}法语；点击播放试听。`);
  });
  ui.level.addEventListener("change", () => {
    state.level = ui.level.value;
    state.scope = "all";
    buildScopeMenu();
    saveState(); renderStats(); advance();
  });
  ui.scope.addEventListener("change", () => { saveState(); renderStats(); advance(); });
  ui.mode.addEventListener("change", () => { saveState(); renderStats(); advance(); });
  ui.next.addEventListener("click", advance);
  ui.reveal.addEventListener("click", () => submit(-1));
  $("empty-action").addEventListener("click", () => {
    ui.mode.value = ui.mode.value === "learning" ? "mastered" : "learning";
    saveState(); advance();
  });
  $("export-button").addEventListener("click", exportProgress);
  $("import-button").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", event => importProgress(event.target.files[0]));
  $("reset-button").addEventListener("click", resetProgress);
  $("sync-button").addEventListener("click", () => void syncNow());
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("focus", () => void syncNow({ quiet: true }));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void syncNow({ quiet: true });
  });
  setInterval(() => { if (!document.hidden && syncReady) void syncNow({ quiet: true }); }, 30000);
  ui.library.addEventListener("toggle", () => { if (ui.library.open) renderLibrary(); });
  ui.search.addEventListener("input", renderLibrary);
  document.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (event.key === "Escape" && !ui.dictionaryPopover.hidden) {
      closeDictionary(); ui.next.focus(); return;
    }
    if (session.locked && event.key === "Enter" && !event.target.closest("button, a")) {
      event.preventDefault(); advance();
    }
    else if (!session.locked && /^[1-4]$/.test(event.key)) submit(Number(event.key) - 1);
  });
  saveSyncMeta();
  void syncNow();
})();
