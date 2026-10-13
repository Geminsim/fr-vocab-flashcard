import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const vocabularyPath = resolve(root, "public/vocab-data.js");
const aliasesPath = resolve(root, "db/card-aliases.json");
const input = readFileSync(vocabularyPath, "utf8");
const meta = JSON.parse(input.match(/^window\.TEF_VOCAB_META = (.+);$/m)[1]);
const cards = JSON.parse(input.match(/^window\.TEF_VOCAB_CARDS = (.+);$/m)[1]);
const aliases = JSON.parse(readFileSync(aliasesPath, "utf8"));
const byTerm = new Map();
for (const card of cards) {
  const key = card.term.normalize("NFC").trim().toLocaleLowerCase("fr");
  const group = byTerm.get(key) || [];
  group.push(card);
  byTerm.set(key, group);
}
const unique = values => [...new Set(values)];
const result = [];
for (const group of byTerm.values()) {
  // Keep the original baseline ID when possible, so most existing records remain untouched.
  const primary = group.find(card => card.decks.includes("baseline")) || group[0];
  const combined = structuredClone(primary);
  for (const card of group) {
    if (card.id === primary.id) continue;
    aliases[card.id] = primary.id;
    combined.sourceCount += card.sourceCount;
    combined.baselineSourceCount += card.baselineSourceCount;
    combined.topicMeta.push(...card.topicMeta);
    if (!combined.example && card.example) combined.example = card.example;
    if (!combined.note && card.note) combined.note = card.note;
  }
  // Preserve distinct senses while removing a repeated prompt for the same French term.
  if (group.length > 1) {
    const senses = unique(group.flatMap(card => card.meaning.split(/[；;]/).map(x => x.trim()).filter(Boolean)));
    combined.meaning = senses.join("；");
  }
  combined.topics = unique(combined.topicMeta.map(ref => ref.topic));
  combined.groups = unique(combined.topicMeta.map(ref => ref.group));
  combined.levels = unique(combined.topicMeta.map(ref => ref.level));
  combined.decks = unique(combined.topicMeta.map(ref => ref.deck));
  combined.families = unique(group.flatMap(card => card.families || []));
  combined.connectorTopics = unique(group.flatMap(card => card.connectorTopics || []));
  result.push(combined);
}
// Prior aliases may point at a card merged again during a later build.
for (const [oldId, target] of Object.entries(aliases)) {
  let next = target;
  const visited = new Set([oldId]);
  while (aliases[next] && !visited.has(next)) { visited.add(next); next = aliases[next]; }
  aliases[oldId] = next;
}
const finalIds = new Set(result.map(card => card.id));
for (const [oldId, target] of Object.entries(aliases)) {
  if (oldId === target || !finalIds.has(target)) throw new Error(`Invalid card alias: ${oldId} -> ${target}`);
}
meta.signature = createHash("sha256").update(JSON.stringify(result.map(card =>
  [card.id, card.term, card.meaning]))).digest("hex").slice(0, 16);
meta.uniqueCards = result.length;
meta.baselineCards = result.filter(card => card.decks.includes("baseline")).length;
meta.totalOccurrences = result.reduce((sum, card) => sum + card.sourceCount, 0);
meta.extensionOccurrences = meta.totalOccurrences - meta.sourceOccurrences;
meta.levelCounts = Object.fromEntries(["A1", "A2", "B1", "B2"].map(level =>
  [level, result.filter(card => card.levels.includes(level)).length]));
meta.groups = Object.fromEntries(unique(result.flatMap(card => card.groups)).map(group =>
  [group, result.filter(card => card.groups.includes(group)).length]));
const output = "// Generated vocabulary data with merged duplicate French terms.\n" +
  "window.TEF_VOCAB_META = " + JSON.stringify(meta) + ";\n" +
  "window.TEF_CARD_ALIASES = " + JSON.stringify(aliases) + ";\n" +
  "window.TEF_VOCAB_CARDS = " + JSON.stringify(result) + ";\n";
writeFileSync(vocabularyPath, output);
writeFileSync(aliasesPath, JSON.stringify(aliases) + "\n");
console.log(`Vocabulary: ${cards.length} source cards -> ${result.length} unique French terms; ${Object.keys(aliases).length} legacy IDs retained`);
