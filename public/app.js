(function () {
  "use strict";

  const examCards = window.TEF_VOCAB_CARDS;
  const everydayCards = window.TEF_EVERYDAY_CARDS;
  const originalCards = Array.isArray(examCards) && Array.isArray(everydayCards)
    ? examCards.concat(everydayCards) : null;
  const languageKey = "tef-primary-language-v1";
  let savedLanguage = null;
  try { savedLanguage = localStorage.getItem(languageKey); } catch (_) { /* Check session fallback. */ }
  if (!savedLanguage) {
    try { savedLanguage = sessionStorage.getItem(languageKey); } catch (_) { /* Default to English. */ }
  }
  if (!["zh", "en"].includes(savedLanguage)) savedLanguage = null;
  function rememberLanguage(value) {
    try { localStorage.setItem(languageKey, value); return true; } catch (_) { /* Fall back to this tab. */ }
    try { sessionStorage.setItem(languageKey, value); return true; } catch (_) { return false; }
  }
  const language = savedLanguage === "zh" ? "zh" : "en";
  const english = language === "en";
  const meanings = window.TEF_ENGLISH_MEANINGS || {};
  const cards = originalCards?.map(card => english
    ? { ...card, meaning: meanings[card.id] || card.meaning } : card);
  const localized = (zh, en) => english ? en : zh;
  const englishLabels = {
    "阅读":"Reading", "分级词汇":"Graded vocabulary", "听力":"Listening", "写作":"Writing",
    "同义替换":"Paraphrases", "连接词":"Connectors", "句型":"Sentence patterns",
    "日常词汇":"Everyday words", "地区口语":"Regional & colloquial",
    "日常生活与行政事务":"Daily life & administration", "日常安排与服务":"Routines & services",
    "消费、经济与财务":"Shopping, economy & finance", "客服、消费与付款":"Customer service & payments",
    "公共生活、旅行与文化":"Public life, travel & culture", "教育、学习与能力":"Education & skills",
    "论证名词":"Argument nouns", "住房与行政手续":"Housing & paperwork",
    "健康与医疗":"Health & medicine", "媒体、技术与信息":"Media, technology & information",
    "文化 艺术与休闲":"Culture, arts & leisure", "评价形容词与副词":"Evaluative adjectives & adverbs",
    "书面表达与细微语气":"Written expression & nuance", "家庭 人际关系与生活方式":"Family, relationships & lifestyle",
    "常用动词、描述与连接表达":"Common verbs, descriptions & linking",
    "住房与城市生活":"Housing & city life", "住房与家务":"Home & household",
    "城市、交通与天气":"City, transport & weather", "环境、能源与城市":"Environment, energy & cities",
    "环境、城市与科技":"Environment, cities & technology", "社会 人口与平等":"Society, population & equality",
    "教育与学习":"Education & learning", "学习、工作与求职":"Study, work & job seeking",
    "公共政策 法律与安全":"Public policy, law & safety", "职业、劳动与个人发展":"Careers, labour & personal growth",
    "论证、推理与观点":"Argument, reasoning & opinion", "工作与职业":"Work & careers",
    "招聘与职场":"Recruitment & workplace", "出行、休闲与文化":"Travel, leisure & culture",
    "经济 消费与商业":"Economy, consumption & business", "经济、劳动与转型":"Economy, labour & transition",
    "饮食、购物与日常消费":"Food, shopping & consumption", "论述动词、形容词与逻辑表达":"Argument verbs, adjectives & logic",
    "身体、健康与情绪":"Body, health & emotions", "健康、生活方式与社会关系":"Health, lifestyle & relationships",
    "健康与医疗服务":"Health & healthcare", "公民参与与国际议题":"Civic engagement & global issues",
    "环境 能源与气候":"Environment, energy & climate", "环境、科学与数字风险":"Environment, science & digital risks",
    "高频论述动词与固定搭配":"Common argument verbs & phrases", "科技 网络与媒体":"Technology, internet & media",
    "沟通、数字生活与人际关系":"Communication, digital life & relationships",
    "科学 研究与创新":"Science, research & innovation", "论证动词":"Argument verbs",
    "社会政策、权利与公共议题":"Social policy, rights & public issues", "新闻、社会与政策":"News, society & policy",
    "交通 旅游与出行":"Transport, tourism & travel", "交通与行程变更":"Transport & schedule changes",
    "家庭、身体与衣着":"Family, body & clothing", "电话留言与预约":"Phone messages & appointments",
    "食品 农业与消费习惯":"Food, agriculture & habits", "核心动词与常用表达":"Core verbs & expressions",
    "结果":"Result", "基础形容词、副词与功能词":"Basic adjectives, adverbs & function words",
    "举例与具体化":"Examples & specifics", "转折与让步":"Contrast & concession",
    "口语转折、限制与推断":"Spoken contrast, limits & inference", "数字、日期与时间":"Numbers, dates & time",
    "原因":"Cause", "公共通知与活动":"Public notices & events", "引入主题与观点":"Introducing topics & opinions",
    "列举与递进":"Listing & progression", "比较与对照":"Comparison & contrast",
    "写作句型":"Writing patterns", "解释与改述":"Explanation & reformulation",
    "条件与假设":"Conditions & hypotheses", "目的":"Purpose", "居家、物品与位置":"Home, objects & location",
    "总结与结论":"Summary & conclusion", "问候与个人信息":"Greetings & personal information",
    "访谈观点与态度":"Interview views & attitudes", "教育与培训":"Education & training",
    "副词":"Adverbs", "日常名词":"Everyday nouns", "形容词":"Adjectives", "日常动词":"Everyday verbs",
    "魁省地区":"Québec regional", "魁省口语":"Québec colloquial", "法国口语":"France colloquial",
    "魁省俗语":"Québec idioms", "法国粗俗":"France vulgar slang", "口语":"Colloquial"
  };
  const labelFor = value => english ? (englishLabels[value] || value) : value;
  const meta = window.TEF_VOCAB_META;
  const everydayMeta = window.TEF_EVERYDAY_META;
  const aliases = window.TEF_CARD_ALIASES || {};
  const core = window.QuizCore;
  const examCore = window.TEFExamCore;
  const examApi = window.TEFExam;
  const pronunciationApi = window.TEFPronunciation;
  const reverse = document.body.dataset.quizDirection === "reverse";
  if (!Array.isArray(cards) || !meta || !everydayMeta || !core || !pronunciationApi || !examCore || !examApi ||
      (english && Object.keys(meanings).length !== cards.length)) {
    document.body.textContent = "词库文件未加载。请保持 vocab-data.js、everyday-data.js、quiz-core.js 和 app.js 位于同一文件夹。";
    return;
  }

  const byId = new Map(cards.map(card => [card.id, card]));
  // Never reuse another visitor's cached answers when accounts share a browser.
  let storageKey = null;
  let syncKey = null;
  let accountId = null;
  let languageDialog = null;
  let languageChoiceRequired = false;
  let languageSaving = false;
  const voiceKey = "tef-pronunciation-locale-v1";
  const $ = id => document.getElementById(id);
  const ui = {
    level: $("level-select"), scope: $("scope-select"), mode: $("mode-select"), questionArea: $("question-area"),
    empty: $("empty-state"), answers: $("answers"), feedback: $("feedback"),
    reveal: $("reveal-button"), next: $("next-button"), library: $("library"),
    search: $("library-search"), results: $("library-results"), dataMessage: $("data-message"),
    play: $("play-pronunciation"), slow: $("play-pronunciation-slow"), locale: $("voice-locale"),
    chineseAudio: $("chinese-audio"), chinesePlay: $("play-chinese"),
    termLabel: $("term-label"), dictionaryPopover: $("dictionary-popover"),
    context: $("card-context"), pronunciationActions: $("pronunciation-actions"),
    voiceRow: $("voice-row")
  };
  function installLanguagePicker() {
    const header = document.querySelector(".topbar");
    const badge = $("sync-badge");
    const actions = document.createElement("div");
    actions.className = "topbar-actions";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "language-trigger";
    trigger.textContent = english ? "English · Français" : "中文 · Français";
    trigger.setAttribute("aria-label", "Choose study language / 选择学习语言");
    actions.append(trigger, badge);
    header.append(actions);

    const dialog = document.createElement("dialog");
    dialog.className = "language-dialog";
    dialog.setAttribute("aria-labelledby", "language-dialog-title");
    dialog.innerHTML = `<div class="language-dialog-inner">
      <p class="language-kicker">LANGUAGE · LANGUE · 语言</p>
      <h2 id="language-dialog-title">Choose your study language<br><span>选择主要使用语言</span></h2>
      <p class="language-intro">The French deck stays the same. Choose the language used for meanings and answers.<br>法语词库不变；请选择释义和答案使用的语言。</p>
      <div class="language-choices">
        <button type="button" data-language="en"><strong>English ↔ Français</strong><span>English meanings · 英文释义</span></button>
        <button type="button" data-language="zh"><strong>中文 ↔ Français</strong><span>中文释义 · Chinese meanings</span></button>
      </div>
      <p class="language-note">This preference follows your account across devices. Chinese and English mastery counts stay separate.<br>语言偏好随账号同步；中法与英法的掌握次数仍分别记录。</p>
      <p class="language-error" role="alert" hidden></p>
      <button type="button" class="language-close">${english ? "Keep current language" : "继续当前语言"}</button>
    </div>`;
    document.body.append(dialog);
    languageDialog = dialog;
    dialog.addEventListener("cancel", event => {
      if (languageChoiceRequired || languageSaving) event.preventDefault();
    });
    dialog.querySelector(".language-close").addEventListener("click", () => dialog.close());
    dialog.querySelectorAll("[data-language]").forEach(button => {
      button.addEventListener("click", async () => {
        if (languageSaving || !syncReady || syncBusy || syncMeta.pending.length) return;
        languageSaving = true;
        dialog.querySelectorAll("button").forEach(choice => { choice.disabled = true; });
        const error = dialog.querySelector(".language-error");
        error.hidden = true;
        try {
          const saved = await api({ type: "language", language: button.dataset.language });
          if (saved.studyLanguage !== button.dataset.language) throw new Error("Language preference was not saved.");
          const deviceStored = rememberLanguage(saved.studyLanguage);
          languageChoiceRequired = false;
          if (!deviceStored && saved.studyLanguage !== language) {
            error.textContent = localized("账号已保存语言选择，但当前浏览器禁止本地存储，暂时无法切换界面。请允许存储后刷新。",
              "Your account saved this choice, but this browser blocks local storage. Allow storage, then refresh to switch the page.");
            error.hidden = false;
            dialog.querySelector(".language-close").hidden = false;
            return;
          }
          if (saved.studyLanguage === language) {
            dialog.close();
            dialog.querySelector(".language-close").hidden = false;
          } else window.location.reload();
        } catch (cause) {
          error.textContent = localized(`语言偏好未保存：${cause.message}。请重试。`,
            `Could not save your language choice: ${cause.message}. Please retry.`);
          error.hidden = false;
        } finally {
          languageSaving = false;
          dialog.querySelectorAll("button").forEach(choice => { choice.disabled = false; });
        }
      });
    });
    trigger.addEventListener("click", async () => {
      if (examController?.isRunning()) examController.pause();
      if (!syncReady || syncBusy || (syncMeta.pending.length && !(await syncNow()))) {
        showMessage(localized("请先完成同步，再切换语言。", "Please sync your answers before changing language."), true);
        return;
      }
      if (!dialog.open) dialog.showModal();
    });
  }

  function applyAccountLanguage(cloud) {
    const accountLanguage = cloud.studyLanguage === "zh" || cloud.studyLanguage === "en"
      ? cloud.studyLanguage : null;
    languageChoiceRequired = !accountLanguage;
    languageDialog.querySelector(".language-close").hidden = languageChoiceRequired;
    const targetLanguage = accountLanguage || "en";
    if (targetLanguage !== language) {
      if (!rememberLanguage(targetLanguage)) {
        showMessage(localized("无法保存本机语言显示设置；请允许浏览器存储后刷新。",
          "Could not store the display language on this device. Allow browser storage and refresh."), true);
        return;
      }
      window.location.reload();
      return;
    }
    if (languageChoiceRequired && !languageDialog.open) languageDialog.showModal();
  }

  function applyEnglishStatic() {
    if (!english) return;
    document.documentElement.lang = "en";
    document.title = reverse ? "French vocabulary · English to French" : "French vocabulary · French to English";
    const staticText = {
      '.practice-nav a[data-direction="forward"]': "French → English",
      '.practice-nav a[data-direction="reverse"]': "English → French",
      '.proverb-translation': "Practice makes progress — every word you recall becomes yours.",
      '#page-lede': reverse ? "Read an English meaning and choose the matching French expression. Examples and audio appear after you answer."
        : "Read a French word or expression and choose its English meaning. Your answers determine when it returns.",
      '#controls-title': "Practice scope",
      'label[for="level-select"]': "Choose deck / level",
      '#level-help': "Everyday and regional French is a separate deck.",
      'label[for="scope-select"]': "Category",
      '#scope-help': "Filter by exercise type, theme, or regional usage.",
      'label[for="mode-select"]': "Practice mode",
      '#mode-select option[value="learning"]': "Learning",
      '#mode-select option[value="mastered"]': "Mastered review",
      '.sidebar-caption': "Current scope",
      '#stat-total + span': "cards",
      '#stat-mastered + span': "mastered",
      '#stat-learning + span': "learning",
      '#stat-new + span': "unseen",
      '#session-title': "This session",
      '#session-answered + span': "answered",
      '#session-accuracy + span': "accuracy",
      '#session-gained + span': "newly mastered",
      '.session-panel > p': "New words and due reviews are interleaved; the same card will not appear repeatedly.",
      '#data-title': "Account progress",
      '#sync-detail': "Sign in with your own ChatGPT account. Progress syncs across devices and stays separate for each account.",
      '#sync-button': "Sync now",
      '#switch-account-button': "Switch account",
      '#sign-in-link': "Sign in with ChatGPT",
      '#export-button': "Export progress",
      '#import-button': "Import progress",
      '#reset-button': "Clear practice answers (exam scores remain)",
      '#library summary strong': "Word library",
      '#library summary small': "Search, check status, and review a card",
      'label[for="library-search"]': "Search French or English meanings",
      '#rules-title': "How mastery works",
      '.rule-item:nth-of-type(2) p': "A1 / A2: two correct answers in a row, even after previous mistakes.",
      '.rule-item:nth-of-type(3) p': "B1 / B2 / Everyday: three correct answers in a row; a mistake resets the streak.",
      '.rule-footnote': "Multi-level cards use the lower target. Each direction and meaning language has separate mastery counts, synced to the same account.",
      '#dictionary-meaning-label': "Meaning in this card",
      '#dictionary-note-row dt': "Usage note",
      '.dictionary-content > div:nth-of-type(3) dt': "Dictionary definitions (English)",
      '.dictionary-content > div:nth-of-type(4) dt': "Examples (French)",
      '.dictionary-content > div:nth-of-type(5) dt': "Synonyms",
      '.dictionary-content > div:nth-of-type(6) dt': "Antonyms",
      '.dictionary-caution': "Dictionary entries may include other senses. Check the meaning in this card for context.",
      '#dictionary-source-fr': "French Wiktionary",
      '#dictionary-source-en': "English Wiktionary",
      '#play-pronunciation-slow': "Slow",
      '#play-pronunciation': "♪ Play",
      'label[for="voice-locale"]': "Accent",
      '#voice-locale option[value="fr-FR"]': "France",
      '#voice-locale option[value="fr-CA"]': "Canada",
      '#question-prompt': reverse ? "Which French expression matches this meaning?" : "Which English meaning best matches this French expression?",
      '#reveal-button': "Show answer (marked incorrect)",
      '.key-hint': "Press 1–4 to answer · Enter for next card",
      '#feedback-answer-label': reverse ? "Correct French:" : "Correct meaning:",
      '#next-button': "Next card →",
      '#empty-title': "No cards in this view",
      '#empty-action': "Review mastered words",
    };
    for (const [selector, value] of Object.entries(staticText)) {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    }
    document.querySelector(".deck-count span").firstChild.textContent = "unique cards";
    $("library-search").placeholder = "e.g. logement / housing";
    $("answers").setAttribute("aria-label", reverse ? "Choose French expression" : "Choose English meaning");
    document.querySelector(".practice-nav").setAttribute("aria-label", "Practice direction");
    document.querySelector(".deck-count").setAttribute("aria-label", "Deck size");
    $("pronunciation-actions").setAttribute("aria-label", "Play French pronunciation");
    $("mastery-bar").setAttribute("aria-label", "Mastered percentage in current scope");
    $("dictionary-popover").setAttribute("aria-label", "Word details");
    $("dictionary-close").setAttribute("aria-label", "Close word details");
    $("play-pronunciation").setAttribute("aria-label", "Play French pronunciation");
    $("play-pronunciation-slow").setAttribute("aria-label", "Play French pronunciation slowly");
    const footer = document.querySelector(".site-footer");
    footer.firstChild.textContent = "A1–B2 French vocabulary and a separate everyday deck · Account-synced self-test ";
    footer.querySelector("span").firstChild.textContent = "Everyday words are supplementary, not an official exam list. English meanings are translated from the original Chinese card meanings. ";
    footer.querySelector("a").textContent = "Everyday-deck sources and licenses";
  }
  const pronunciation = pronunciationApi.createEngine(window.speechSynthesis, window.SpeechSynthesisUtterance);
  const chinesePronunciation = pronunciationApi.createChineseEngine(window.speechSynthesis, window.SpeechSynthesisUtterance);
  try {
    if (localStorage.getItem(voiceKey) === "fr-CA") ui.locale.value = "fr-CA";
  } catch (_) { /* Device preference is optional. */ }
  const session = { answered: 0, correct: 0, gained: 0, current: null,
    choices: [], locked: false };
  let examController = null;
  let state = cleanState(null);
  let syncReady = false;
  let syncBusy = false;
  let syncMeta = loadSyncMeta();
  const dictionaryCache = new Map();
  let dictionaryRequest = null;
  let dictionaryPinned = false;
  let activeDictionaryTrigger = null;

  function recordKey(card) {
    const direction = reverse ? `reverse:${card.id}` : card.id;
    return english ? `en:${direction}` : direction;
  }
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
        button.setAttribute("aria-label", localized(`查看关键词 ${part.word} 的详细解释`, `View details for ${part.word}`));
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
    $("dictionary-pos").textContent = wholeCard ? labelFor(card.pos) || card.levels.join(" / ") : localized("关键词", "Keyword");
    $("dictionary-meaning-label").textContent = wholeCard ? localized("本题释义", "Meaning in this card") : localized("原词组／句子释义", "Full phrase meaning");
    $("dictionary-meaning").textContent = wholeCard ? card.meaning : `${card.term} — ${card.meaning}`;
    $("dictionary-note-row").hidden = english || !wholeCard || !card.note;
    $("dictionary-note").textContent = card.note || "";
    dictionaryList("dictionary-definitions", (data?.definitions || []).map(item =>
      `${item.partOfSpeech ? `${item.partOfSpeech} · ` : ""}${item.text}`),
      loading ? localized("正在查询词典…", "Looking up dictionary…") : failed
        ? localized("词典暂时不可用，请查看原词条。", "Dictionary unavailable; see the card meaning.")
        : localized("未收录此词条或短语。", "No entry for this word or phrase."));
    const localExample = card.example && card.example.toLocaleLowerCase("fr").includes(word.toLocaleLowerCase("fr"))
      ? card.example : "";
    const examples = [localExample, ...(data?.examples || [])].filter(Boolean);
    dictionaryList("dictionary-examples", [...new Set(examples)],
      loading ? localized("正在查找例句…", "Looking for examples…") : localized("暂无例句。", "No examples available."), "dictionary-example");
    dictionaryList("dictionary-synonyms", data?.synonyms || [],
      loading ? localized("正在查找…", "Looking up…") : failed || !data?.availability?.relations
        ? localized("暂未获取。", "Not available.") : localized("词典未列出。", "None listed."));
    dictionaryList("dictionary-antonyms", data?.antonyms || [],
      loading ? localized("正在查找…", "Looking up…") : failed || !data?.availability?.relations
        ? localized("暂未获取。", "Not available.") : localized("词典未列出。", "None listed."));
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
    catch (_) { showMessage(localized("本机暂存失败，请检查浏览器存储设置。", "Local saving failed. Check your browser storage settings."), true); }
  }

  function syncStatus(kind, label, detail) {
    $("sync-badge").className = `offline-badge ${kind}`;
    $("sync-label").textContent = label;
    $("sync-detail").textContent = detail;
    $("sync-button").disabled = syncBusy;
    $("switch-account-button").disabled = syncBusy;
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
        const error = new Error(data?.error || localized(`同步失败（${response.status}）`, `Sync failed (${response.status})`));
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error(localized("连接超时，请点击“立即同步”重试", "Connection timed out. Tap Sync now to retry."));
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
    examController?.onCloud(cloud.exam);
    if (!session.locked && session.current && ui.mode.value === "learning" &&
        activeRecord(session.current)?.mastered) advance();
  }

  function useAccount(cloud) {
    if (typeof cloud.accountId !== "string" || !cloud.accountId) {
      throw new Error(localized("无法确认当前账号，请刷新页面重试。", "Could not identify your account. Please refresh."));
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
    examController?.onAccount(accountId);
  }

  async function syncNow({ quiet = false } = {}) {
    if (syncBusy) return false;
    syncBusy = true;
    if (!quiet || !syncReady || syncMeta.pending.length) {
      syncStatus("pending", localized("正在同步", "Syncing"), localized("正在读取这个账号的最新进度…", "Reading the latest progress for this account…"));
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
          syncStatus("pending", localized("正在同步", "Syncing"),
            localized(`还有 ${syncMeta.pending.length} 道题待同步；记录已暂存在本机。`, `${syncMeta.pending.length} answers pending; saved on this device.`));
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
      examController?.onScopeChange();
      void examController?.syncPending();
      $("sign-in-link").hidden = true;
      $("switch-account-button").hidden = false;
      syncStatus("", localized("已同步", "Synced"), localized(`已同步到 ${cloud.account}。手机和电脑请登录同一账号。`,
        `Synced to ${cloud.account}. Sign in to the same account on your phone and computer.`));
      if (!session.locked && !session.answered) advance();
      applyAccountLanguage(cloud);
      return true;
    } catch (error) {
      if (error.status === 409 && /reset on another/.test(error.message) && syncMeta.pending.length) {
        const discard = window.confirm(localized(
          "账号进度已在另一设备清空或导入，本机仍有未同步题目。确定丢弃这些未同步题目并读取账号最新进度吗？取消后可先导出本机备份。 ",
          "Account progress changed on another device, but this device has unsynced answers. Discard them and load the latest account progress? Cancel to export a backup first."));
        if (discard) {
          try {
            const cloud = await api();
            syncMeta.pending = [];
            syncMeta.generation = cloud.generation;
            syncMeta.nextSeq = cloud.deviceSeq?.[syncMeta.deviceId] || 0;
            saveSyncMeta();
            applyCloud(cloud);
            syncReady = true;
            examController?.onScopeChange();
            void examController?.syncPending();
            $("switch-account-button").hidden = false;
            syncStatus("", localized("已同步", "Synced"), localized(`已同步到 ${cloud.account}。`, `Synced to ${cloud.account}.`));
            applyAccountLanguage(cloud);
            return true;
          } catch (_) { /* keep the pending backup if recovery fails */ }
        }
      }
      if (error.status === 401) syncReady = false;
      $("sign-in-link").hidden = error.status !== 401;
      if (error.status === 401) $("switch-account-button").hidden = true;
      const queued = syncMeta.pending.length;
      const detail = error.status === 401
        ? localized("请使用你自己的 ChatGPT 账号登录，练习进度会单独保存。", "Sign in with your ChatGPT account; progress is separate for each account.")
        : queued ? localized(`${queued} 道题暂存在本机，联网后点“立即同步”；在同步前不要清除浏览器数据。`,
          `${queued} answers are saved on this device. Sync before clearing browser data.`)
          : localized(`云端暂不可用：${error.message}。请稍后点“立即同步”。`, `Cloud sync is unavailable: ${error.message}. Try again later.`);
      syncStatus("error", queued ? localized("待同步", "Pending sync") : localized("同步失败", "Sync failed"), detail);
      if (!syncReady) showMessage(localized("首次同步完成前暂不能答题，以免手机和电脑重复练习。", "Answering is paused until the first sync completes."), true);
      return false;
    } finally {
      syncBusy = false;
      $("sync-button").disabled = false;
      $("switch-account-button").disabled = false;
    }
  }

  async function switchAccount() {
    if (syncBusy) return;
    examController?.pause();
    const button = $("switch-account-button");
    button.disabled = true;
    const synchronized = await syncNow();
    if (!synchronized || syncMeta.pending.length) {
      showMessage(localized("切换已暂停：请先完成同步；若一直失败，请导出进度备份后再尝试。",
        "Account switch paused: sync first. If it keeps failing, export a backup before retrying."), true);
      button.disabled = false;
      return;
    }
    if (examController && !(await examController.syncPending())) {
      showMessage(localized("考试进度尚未同步；请联网后重试切换账号。",
        "Exam progress is not synced yet. Reconnect before switching accounts."), true);
      button.disabled = false;
      return;
    }
    const destination = reverse ? "/switch-account.html?direction=reverse" : "/switch-account.html";
    window.location.assign(`/signout-with-chatgpt?return_to=${encodeURIComponent(destination)}`);
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
      records: Object.create(null), level: "all", scope: "all", mode: "learning",
      reverseMode: "learning", enMode: "learning", enReverseMode: "learning" };
    if (!raw || typeof raw !== "object") return fresh;
    fresh.totalAnswers = Number.isSafeInteger(raw.totalAnswers) && raw.totalAnswers >= 0 ? raw.totalAnswers : 0;
    if (raw.records && typeof raw.records === "object") {
      for (const [id, value] of Object.entries(raw.records)) {
        const isEnglish = id.startsWith("en:");
        const unprefixed = isEnglish ? id.slice(3) : id;
        const isReverse = unprefixed.startsWith("reverse:");
        const baseId = isReverse ? unprefixed.slice(8) : unprefixed;
        const resolved = aliases[baseId] || baseId;
        if (!byId.has(resolved)) continue;
        const record = cleanRecord(value);
        if (record) {
          const key = `${isEnglish ? "en:" : ""}${isReverse ? "reverse:" : ""}${resolved}`;
          const prior = fresh.records[key];
          if (!prior || (record.mastered && !prior.mastered) ||
              (record.mastered === prior.mastered && record.attempts > prior.attempts)) {
            fresh.records[key] = record;
          }
        }
      }
    }
    if (typeof raw.scope === "string") fresh.scope = raw.scope;
    if (["all", "A1", "A2", "B1", "B2", "everyday", "ultimate"].includes(raw.level)) fresh.level = raw.level;
    if (raw.level === "baseline") fresh.level = "B2";
    if (raw.mode === "mastered") fresh.mode = "mastered";
    if (raw.reverseMode === "mastered") fresh.reverseMode = "mastered";
    if (raw.enMode === "mastered") fresh.enMode = "mastered";
    if (raw.enReverseMode === "mastered") fresh.enReverseMode = "mastered";
    return fresh;
  }

  function loadState() {
    try { return cleanState(storageKey ? JSON.parse(localStorage.getItem(storageKey)) : null); }
    catch (_) { return cleanState(null); }
  }

  function saveState() {
    state.level = ui.level.value;
    state.scope = ui.scope.value;
    state[english ? (reverse ? "enReverseMode" : "enMode") : (reverse ? "reverseMode" : "mode")] = ui.mode.value;
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (_) { showMessage(localized("浏览器未允许本地保存；请用“导出进度”备份。", "Browser storage is unavailable. Export a progress backup."), true); }
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
    chinesePronunciation.stop();
    pronunciation.play(term, { locale: ui.locale.value, slow }, reportPronunciation);
  }

  function reportChinesePronunciation(message, error = false) {
    if (!reverse) return;
    const target = $("chinese-pronunciation-status");
    target.textContent = message;
    target.classList.toggle("error", error);
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
    ui.level.append(makeOption("all", localized(`A1–B2 累计 · ${examCards.length} 张`, `A1–B2 · ${examCards.length}`)));
    for (const level of ["A1", "A2", "B1", "B2"]) {
      ui.level.append(makeOption(level, localized(`${level} · ${meta.levelCounts[level]} 张`, `${level} · ${meta.levelCounts[level]}`)));
    }
    ui.level.append(makeOption("everyday", localized(`日常与地区用语 · ${everydayCards.length} 张`, `Everyday · ${everydayCards.length}`)));
    ui.level.append(makeOption("ultimate", localized(`全上！· 全部 ${cards.length} 张`, `All In! · all ${cards.length} cards`)));
    ui.level.value = state.level;
  }

  function metaInLevel(ref) {
    return core.sourceEligible(ref, ui.level.value);
  }

  function buildScopeMenu() {
    const deck = levelCards();
    const preferred = state.scope;
    ui.scope.replaceChildren();
    ui.scope.append(makeOption("all", localized(`此词库全部词汇 · ${deck.length} 张`, `All categories · ${deck.length}`)));
    for (const group of ["听力", "分级词汇", "阅读", "写作", "同义替换", "连接词", "句型", "日常词汇", "地区口语"]) {
      const count = deck.filter(card => card.groups.includes(group) &&
        card.topicMeta.some(ref => ref.group === group && metaInLevel(ref))).length;
      if (count >= 10) ui.scope.append(makeOption(`group:${group}`, localized(`${group} · ${count} 张`, `${labelFor(group)} · ${count}`)));
    }
    for (const group of ["听力", "分级词汇", "阅读", "写作", "连接词", "日常词汇", "地区口语"]) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = localized(`${group} · 具体主题`, `${labelFor(group)} · topics`);
      const topics = [...new Set(deck.flatMap(card => card.topicMeta
        .filter(ref => ref.group === group && metaInLevel(ref)).map(ref => ref.topic)))];
      for (const topic of topics) {
        const count = deck.filter(card => card.topicMeta.some(ref =>
          ref.group === group && ref.topic === topic && metaInLevel(ref))).length;
        optgroup.append(makeOption(`topic:${topic}`, localized(`${topic} · ${count} 张`, `${labelFor(topic)} · ${count}`)));
      }
      if (topics.length) ui.scope.append(optgroup);
    }
    if ([...ui.scope.options].some(x => x.value === preferred)) ui.scope.value = preferred;
    else ui.scope.value = "all";
    ui.mode.value = state[english ? (reverse ? "enReverseMode" : "enMode") : (reverse ? "reverseMode" : "mode")];
  }

  function scopedCards() {
    return cards.filter(card => core.eligibleInView(card, ui.level.value, ui.scope.value));
  }

  function renderStats() {
    const deck = scopedCards();
    const daily = ui.level.value === "everyday";
    const ultimate = ui.level.value === "ultimate";
    document.querySelector(".eyebrow").textContent = ultimate
      ? localized("自我检测 · 全上！整库挑战", "Self-check · All In! complete deck") : daily
      ? localized("自我检测 · 日常与地区用语独立词库", "Self-check · everyday & regional French")
      : localized("自我检测 · A1–B2 分级词汇", "Self-check · A1–B2 graded French");
    $("deck-size").textContent = (ultimate ? cards.length : daily ? everydayMeta.uniqueCards : meta.uniqueCards).toLocaleString("zh-CN");
    $("source-size").textContent = ultimate
      ? localized("考试库 + 日常库 · 全部分类", "Exam + everyday decks · every category") : daily
      ? localized("独立日常库 · 与考试库分开", "Separate from the exam deck")
      : localized(`B2 合并后 ${meta.levelCounts.B2.toLocaleString("zh-CN")} 张`, `${meta.levelCounts.B2.toLocaleString("en")} combined B2 cards`);
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
    $("progress-caption").textContent = localized(`已掌握 ${mastered} / ${deck.length} · ${ratio}%`, `Mastered ${mastered} / ${deck.length} · ${ratio}%`);
    if (ui.library.open) renderLibrary();
  }

  function renderSession() {
    $("session-answered").textContent = session.answered;
    $("session-accuracy").textContent = session.answered
      ? `${Math.round(session.correct / session.answered * 100)}%` : "—";
    $("session-gained").textContent = session.gained;
  }

  function stageLabel(card) {
    const stage = core.progress(activeRecord(card), card);
    if (!english) return stage.label;
    if (!activeRecord(card)?.attempts) return "Not answered yet";
    if (activeRecord(card).mastered) return "Mastered";
    return `Correct streak · ${stage.current}/${stage.target}`;
  }

  function renderQuestion(card) {
    pronunciation.stop();
    chinesePronunciation.stop();
    if (dictionaryRequest) dictionaryRequest.abort();
    dictionaryRequest = null;
    closeDictionary();
    if (pronunciation.supported) reportPronunciation(localized("点击播放，使用本机法语语音。", "Tap play to use your device's French voice."));
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
    $("question-number").textContent = localized(`本次第 ${session.answered + 1} 题`, `Card ${session.answered + 1} this session`);
    $("card-stage").textContent = stageLabel(card);
    const scopeGroup = ui.scope.value.startsWith("group:") ? ui.scope.value.slice(6) : "";
    const scopeTopic = ui.scope.value.startsWith("topic:") ? ui.scope.value.slice(6) : "";
    const refs = card.topicMeta.filter(metaInLevel);
    const reference = refs.find(ref => ref.topic === scopeTopic) ||
      refs.find(ref => ref.group === scopeGroup) || refs[0] || card.topicMeta[0];
    const shownGroup = scopeGroup || reference.group;
    const shownTopic = scopeTopic || reference.topic;
    const firstLevel = ["A1", "A2", "B1", "B2"].find(level => card.levels.includes(level));
    $("card-level").textContent = ui.level.value === "everyday" ? localized("日常", "Everyday") :
      ui.level.value === "all" ? firstLevel : ui.level.value;
    $("card-group").textContent = labelFor(shownGroup);
    $("card-topic").textContent = shownTopic === shownGroup ? "" : labelFor(shownTopic);
    $("card-pos").textContent = labelFor(card.pos) || "";
    if (reverse) {
      ui.termLabel.textContent = card.meaning;
      ui.termLabel.lang = english ? "en" : "zh-CN";
    } else {
      renderTerm(card);
      ui.termLabel.lang = "fr";
    }
    $("question-title").classList.toggle("chinese-cue", reverse && !english);
    $("question-title").classList.toggle("english-cue", reverse && english);
    ui.context.textContent = card.example ? `“${card.example}”` : "";
    ui.context.hidden = reverse;
    if (reverse) {
      ui.chineseAudio.hidden = english;
      if (!english) reportChinesePronunciation(chinesePronunciation.supported
        ? "点击朗读中文题目。" : "当前浏览器不支持中文朗读。", !chinesePronunciation.supported);
    }
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
      label.lang = reverse ? "fr" : english ? "en" : "zh-CN";
      button.append(letter, label);
      button.addEventListener("click", () => submit(index));
      ui.answers.append(button);
    });
  }

  function showEmpty() {
    pronunciation.stop();
    chinesePronunciation.stop();
    if (dictionaryRequest) dictionaryRequest.abort();
    dictionaryRequest = null;
    closeDictionary();
    session.current = null;
    ui.questionArea.hidden = true;
    ui.empty.hidden = false;
    if (ui.mode.value === "learning") {
      $("empty-title").textContent = localized("这个范围的词都已掌握", "All words in this scope are mastered");
      $("empty-copy").textContent = localized("太好了。可以复查已掌握词，或切换到其他分类继续练。", "Review mastered words or choose another category.");
      $("empty-action").textContent = localized("复查已掌握词", "Review mastered words");
    } else {
      $("empty-title").textContent = localized("这里还没有已掌握词", "No mastered words here yet");
      $("empty-copy").textContent = localized("先在学习模式完成词条的复现条件，再回到这里复查。", "Complete the correct-answer streak in learning mode, then return to review.");
      $("empty-action").textContent = localized("开始学习", "Start learning");
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
      showMessage(localized("首次同步完成前请先点“立即同步”，避免重复练习。", "Sync your account before answering to avoid duplicate practice."), true);
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
      chinesePronunciation.stop();
      ui.chineseAudio.hidden = true;
      renderTerm(card);
      ui.termLabel.lang = "fr";
      $("question-title").classList.remove("chinese-cue");
      $("question-title").classList.remove("english-cue");
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
    syncStatus("pending", localized("待同步", "Pending sync"), localized("本题已暂存在本机，正在同步到账号…", "This answer is saved locally and is syncing to your account…"));
    renderStats();
    renderSession();
    $("card-stage").textContent = stageLabel(card);
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
    $("feedback-title").textContent = correct ? localized("答对了", "Correct")
      : index === -1 ? localized("已查看答案，记为错题", "Answer revealed — counted as incorrect")
      : localized("这次没选对", "Not quite");
    $("feedback-meaning").textContent = correctAnswer;
    const extra = [card.example ? localized(`例句／搭配：${card.example}`, `Example / collocation: ${card.example}`) : "",
      !english && card.note ? `用法提示：${card.note}` : "",
      localized("悬停或点击题目中的关键词可查看详解", "Hover over or tap a keyword above for dictionary details")].filter(Boolean);
    $("feedback-extra").textContent = extra.join("  ·  ");
    $("feedback-progress").textContent = stageLabel(card);
    ui.next.focus();
    void syncNow();
  }

  function renderLibrary() {
    const query = ui.search.value.trim().toLocaleLowerCase();
    const currentLibrary = levelCards();
    const matches = currentLibrary.filter(card => !query ||
      `${card.term} ${card.meaning} ${card.topic}`.toLocaleLowerCase().includes(query));
    $("library-count").textContent = query
      ? localized(`找到 ${matches.length} 张卡，显示前 40 张。`, `${matches.length} matches; showing the first 40.`)
      : localized(`当前词库 ${currentLibrary.length} 张卡，显示前 40 张；输入关键词可缩小范围。`,
        `${currentLibrary.length} cards in this deck; showing the first 40. Search to narrow them down.`);
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
      detail.textContent = `${card.meaning} · ${card.levels.join(" / ")} · ${labelFor(card.topic)}`;
      left.append(detail);
      const status = document.createElement("em");
      status.textContent = activeRecord(card)?.mastered ? localized("已掌握", "Mastered")
        : activeRecord(card)?.attempts ? localized("学习中", "Learning") : localized("未见过", "Unseen");
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
      speak.textContent = localized("播放", "Play");
      speak.setAttribute("aria-label", localized(`播放 ${card.term} 的法语发音`, `Play French pronunciation of ${card.term}`));
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
    showMessage(localized("进度备份已导出。请妥善保存 JSON 文件。 ", "Progress backup exported. Keep the JSON file safely."));
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
    state.enMode = "learning";
    state.enReverseMode = "learning";
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
  applyEnglishStatic();
  for (const link of document.querySelectorAll(".practice-nav a")) {
    if (link.dataset.direction === (reverse ? "reverse" : "forward"))
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  $("deck-size").textContent = meta.uniqueCards.toLocaleString("zh-CN");
  $("source-size").textContent = localized(`B2 合并后 ${meta.levelCounts.B2.toLocaleString("zh-CN")} 张`,
    `${meta.levelCounts.B2.toLocaleString("en")} combined B2 cards`);
  buildLevelMenu();
  buildScopeMenu();
  if (!pronunciation.supported) {
    ui.play.disabled = true;
    ui.slow.disabled = true;
    reportPronunciation(localized("当前浏览器不支持语音朗读。请换用支持系统朗读的浏览器。",
      "This browser cannot speak text. Try a browser with system speech support."), true);
  }
  renderStats(); renderSession(); advance();
  examController = examApi.create({ cards, quizCore: core, examCore, english, reverse, api,
    labelFor, levelSelect: ui.level, scopeSelect: ui.scope, ready: () => syncReady,
    restorePractice: advance, stopSpeech: () => { pronunciation.stop(); chinesePronunciation.stop(); } });
  installLanguagePicker();
  ui.play.addEventListener("click", () => {
    if (session.current) playPronunciation(session.current.term);
  });
  if (reverse) {
    ui.chinesePlay.disabled = english || !chinesePronunciation.supported;
    ui.chinesePlay.addEventListener("click", () => {
      if (!english && session.current && !session.locked) {
        pronunciation.stop();
        chinesePronunciation.play(session.current.meaning, reportChinesePronunciation);
      }
    });
  }
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
    reportPronunciation(localized(`已选择${ui.locale.value === "fr-CA" ? "加拿大" : "法国"}法语；点击播放试听。`,
      `${ui.locale.value === "fr-CA" ? "Canadian" : "France"} French selected. Tap Play to listen.`));
  });
  ui.level.addEventListener("change", () => {
    examController.pause();
    state.level = ui.level.value;
    state.scope = "all";
    buildScopeMenu();
    saveState(); renderStats(); advance(); examController.onScopeChange();
  });
  ui.scope.addEventListener("change", () => { examController.pause(); saveState(); renderStats(); advance(); examController.onScopeChange(); });
  ui.mode.addEventListener("change", () => { examController.pause(); saveState(); renderStats(); advance(); });
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
  $("switch-account-button").addEventListener("click", () => void switchAccount());
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("focus", () => void syncNow({ quiet: true }));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void syncNow({ quiet: true });
  });
  setInterval(() => { if (!document.hidden && syncReady) void syncNow({ quiet: true }); }, 30000);
  ui.library.addEventListener("toggle", () => { if (ui.library.open) renderLibrary(); });
  ui.search.addEventListener("input", renderLibrary);
  document.addEventListener("keydown", event => {
    if (document.querySelector(".language-dialog")?.open ||
        event.altKey || event.ctrlKey || event.metaKey ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (examController.handleKey(event)) return;
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
