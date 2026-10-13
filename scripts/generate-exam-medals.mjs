import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../public/medals");
mkdirSync(out, { recursive: true });

const ranks = [
  { file: "a1", title: "Verdant Initiate", metal: ["#f8dca6", "#b8733d", "#6c3d2c", "#d69b5c"], enamel: ["#234b49", "#102934"], gem: ["#9ef3c8", "#207d68", "#0c4c5d"], detail: 1 },
  { file: "a2", title: "Copper Vanguard", metal: ["#ffe8b4", "#c38644", "#76482d", "#edbd72"], enamel: ["#35536a", "#142d41"], gem: ["#b5f1df", "#42a596", "#176d83"], detail: 2 },
  { file: "b1", title: "Azure Sentinel", metal: ["#f8fdff", "#91b6c6", "#405e78", "#d6ecf0"], enamel: ["#304a84", "#151e4e"], gem: ["#d9f9ff", "#4699e2", "#3256b2"], detail: 3 },
  { file: "b2", title: "Gilded Sovereign", metal: ["#fff6c5", "#d6a145", "#7e4d2f", "#f4db83"], enamel: ["#613b75", "#2c234f"], gem: ["#fae8ff", "#b77cdd", "#6b46ae"], detail: 4 },
  { file: "everyday", title: "Wanderer's Crest", metal: ["#ffe2bf", "#df9257", "#714466", "#ecb577"], enamel: ["#453579", "#222b63"], gem: ["#ffe6b7", "#fa936c", "#cc4885"], detail: 4, wanderer: true },
  { file: "ultimate", title: "Aurora Ascendant", metal: ["#ffffdc", "#f2cd75", "#8a5a65", "#fff2a4"], enamel: ["#386795", "#2e215d"], gem: ["#f7ffff", "#6be6dc", "#9c74e9"], detail: 5 },
];

const shield = "M128 34C151 48 179 45 211 59L207 150C205 198 178 239 128 274C78 239 51 198 49 150L45 59C77 45 105 48 128 34Z";
const inset = "M128 55C151 67 171 66 190 72L187 149C185 187 163 222 128 249C93 222 71 187 69 149L66 72C85 66 105 67 128 55Z";

function wings(detail) {
  if (detail < 2) return "";
  const blade = (i) => {
    const y = 65 + i * 19;
    const x = 38 - i * 4;
    return `<path d="M70 ${93 + i * 12}C46 ${92 + i * 10} ${x} ${y + 5} ${15 + i * 2} ${y - 7}C${22 + i * 3} ${y + 25} 35 ${y + 38} 64 ${y + 42}Z" fill="url(#metal)" stroke="#26354c" stroke-width="2.5"/>
      <path d="M58 ${101 + i * 12}C38 ${95 + i * 10} ${30 + i * 2} ${y + 13} ${21 + i * 2} ${y + 3}" fill="none" stroke="#fff9dd" stroke-opacity=".73" stroke-width="2"/>`;
  };
  const blades = Array.from({ length: detail >= 4 ? 4 : detail - 1 }, (_, i) => blade(i)).join("");
  return `<g id="left-wing">${blades}</g><use href="#left-wing" transform="translate(256 0) scale(-1 1)"/>`;
}

function laurel(detail) {
  if (detail < 3) return "";
  const leaves = Array.from({ length: detail >= 5 ? 7 : detail + 2 }, (_, i) => {
    const x = 48 + i * 3.5;
    const y = 128 + i * 15;
    return `<path d="M${x} ${y}q-15-3-20-16q15 1 21 12M${x} ${y + 1}q-6 12-19 15q6-13 18-16" fill="url(#metal)" stroke="#4f4a58" stroke-width="1"/>`;
  }).join("");
  return `<g id="left-laurel"><path d="M67 109C34 135 31 197 74 240" fill="none" stroke="url(#metal)" stroke-width="4"/>${leaves}</g><use href="#left-laurel" transform="translate(256 0) scale(-1 1)"/>`;
}

function crown(detail, wanderer) {
  if (detail === 1) return `<path d="M102 35l11-14 15 10 15-10 11 14-26 8Z" fill="url(#metal)" stroke="#472d2a" stroke-width="3"/>`;
  if (wanderer) return `<path d="M102 32c-8-19-9-25-4-26 12-2 18 21 30 19 12 2 18-21 30-19 5 1 4 7-4 26l-26 15Z" fill="url(#metal)" stroke="#422a55" stroke-width="3"/><path d="M107 27q21 16 42 0" fill="none" stroke="#fff4ca" stroke-width="3"/>`;
  const points = detail >= 4 ? "M88 40 92 10l19 16 17-22 17 22 19-16 4 30" : "M96 39 100 15l18 15 10-23 10 23 18-15 4 24";
  return `<path d="${points}L128 51Z" fill="url(#metal)" stroke="#473e49" stroke-width="3" stroke-linejoin="round"/><path d="M96 39h64l-5 13h-54Z" fill="url(#metal)" stroke="#473e49" stroke-width="2"/><circle cx="128" cy="30" r="5" fill="url(#gem)" stroke="#fff3cf" stroke-width="2"/>`;
}

function halo(detail) {
  if (detail < 5) return "";
  const rays = Array.from({ length: 16 }, (_, i) => `<path d="M128 2 133 32 128 43 123 32Z" fill="url(#metal)" stroke="#7e638d" stroke-width="1.5" transform="rotate(${i * 22.5} 128 139)"/>`).join("");
  return `<g opacity=".95">${rays}</g><circle cx="128" cy="139" r="107" fill="none" stroke="#b2f7e9" stroke-opacity=".62" stroke-width="3" stroke-dasharray="2 7"/>`;
}

function centralGem(detail, wanderer) {
  if (wanderer) return `<circle cx="128" cy="145" r="46" fill="url(#gem)" stroke="url(#metal)" stroke-width="5"/><path d="M128 105C154 113 162 135 151 159C141 179 111 186 96 162C110 165 131 149 128 105Z" fill="#f7d0ad" opacity=".72"/><path d="M128 108C107 123 103 143 110 159C119 140 133 137 148 143" fill="none" stroke="#fff8d8" stroke-width="5" stroke-linecap="round"/><circle cx="118" cy="141" r="5" fill="#fff9dc"/>`;
  const size = detail === 1 ? 34 : detail >= 4 ? 48 : 41;
  const left = 128 - size;
  const right = 128 + size;
  const top = 113 - (detail >= 4 ? 8 : 0);
  const bottom = 202 + (detail >= 4 ? 5 : 0);
  return `<path d="M128 ${top} ${right} 130 ${right - 8} 166 128 ${bottom} ${left + 8} 166 ${left} 130Z" fill="url(#gem)" stroke="url(#metal)" stroke-width="5" stroke-linejoin="round"/>
    <path d="M${left} 130h${size * 2}M128 ${top}v${bottom - top}M${left} 130l${size} ${bottom - 130}M${right} 130l-${size} ${bottom - 130}" fill="none" stroke="#e9ffff" stroke-opacity=".65" stroke-width="2"/>
    <path d="M128 ${top + 6} 128 ${bottom - 4} ${left + 8} 166 ${left} 130Z" fill="#fff" opacity=".14"/>
    <path d="M${left + 7} 131 128 ${top + 8} ${right - 7} 131" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2"/>`;
}

function ornament(detail) {
  const studs = Array.from({ length: detail >= 4 ? 7 : 5 }, (_, i) => {
    const x = 87 + i * (detail >= 4 ? 13.5 : 20.5);
    return `<path d="m${x} 85 3 4-3 4-3-4Z" fill="url(#metal)" opacity=".82"/>`;
  }).join("");
  return `<path d="M87 84q41 13 82 0" fill="none" stroke="url(#metal)" stroke-width="2" opacity=".83"/>${studs}
    <path d="M93 219q35 21 70 0" fill="none" stroke="url(#metal)" stroke-width="3"/>
    <path d="M104 230q24 13 48 0" fill="none" stroke="#fff6d5" stroke-opacity=".66" stroke-width="1.5"/>`;
}

function medal(rank) {
  const [light, mid, dark, bright] = rank.metal;
  const [enamelTop, enamelBottom] = rank.enamel;
  const [gemLight, gemMid, gemDark] = rank.gem;
  const upper = rank.detail >= 5 ? `<path d="M128 57 146 77 128 98 110 77Z" fill="url(#gem)" stroke="#fff7d8" stroke-width="3"/>` : "";
  const jewels = rank.detail >= 4 ? `<circle cx="83" cy="180" r="5" fill="url(#gem)" stroke="#fff6d8" stroke-width="2"/><circle cx="173" cy="180" r="5" fill="url(#gem)" stroke="#fff6d8" stroke-width="2"/>` : "";
  const highTier = rank.detail >= 5 ? `<path d="M70 244 98 264 128 286 158 264 186 244" fill="none" stroke="url(#metal)" stroke-width="8" stroke-linecap="round"/><path d="M128 206v73" stroke="#fff9d7" stroke-opacity=".6" stroke-width="2"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 300" role="img" aria-labelledby="title"><title id="title">${rank.title}</title>
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".25" stop-color="${mid}"/><stop offset=".5" stop-color="${dark}"/><stop offset=".74" stop-color="${bright}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="enamel" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="${enamelTop}"/><stop offset="1" stop-color="${enamelBottom}"/></linearGradient>
    <radialGradient id="gem" cx=".32" cy=".2" r=".88"><stop stop-color="${gemLight}"/><stop offset=".43" stop-color="${gemMid}"/><stop offset="1" stop-color="${gemDark}"/></radialGradient>
    <linearGradient id="flash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".7"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".1"/></linearGradient>
    <filter id="shadow" x="-35%" y="-30%" width="170%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#071823" flood-opacity=".36"/></filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>
  ${rank.detail >= 5 ? `<ellipse cx="128" cy="135" rx="96" ry="104" fill="${gemMid}" opacity=".4" filter="url(#glow)"/>` : ""}
  ${halo(rank.detail)}
  <g filter="url(#shadow)">${wings(rank.detail)}
    <path d="${shield}" fill="#1b2837" stroke="${dark}" stroke-width="8"/>
    <path d="${shield}" fill="url(#metal)" stroke="${light}" stroke-width="3" transform="translate(128 137) scale(.93) translate(-128 -137)"/>
    <path d="${inset}" fill="url(#enamel)" stroke="${dark}" stroke-width="5"/>
    <path d="${inset}" fill="url(#flash)" opacity=".26"/>
    <path d="M80 81C100 68 113 67 128 73C143 67 156 68 176 81" fill="none" stroke="${light}" stroke-width="2.5" opacity=".8"/>
    ${laurel(rank.detail)}${ornament(rank.detail)}${upper}${centralGem(rank.detail, rank.wanderer)}${jewels}
    <path d="M79 151c2 47 18 72 49 96 31-24 47-49 49-96" fill="none" stroke="${light}" stroke-opacity=".7" stroke-width="2"/>
    ${crown(rank.detail, rank.wanderer)}${highTier}
  </g>
  <path d="M76 58q50-31 104 0" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
</svg>`;
}

for (const rank of ranks) writeFileSync(resolve(out, `${rank.file}.svg`), medal(rank).replace(/^ +$/gm, ""), "utf8");
console.log(`Generated ${ranks.length} original, text-free rank emblems.`);
