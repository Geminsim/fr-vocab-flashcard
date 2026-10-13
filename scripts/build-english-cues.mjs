// Create the English answer key from the original Chinese study meanings.
// The translation cache is built once with fetch-chinese-meanings.ps1 and reviewed.
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const window = {};
for (const file of ["vocab-data.js", "everyday-data.js"]) {
  vm.runInNewContext(fs.readFileSync(new URL(`public/${file}`, root), "utf8"), { window });
}
const cards = [...window.TEF_VOCAB_CARDS, ...window.TEF_EVERYDAY_CARDS];
const sourcePath = new URL(".sites-runtime/chinese-meanings.txt", root);
fs.writeFileSync(sourcePath, [...new Set(cards.map(card => card.meaning))].join("\n") + "\n");
const cachePath = new URL(".sites-runtime/english-from-chinese.json", root);
if (!fs.existsSync(cachePath)) {
  console.log(`${new Set(cards.map(card => card.meaning)).size} Chinese meanings ready for translation.`);
  process.exit(0);
}
const translated = JSON.parse(fs.readFileSync(cachePath, "utf8"));
// Resolve short Chinese labels whose automatic translation loses the French sense.
const curated = {
  "une démarche": "administrative procedure; steps",
  "un formulaire": "form (to fill in)",
  "un justificatif": "supporting document; proof",
  "une pièce d'identité": "identity document; ID",
  "un dossier": "application file; dossier",
  "un rendez-vous": "appointment; meeting; date",
  "un guichet": "service counter; ticket window",
  "une inscription": "registration; enrolment",
  "une résiliation": "cancellation; termination",
  "une panne": "breakdown; fault",
  "un entretien": "maintenance; interview",
  "une colocation": "shared housing; flatshare",
  "un état des lieux": "property condition inspection",
  "un stationnement": "parking",
  "la propreté": "cleanliness",
  "le tri": "sorting",
  "une rénovation": "renovation",
  "une filière": "field of study; sector",
  "un échec": "failure; failing grade",
  "la réussite": "success; passing",
  "co-épouse": "co-wife",
  "caillou": "small stone; pebble; gravel",
  "charpentier": "carpenter; woodworker",
  "corbeau": "raven; crow",
  "cône": "cone; conifer cone",
  "ethnie": "ethnic group; ethnicity",
  "rétro-ingénierie": "reverse engineering"
};
const english = {};
const missing = [];
for (const card of cards) {
  const value = curated[card.term] || translated[card.meaning];
  if (typeof value === "string" && value.trim()) english[card.id] = value.trim();
  else missing.push(card.term);
}
fs.writeFileSync(new URL("public/english-data.js", root),
  `// English study meanings translated from the existing Chinese answer key.\nwindow.TEF_ENGLISH_MEANINGS = ${JSON.stringify(english)};\n`);
console.log(`${Object.keys(english).length}/${cards.length} English study meanings; ${missing.length} missing.`);
