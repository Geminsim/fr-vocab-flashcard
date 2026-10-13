"""Create a separate, frequency-screened everyday deck from FreeDict fra-zho TEI.

The source archive is not committed. Run with the extracted TEI path supplied below
and wordfreq available on PYTHONPATH; the generated, attributed deck is committed.
"""

from collections import Counter
from hashlib import sha1
from pathlib import Path
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET

from wordfreq import zipf_frequency
from opencc import OpenCC

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".sites-runtime/fra-zho/fra-zho.tei"
OUTPUT = ROOT / "public/everyday-data.js"
REGIONAL = ROOT / "scripts/regional-vocabulary.tsv"
NS = {"tei": "http://www.tei-c.org/ns/1.0"}
to_simplified = OpenCC("t2s")
EXAM_TEXT = (ROOT / "public/vocab-data.js").read_text(encoding="utf-8")
EXAM = json.loads(re.search(r"^window\.TEF_VOCAB_CARDS = (.+);$", EXAM_TEXT, re.M).group(1))


def key(text):
    text = unicodedata.normalize("NFC", text).strip().casefold()
    return re.sub(r"^(?:(?:un|une|le|la|les)\s+|l['’])", "", text)


GLOSS_OVERRIDES = {
    "est": "是（être 的第三人称单数）；东（方位）",
    "pas": "不；没有；一步",
    "plus": "更多；更加；不再（ne…plus）",
    "tout": "全部；所有；完全",
    "même": "相同的；甚至；自己",
    "moins": "更少；减去；负号",
    "juste": "正好；仅仅；公正的",
    "cas": "情况；案例；格（语法）",
    "mort": "死亡；死的",
    "suite": "后续；接下来；续作",
    "raison": "理由；原因；道理",
    "nombre": "数量；数目；数字",
    "passer": "经过；度过；通过",
    "argent": "钱；银",
    "tour": "轮次；参观；塔",
    "aide": "帮助；帮手",
    "action": "行动；行为；股票",
    "marche": "步行；台阶；运转",
    "mode": "方式；时尚；模式",
    "texte": "文本；文章；课文",
    "fonction": "功能；职务；函数",
    "espace": "空间；间距；空格",
    "passage": "经过；通道；段落",
    "fini": "结束的；完成的；有限的",
    "série": "系列；连续剧",
    "code": "代码；密码；法规",
    "outil": "工具",
    "emplacement": "位置；场地",
    "carrée": "方形的（阴性）",
    "charpente": "房屋框架；木结构",
    "garou": "狼人（组合词中）",
    "attribut": "属性；特征",
}


exam_terms = {key(card["term"]) for card in EXAM}
cards = {}
reasons = Counter()
root = ET.parse(SOURCE).getroot()
for entry in root.findall(".//tei:entry", NS):
    word = entry.findtext("tei:form/tei:orth", default="", namespaces=NS).strip()
    pos = entry.findtext("tei:gramGrp/tei:pos", default="", namespaces=NS).strip()
    gender = entry.findtext("tei:gramGrp/tei:gen", default="", namespaces=NS).strip()
    if pos not in {"n", "v", "adj", "adv"}:
        reasons["part of speech"] += 1
        continue
    if (not re.fullmatch(r"[a-zà-öø-ÿœæ'’-]{3,28}", word)
            or word.startswith("-") or word.endswith("-")):
        reasons["non-daily form"] += 1
        continue
    if key(word) in exam_terms:
        reasons["exam overlap"] += 1
        continue
    frequency = zipf_frequency(word, "fr")
    if frequency < 3.15:
        reasons["low frequency"] += 1
        continue
    raw_glosses = [to_simplified.convert(" ".join("".join(quote.itertext()).split())) for quote in
        entry.findall(".//tei:cit[@type='trans']/tei:quote", NS)]
    glosses = []
    for gloss in raw_glosses:
        if not re.search(r"[\u3400-\u9fff]", gloss):
            continue
        if len(gloss) > 16 or re.search(r"[A-Za-z0-9]", gloss):
            continue
        if gloss not in glosses:
            glosses.append(gloss)
    if not glosses:
        reasons["unusable translation"] += 1
        continue
    # Very long, multi-sense answer keys make the multiple-choice exercise ambiguous.
    meaning = GLOSS_OVERRIDES.get(word, "；".join(glosses[:3]))
    if len(meaning) > 32:
        meaning = "；".join(glosses[:2])
    if len(meaning) > 32:
        reasons["long translation"] += 1
        continue
    normalized = key(word)
    if normalized in cards:
        reasons["duplicate headword"] += 1
        continue
    topic = {"n": "日常名词", "v": "日常动词", "adj": "形容词", "adv": "副词"}[pos]
    term = word
    ref = {"topic": topic, "group": "日常词汇", "level": "everyday", "deck": "everyday"}
    cards[normalized] = {
        "id": "daily-" + sha1(normalized.encode("utf-8")).hexdigest()[:14],
        "term": term, "meaning": meaning, "group": "日常词汇", "topic": topic,
        "topics": [topic], "groups": ["日常词汇"], "topicMeta": [ref],
        "example": "", "note": "", "pos": pos + (".m" if gender == "masc" else ".f" if gender == "fem" else "."),
        "families": [], "connectorTopics": [], "levels": ["everyday"],
        "decks": ["everyday"], "baselineSourceCount": 0, "sourceCount": 1,
        "frequency": round(frequency, 2),
    }

if REGIONAL.exists():
    for number, raw in enumerate(REGIONAL.read_text(encoding="utf-8").splitlines(), 1):
        if not raw or raw.startswith("#"):
            continue
        fields = raw.split("\t")
        if len(fields) != 5:
            raise ValueError(f"Regional entry {number}: expected 5 tab-separated fields")
        term, meaning, region, register, note = [field.strip() for field in fields]
        if region not in {"魁省", "法国"} or register not in {"地区", "口语", "俗语", "粗俗"}:
            raise ValueError(f"Regional entry {number}: invalid region/register")
        normalized = key(term)
        if normalized in exam_terms:
            reasons["regional exam overlap"] += 1
            continue
        topic = f"{region}{register}"
        ref = {"topic": topic, "group": "地区口语", "level": "everyday", "deck": "everyday"}
        item = cards.get(normalized)
        if item:
            item["meaning"] = meaning
            item["group"] = "地区口语"
            item["topic"] = topic
            item["groups"] = ["地区口语"]
            item["topics"] = [topic]
            item["topicMeta"] = [ref]
            item["note"] = note or f"{region}{register}，避免用于正式写作。"
        else:
            cards[normalized] = {
                "id": "daily-" + sha1(normalized.encode("utf-8")).hexdigest()[:14],
                "term": term, "meaning": meaning, "group": "地区口语", "topic": topic,
                "topics": [topic], "groups": ["地区口语"], "topicMeta": [ref],
                "example": "", "note": note or f"{region}{register}，避免用于正式写作。",
                "pos": "口语", "families": [], "connectorTopics": [],
                "levels": ["everyday"], "decks": ["everyday"],
                "baselineSourceCount": 0, "sourceCount": 1,
                "frequency": 0,
            }

result = sorted(cards.values(), key=lambda card: (-card["frequency"], card["term"]))
if len(result) < 2500:
    raise RuntimeError(f"Too few everyday cards after filtering: {len(result)}")
meta = {
    "source": "FreeDict/WikDict français-中文 2025.11.23; frequency-screened with wordfreq 3.1.1",
    "license": "CC BY-SA 3.0 Unported",
    "uniqueCards": len(result),
    "groups": dict(Counter(card["group"] for card in result)),
    "topics": dict(Counter(card["topic"] for card in result)),
}
OUTPUT.write_text(
    "// Adapted from FreeDict/WikDict français-中文 2025.11.23, CC BY-SA 3.0. See everyday-attribution.html.\n"
    + "window.TEF_EVERYDAY_META = " + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n"
    + "window.TEF_EVERYDAY_CARDS = " + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)
print(f"Everyday cards: {len(result)}; groups: {meta['groups']}; filtered: {dict(reasons)}")
