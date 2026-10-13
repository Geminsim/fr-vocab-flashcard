(function (root, factory) {
  root.TEFPronunciation = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createEngine(synth, Utterance) {
    let request = 0;
    const supported = !!synth && typeof synth.speak === "function" &&
      typeof synth.getVoices === "function" && typeof Utterance === "function";

    function stop() {
      request++;
      if (supported) {
        try { synth.cancel(); } catch (_) { /* Keep card navigation usable. */ }
      }
    }

    function play(text, { locale = "fr-FR", slow = false } = {}, report = () => {}) {
      if (!supported) {
        report("当前浏览器不支持语音朗读。请换用支持系统朗读的浏览器。", true);
        return false;
      }
      const spokenText = String(text || "").replace(/\.{3}|…/g, " ").replace(/\s+/g, " ").trim();
      if (!spokenText) return false;
      stop();
      let voices = [];
      try { voices = synth.getVoices() || []; } catch (_) { /* Some devices load voices late. */ }
      const frenchVoices = voices.filter(voice => /^fr(?:[-_]|$)/i.test(voice.lang || ""));
      if (voices.length && !frenchVoices.length) {
        report("本机没有可用的法语语音。请在设备语音设置中安装法语语音后重试。", true);
        return false;
      }
      const chosen = frenchVoices.find(voice =>
        (voice.lang || "").replace("_", "-").toLowerCase() === locale.toLowerCase()) ||
        frenchVoices[0] || null;
      const fallback = chosen &&
        (chosen.lang || "").replace("_", "-").toLowerCase() !== locale.toLowerCase();
      const voiceLabel = chosen
        ? /^fr[-_]ca$/i.test(chosen.lang) ? "加拿大法语"
          : /^fr[-_]fr$/i.test(chosen.lang) ? "法国法语" : "其他法语"
        : "设备默认法语语音";
      const note = fallback ? `本机没有所选口音，已改用${voiceLabel}。`
        : !chosen ? "尚未检测到法语语音；已请求设备按所选口音朗读。" : "";
      const current = ++request;
      try {
        const utterance = new Utterance(spokenText);
        utterance.lang = chosen?.lang || locale;
        if (chosen) utterance.voice = chosen;
        utterance.rate = slow ? 0.72 : 0.95;
        utterance.onstart = () => {
          if (current === request) report(note || (slow ? "正在慢速播放…" : "正在播放…"));
        };
        utterance.onend = () => {
          if (current === request) report(note || "播放完毕。");
        };
        utterance.onerror = () => {
          if (current === request) report("播放失败。请检查设备音量和法语语音设置后重试。", true);
        };
        report(note || "正在请求设备语音…");
        synth.speak(utterance);
        return true;
      } catch (_) {
        report("播放失败。请检查浏览器的语音权限或换一个浏览器重试。", true);
        return false;
      }
    }

    return { supported, play, stop };
  }

  return { createEngine };
});
