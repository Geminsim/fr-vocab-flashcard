import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const projectRoot = resolve(import.meta.dirname, "..");
const context = { window: {} };
runInNewContext(readFileSync(resolve(projectRoot, "public/vocab-data.js"), "utf8"), context);
const cards = context.window.TEF_VOCAB_CARDS;
const signature = context.window.TEF_VOCAB_META?.signature;
if (!Array.isArray(cards) || !signature || new Set(cards.map(card => card.id)).size !== cards.length) {
  throw new Error("Vocabulary data is missing or has duplicate card IDs");
}
const lowLevelIds = cards.filter(card => card.levels.some(level => level === "A1" || level === "A2"))
  .map(card => card.id).sort();
const output = JSON.stringify({ signature, lowLevelIds }) + "\n";
const destination = resolve(projectRoot, "db/mastery-index.json");
if (!existsSync(destination) || readFileSync(destination, "utf8") !== output) {
  writeFileSync(destination, output);
}
