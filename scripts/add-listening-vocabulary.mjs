import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const vocabularyPath = resolve(root, "public/vocab-data.js");
const sourcePath = resolve(root, "scripts/listening-b2.txt");
const current = readFileSync(vocabularyPath, "utf8");
const metadataMatch = current.match(/^window\.TEF_VOCAB_META = (.+);$/m);
const cardsMatch = current.match(/^window\.TEF_VOCAB_CARDS = (.+);$/m);
if (!metadataMatch || !cardsMatch) throw new Error("Cannot parse generated vocabulary data");
const meta = JSON.parse(metadataMatch[1]);
const existing = JSON.parse(cardsMatch[1]);

const unique = values => [...new Set(values)];
const keyFor = (term, meaning) => `${term.toLocaleLowerCase("fr")}\0${meaning}`;
const cardId = (term, meaning) => createHash("sha1").update(keyFor(term, meaning)).digest("hex").slice(0, 14);
const signature = cards => createHash("sha256").update(
  JSON.stringify(cards.map(card => [card.id, card.term, card.meaning]))
).digest("hex").slice(0, 16);

// Remove the prior generated listening layer so rerunning this script is exact and idempotent.
const cards = [];
for (const original of existing) {
  const card = structuredClone(original);
  const removed = card.topicMeta.filter(ref => ref.group === "听力").length;
  if (removed) {
    card.topicMeta = card.topicMeta.filter(ref => ref.group !== "听力");
    if (!card.topicMeta.length) continue;
    card.sourceCount -= removed;
    card.topics = unique(card.topicMeta.map(ref => ref.topic));
    card.groups = unique(card.topicMeta.map(ref => ref.group));
    card.levels = unique(card.topicMeta.map(ref => ref.level));
    card.decks = unique(card.topicMeta.map(ref => ref.deck));
    card.group = card.topicMeta[0].group;
    card.topic = card.topicMeta[0].topic;
  }
  cards.push(card);
}

const byKey = new Map(cards.map(card => [keyFor(card.term, card.meaning), card]));
const byTerm = new Map(cards.map(card => [card.term.normalize("NFC").toLocaleLowerCase("fr"), card]));
const seenSource = new Set();
let topic = "";
let sourceEntries = 0;
let added = 0;
let reused = 0;
for (const [index, raw] of readFileSync(sourcePath, "utf8").split(/\r?\n/).entries()) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  if (line.startsWith("@")) {
    topic = line.slice(1).trim();
    if (!topic) throw new Error(`Empty topic at line ${index + 1}`);
    continue;
  }
  if (!topic) throw new Error(`Missing topic before line ${index + 1}`);
  const [pair, example = "", note = ""] = line.split("|");
  const separator = pair.indexOf("=");
  if (separator < 1 || !/[\u3400-\u9fff]/.test(pair.slice(separator + 1))) {
    throw new Error(`Invalid listening entry at line ${index + 1}`);
  }
  const term = pair.slice(0, separator).trim();
  const meaning = pair.slice(separator + 1).trim();
  const key = keyFor(term, meaning);
  if (seenSource.has(key)) throw new Error(`Duplicate listening entry: ${term}`);
  seenSource.add(key);
  sourceEntries++;
  const reference = { topic, group: "听力", level: "B2", deck: "extension" };
  const card = byKey.get(key) || byTerm.get(term.normalize("NFC").toLocaleLowerCase("fr"));
  if (card) {
    if (!card.meaning.split(/[；;]/).includes(meaning)) {
      const senses = new Set([...card.meaning.split(/[；;]/), ...meaning.split(/[；;]/)]
        .map(value => value.trim()).filter(Boolean));
      card.meaning = [...senses].join("；");
    }
    card.sourceCount++;
    card.topicMeta.push(reference);
    if (!card.topics.includes(topic)) card.topics.push(topic);
    if (!card.groups.includes("听力")) card.groups.push("听力");
    if (!card.levels.includes("B2")) card.levels.push("B2");
    if (!card.decks.includes("extension")) card.decks.push("extension");
    reused++;
  } else {
    const created = {
      id: cardId(term, meaning), term, meaning, group: "听力", topic,
      topics: [topic], groups: ["听力"], topicMeta: [reference],
      example: example.trim(), note: note.trim(), pos: "", families: [],
      connectorTopics: [], levels: ["B2"], decks: ["extension"],
      baselineSourceCount: 0, sourceCount: 1,
    };
    cards.push(created);
    byKey.set(key, created);
    byTerm.set(term.normalize("NFC").toLocaleLowerCase("fr"), created);
    added++;
  }
}

if (new Set(cards.map(card => card.id)).size !== cards.length) throw new Error("Card ID collision");
const baselineOccurrences = meta.sourceOccurrences;
const totalOccurrences = cards.reduce((sum, card) => sum + card.sourceCount, 0);
const nextMeta = {
  ...meta,
  version: 3,
  signature: signature(cards),
  extensionOccurrences: totalOccurrences - baselineOccurrences,
  totalOccurrences,
  uniqueCards: cards.length,
  levelCounts: Object.fromEntries(["A1", "A2", "B1", "B2"]
    .map(level => [level, cards.filter(card => card.levels.includes(level)).length])),
  groups: Object.fromEntries(unique(cards.flatMap(card => card.groups))
    .map(group => [group, cards.filter(card => card.groups.includes(group)).length])),
  listeningCards: sourceEntries,
};
const output = "// Generated vocabulary data with curated B2 listening entries.\n" +
  "window.TEF_VOCAB_META = " + JSON.stringify(nextMeta) + ";\n" +
  "window.TEF_VOCAB_CARDS = " + JSON.stringify(cards) + ";\n";
if (output !== current) writeFileSync(vocabularyPath, output);
console.log(`B2 listening: ${sourceEntries} entries, ${added} new cards, ${reused} shared with existing progress`);
