import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("./public/app.js", import.meta.url), "utf8");
const start = source.indexOf("  const functionWords");
const end = source.indexOf("  function renderTerm", start);
assert.ok(start >= 0 && end > start);
const keywordParts = vm.runInNewContext(`${source.slice(start, end)}\nkeywordParts`);

for (const [term, expected] of [
  ["un dossier", ["dossier"]],
  ["un service public", ["service", "public"]],
  ["une pièce d'identité", ["pièce", "identité"]],
  ["contribuer à", ["contribuer"]],
  ["prendre en charge", ["prendre", "charge"]],
  ["se mettre en place", ["mettre", "place"]],
]) {
  assert.deepEqual(Array.from(keywordParts(term).filter(part => part.keyword), part => part.word), expected, term);
}

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL("./public/vocab-data.js", import.meta.url), "utf8"), context);
for (const card of context.window.TEF_VOCAB_CARDS) {
  const parts = keywordParts(card.term);
  assert.ok(parts.some(part => part.keyword), `No selectable keyword: ${card.term}`);
  assert.equal(parts.map(part => part.text ?? `${part.before}${part.word}${part.after}`).join(""), card.term);
}

console.log(`PASS: individual keyword lookup is available for all ${context.window.TEF_VOCAB_CARDS.length} cards`);
