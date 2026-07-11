#!/usr/bin/env python3
"""Generate assets/js/mag-evolution.js from the Ephinea wiki.

The chart data used to live hand-maintained inside redraw_mag_charts.py, where
it had drifted from the wiki in ten distinct ways. It is now derived, so it
cannot drift again.

Sources
  evolution rules / PBs / triggers : wiki.pioneer2.net/w/Mags  (raw wikitext)
  Chinese mag names               : assets/js/i18n/items_i18n.js

The wiki's own trigger table has three columns (100 PB / 10% HP / Boss Room).
The death trigger is disabled in Blue Burst and is deliberately absent here.

Usage:  python3 scripts/build_mag_data.py [--offline path/to/mags.wiki]
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "js" / "mag-evolution.js"
I18N = ROOT / "assets" / "js" / "i18n" / "items_i18n.js"
WIKI_URL = "https://wiki.pioneer2.net/index.php?title=Mags&action=raw"
FEED_URL = "https://wiki.pioneer2.net/index.php?title=Template:MagFeedTable&action=raw"
FEED_PAGE_URL = "https://wiki.pioneer2.net/index.php?title=Mag_feeding_tables&action=raw"
SIM_OUT = ROOT / "assets" / "js" / "mag-sim-data.js"

EVENTS = ["100PB", "10%HP", "BOSS"]

ID_GROUPS = {
    "A": ["Viridia", "Skyly", "Purplenum", "Redria", "Yellowboze"],
    "B": ["Greenill", "Bluefull", "Pinkal", "Oran", "Whitill"],
    "1": ["Viridia", "Bluefull", "Redria", "Whitill"],
    "2": ["Greenill", "Purplenum", "Oran"],
    "3": ["Skyly", "Pinkal", "Yellowboze"],
}

ID_COLORS = {
    "Viridia": "#2e9e5b", "Greenill": "#7ed957", "Skyly": "#5bc8f5",
    "Bluefull": "#2f6fe0", "Purplenum": "#9b59d0", "Pinkal": "#f27fb8",
    "Redria": "#e04a4a", "Oran": "#f0902a", "Yellowboze": "#e8d44d",
    "Whitill": "#e8ecf2",
}

# Not present in items_i18n.js. Descriptive names, corroborated by both
# pso.ffsky.cn/mag6.htm and the labels on the original *-MAG.gif charts.
# (Their transliterations disagree with each other; the descriptions agree.)
PB_NAMES = {
    "Golla": "角鹿", "Pilla": "神像", "Estlla": "海豚",
    "Farlla": "海蛇", "Leilla": "女神", "Mylla & Youlla": "双子",
}

EFFECTS = {"Invincibility": "无敌", "Resta": "圣泉术", "S&D": "强攻·强体"}

CLASS_META = {
    "HU": ("战士", "Hunters"), "RA": ("枪手", "Rangers"), "FO": ("法师", "Forces"),
}

# Third-evolution rows carry a "PB Learned" column; fourth-evolution rows do
# not (a fourth evolution learns no new PB), so they have one cell fewer.
# `[[Sita]] ` carries a trailing space; Bhima's row spells one break `<bR>`.
def row_re(cells: int) -> re.Pattern:
    return re.compile(
        r"\n\|\[\[File:([A-Za-z&; ]+)\.png\|30px\|link=\1\]\]<br>\[\[\1\]\]\s*\n"
        + r"\|(.*?)\n" * cells
        + r"\|\[\[Mag feeding",
        re.S,
    )


def fetch_wikitext(offline: Path | None) -> str:
    if offline:
        return offline.read_text(encoding="utf-8")
    out = subprocess.run(
        ["curl", "-sL", "--max-time", "30", WIKI_URL],
        capture_output=True, check=True,
    ).stdout.decode("utf-8")
    if "Third evolution Mags" not in out:
        sys.exit("wiki fetch failed: unexpected content")
    return out


def fetch_raw(url: str) -> str:
    return subprocess.run(
        ["curl", "-sL", "--max-time", "30", url],
        capture_output=True, check=True,
    ).stdout.decode("utf-8")


FEED_ITEM_RE = re.compile(
    r"\{\{(?:Mate|Fluid|Item|Atomizer|Tool)\|([^}|]+)\}\}"    # item name
    r"(.*?)(?=\{\{(?:Mate|Fluid|Item|Atomizer|Tool)\||\Z)",   # cells until next row
    re.S,
)
FEED_CELL_RE = re.compile(r"\{\{!\}\}(?:[^{}\n]*?\{\{!\}\})?\s*(-?\d+)")


def parse_feed_tables(tpl: str) -> dict:
    """Template:MagFeedTable is one big {{#switch:{{{1}}} | N = <rows> }}.
    Each item row: a name cell {{X|Item}} then 6 numeric cells in order
    DEF, POW, DEX, MIND, Synchro, IQ. Negative values are written as the
    HTML entity &minus; (occasionally the raw − glyph), both normalised to
    a plain '-' before parsing."""
    text = tpl.replace("&minus;", "-").replace("−", "-")
    out: dict[str, dict] = {}
    # split the #switch into "| N =" branches
    branches = re.split(r"\n\|\s*(\d)\s*=", text)
    # branches[0] is the header before the first case; then (num, body) pairs
    for i in range(1, len(branches), 2):
        num, body = branches[i], branches[i + 1]
        rows: dict[str, list] = {}
        for m in FEED_ITEM_RE.finditer(body):
            name = m.group(1).strip()
            nums = FEED_CELL_RE.findall(m.group(2))
            vals = [int(n) for n in nums[:6]]
            if len(vals) == 6:
                rows[name] = vals
        if len(rows) == 11:
            out[num] = rows
    if len(out) != 8:
        sys.exit(f"parse_feed_tables: expected 8 tables, got {len(out)}")
    return out


def parse_mag_tables(page: str) -> dict:
    """Each ===Table N=== lists its stage(s) and the {{Mag|Name}} in each.
    A mag's own stage = the stage bullet it is listed under."""
    out: dict[str, dict] = {}
    for m in re.finditer(r"===Table (\d)===(.*?)(?=\n===|\Z)", page, re.S):
        tid, body = m.group(1), m.group(2)
        for line in body.splitlines():
            sm = re.search(r"Stage (\d)", line)
            if not sm:
                continue
            stage = int(sm.group(1))
            for name in re.findall(r"\{\{Mag\|(?:rare\|)?([^}|]+?)(?:\|nolink=1)?\}\}", line):
                out[name.strip()] = {"feedTableId": tid, "stage": stage}
    return out


def load_zh_names() -> dict[str, str]:
    src = I18N.read_text(encoding="utf-8")
    body = src[src.index("{"): src.rindex("}") + 1]
    data = json.loads(body)
    return {k: v["zh"] for k, v in data.items() if "zh" in v}


TIE_BREAK = re.compile(
    r"\{\{Mag\|(\w+)\}\} follows <code>\{\{(\w+)\}\} > Others</code>"
)


def mag_colors(raw: str) -> list[dict]:
    """The 30 in-game mag colours. A mag's colour is random / costume-based and
    constant across every evolution, so the chart offers them as a global tint
    rather than assigning one per species.

    The two colour tables use different cell separators — Original uses inline
    `||`, Ephinea-exclusive uses newline `|` — so parse each `|-` block by
    content: the hex from its `background:` swatch, and the one alphabetic cell
    that is the colour name.
    """
    out = []
    for section, exclusive in (("Original colors", False), ("Ephinea-exclusive colors", True)):
        body = section_between(raw, section)
        for row in body.split("\n|-"):
            m = re.search(r"background:(#[0-9A-Fa-f]{6})", row)
            if not m:
                continue
            hexval = m.group(1).upper()
            names = re.findall(r"(?:\|\||\n\|)\s*([A-Z][A-Za-z][A-Za-z ]*?)\s*(?=\|\||\n\||$)", row)
            name = next((n.strip() for n in names if not n.strip().startswith("#")), None)
            if not name:
                sys.exit(f"no name for colour {hexval} in {section}")
            out.append({"name": name, "hex": hexval, "exclusive": exclusive})
    if len(out) != 30:
        sys.exit(f"expected 30 mag colours, parsed {len(out)}")
    return out


def section_between(raw: str, title: str) -> str:
    start = raw.index(f"==={title}===")
    rest = raw[start + 3:]
    end = rest.find("\n==")
    return rest[:end if end != -1 else len(rest)]


def tie_breaks(raw: str) -> dict[str, str]:
    """When two stats tie for highest at Lv.35, the first-evolution form decides
    which one wins. Parsed from the prose so it stays honest."""
    found = {src: stat.upper() for src, stat in TIE_BREAK.findall(raw)}
    if len(found) != 3:
        sys.exit(f"expected 3 tie-break rules, parsed {found}")
    return found


def section(text: str, title: str) -> str:
    start = text.index(f"==={title}===")
    rest = text[start + 3:]
    end = rest.find("\n===")
    return rest[:end if end != -1 else len(rest)]


def norm_stats(s: str) -> str:
    s = re.sub(r"\{\{(POW|DEX|MIND|DEF)\}\}", lambda m: m.group(1).upper(), s, flags=re.I)
    s = re.sub(r'style="[^"]*"\|', "", s).replace("'''", "")
    return s


def parse_trigger(cell: str) -> dict | None:
    """`| -` (or empty) means the mag has no trigger for that event."""
    cell = cell.strip()
    if not cell or cell.startswith("-"):
        return None
    parts = [p.strip() for p in re.split(r"<br>", cell, flags=re.I)]
    effect = parts[1] if len(parts) > 1 else ""
    rate = parts[2].strip("()") if len(parts) > 2 else ""
    if effect not in EFFECTS:
        sys.exit(f"unknown trigger effect {effect!r} in cell {cell!r}")
    return {"effect": effect, "rate": rate.replace("-", "–")}


# Every condition line the wiki states must end up somewhere in the output.
# A parser that only recognises `HU {{TypeA}} ...` silently drops any branch
# written another way — which is exactly how the old chart lost Marica. Anything
# not matched here is a branch we would be dropping, so the build fails.
KNOWN_CONDS = [
    re.compile(p) for p in (
        r"^(HU|RA|FO) evolves Mag$",                    # Lv.10
        r"^(POW|DEX|MIND) > Others$",                   # Lv.35 stat
        r"^Evolves from (Varuna|Kalki|Vritra)$",        # Lv.35 source form
        r"^(HU|RA|FO) \{\{Type[AB]\}\} .+$",            # Lv.50 by ID group
        r"^(HU|RA|FO)$",                                # FO's all-ID rows wrap
        r"^\(All IDs?\) DEF ≥ 45, .+$",                 # Lv.50 FO special
        r"^(Male|Female) (HU|RA|FO) \{\{Type[123]\}\} .+$",  # Lv.100
    )
]


def audit_conds(rows: dict[str, dict], label: str) -> None:
    lost = [(mag, ln) for mag, rec in rows.items() for ln in rec["cond_lines"]
            if not any(p.match(ln) for p in KNOWN_CONDS)]
    if lost:
        for mag, ln in lost:
            print(f"  UNRECOGNISED {label} condition on {mag}: {ln!r}", file=sys.stderr)
        sys.exit(f"{label}: {len(lost)} condition line(s) would be dropped")


def parse_rows(text: str, has_pb: bool) -> dict[str, dict]:
    """Return {mag name: {cond_lines, pb, triggers}} for one evolution section."""
    out: dict[str, dict] = {}
    pattern = row_re(5 if has_pb else 4)
    for m in pattern.finditer(text):
        name, cond, *rest = m.groups()
        if has_pb:
            pb_cell, trig_cells = rest[0], tuple(rest[1:4])
        else:
            pb_cell, trig_cells = None, tuple(rest[0:3])
        triggers = {}
        for event, cell in zip(EVENTS, trig_cells):
            t = parse_trigger(cell)
            if t:
                triggers[event] = t
        pb = None
        if has_pb:
            pb = pb_cell.split("<br>")[-1].strip()
            if pb not in PB_NAMES:
                sys.exit(f"unknown PB {pb!r} for {name}")
        lines = [re.sub(r"\s+", " ", ln).strip()
                 for ln in norm_stats(cond).split("<br>") if ln.strip()]
        out[name] = {"cond_lines": lines, "pb": pb, "triggers": triggers}
    return out


STAT_ORDER = {"POW": 0, "DEX": 1, "MIND": 2}


def cond_rank(cond: str) -> tuple:
    """Rank a condition by the order its stats appear: POW>DEX≥MIND -> (0,1,2).

    Conditions containing '=' are tie-breaks (e.g. Kumara's 'POW = DEX > MIND'
    alongside its primary 'MIND ≥ POW ≥ DEX'). They must never decide a mag's
    position, or Kumara would sort to the top of FO's B column.
    """
    stats = tuple(STAT_ORDER[s] for s in re.findall(r"\b(POW|DEX|MIND)\b", cond))
    return ("=" in cond, stats)


def sort_conds(conds: list[str]) -> list[str]:
    return sorted(conds, key=cond_rank)


def rule_rows(col_a: list[dict], col_b: list[dict]) -> list[str]:
    """Order the Lv.50 rules so both ID columns can sit either side of a single
    shared rule column.

    Both columns always cover the *same* rule set — they differ only in how many
    mags they need to cover it (RA's Kama alone answers three rules, which the
    B column splits between Madhu and Varaha). Taking the order from column A,
    every mag in column B lands on a contiguous run of rows, so each card can
    span its rules with `grid-row: span N`. Assert both facts: if either breaks,
    the shared rule column would be a lie.
    """
    rules = [r for m in col_a for r in m["cond"]]
    if len(rules) != len(set(rules)):
        sys.exit("Lv.50: column A repeats a rule")
    if set(rules) != {r for m in col_b for r in m["cond"]}:
        only_a = sorted(set(rules) - {r for m in col_b for r in m["cond"]})
        only_b = sorted({r for m in col_b for r in m["cond"]} - set(rules))
        sys.exit(f"Lv.50: columns cover different rules — only A: {only_a}, only B: {only_b}")

    index = {r: i for i, r in enumerate(rules)}
    for side, col in (("A", col_a), ("B", col_b)):
        for m in col:
            rows = sorted(index[r] for r in m["cond"])
            if rows != list(range(rows[0], rows[0] + len(rows))):
                sys.exit(f"Lv.50 column {side}: {m['name']} spans non-contiguous rows {rows}")
            m["span"] = [rows[0], len(rows)]
    return rules


def node(name: str, zh: dict[str, str], conds: list[str], rec: dict, with_pb=True) -> dict:
    if name.lower() not in zh:
        sys.exit(f"no Chinese name for {name!r} in items_i18n.js")
    n = {"name": name, "zh": zh[name.lower()], "cond": conds}
    if with_pb:
        n["pb"] = rec["pb"]
    n["triggers"] = rec["triggers"]
    return n


def build() -> tuple[dict, set]:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", type=Path)
    args = ap.parse_args()

    raw = fetch_wikitext(args.offline)
    zh = load_zh_names()
    ties = tie_breaks(raw)

    first = parse_rows(section(raw, "First evolution Mags"), True)
    second = parse_rows(section(raw, "Second evolution Mags"), True)
    third = parse_rows(section(raw, "Third evolution Mags"), True)
    fourth = parse_rows(section(raw, "Fourth evolution Mags"), False)

    for label, rows in (("Lv.10", first), ("Lv.35", second),
                        ("Lv.50", third), ("Lv.100", fourth)):
        audit_conds(rows, label)

    # ---- ground truth extracted straight from the wikitext, for the self-check
    truth: set[tuple[str, str, str, str]] = set()
    for name, rec in third.items():
        for ln in rec["cond_lines"]:
            m = re.match(r"(HU|RA|FO) \{\{Type([AB])\}\} (.*)", ln)
            if m:
                truth.add((m.group(1), m.group(2), m.group(3).strip(), name))

    classes: dict[str, dict] = {}
    for cls, (label, en) in CLASS_META.items():
        # stage 1
        s1_name = next(n for n, r in first.items()
                       if any(ln.startswith(cls) for ln in r["cond_lines"]))
        stage1 = node(s1_name, zh, [f"{cls} 职业"], first[s1_name])

        # stage 2 — "POW > Others" etc., keyed by the stage-1 mag it evolves from.
        # Class is irrelevant at Lv.35; the source mag and highest stat decide.
        stage2 = []
        for stat in ("POW", "DEX", "MIND"):
            hit = next(n for n, r in second.items()
                       if f"{stat} > Others" in " ".join(r["cond_lines"])
                       and f"Evolves from {s1_name}" in " ".join(r["cond_lines"]))
            n = node(hit, zh, [f"{stat} 最大"], second[hit])
            n["from"] = s1_name
            stage2.append(n)

        # stage 3 — group A / B, plus FO's all-ID DEF>=45 branch
        stage3: dict = {"special": None, "A": [], "B": []}
        for grp in ("A", "B"):
            buckets: dict[str, list[str]] = {}
            for c, g, rule, name in sorted(truth):
                if c == cls and g == grp:
                    buckets.setdefault(name, []).append(rule)
            # A mag satisfying several conditions gets one card listing them all
            # (RA's Kama covers three). Order cards by stat priority, the way
            # the original charts read: POW-first, then DEX-first, then MIND.
            ordered = sorted(buckets.items(), key=lambda kv: cond_rank(sort_conds(kv[1])[0]))
            stage3[grp] = [node(n, zh, sort_conds(c), third[n]) for n, c in ordered]
        stage3["rules"] = rule_rows(stage3["A"], stage3["B"])
        if cls == "FO":
            # These rows wrap as  '''FO'''<br>(All IDs) DEF >= 45, POW > Others
            # so the class sits on its own line and the rule on the next. Match
            # the rule, not the class. The DEF >= 45 part is hoisted into the
            # band heading, so each card carries only its distinguishing clause.
            special = []
            for name in ("Andhaka", "Bana"):
                conds = [ln for ln in third[name]["cond_lines"] if "DEF ≥ 45" in ln]
                conds = [re.sub(r"^\(All IDs?\)\s*", "", c) for c in conds]
                conds = [re.sub(r"^DEF ≥ 45,\s*", "", c) for c in conds]
                if not conds:
                    sys.exit(f"no DEF>=45 condition parsed for {name}")
                special.append(node(name, zh, conds, third[name]))
            stage3["special"] = special

        # stage 4 — formula x id-group -> male / female
        stage4 = []
        for grp, formula in (("1", "DEF + DEX = POW + MIND"),
                             ("2", "DEF + MIND = POW + DEX"),
                             ("3", "DEF + POW = DEX + MIND")):
            row = {"formula": formula, "group": grp}
            for sex, zh_sex in (("Male", "male"), ("Female", "female")):
                hit = next(
                    n for n, r in fourth.items()
                    if any(re.match(rf"{sex} {cls} \{{\{{Type{grp}\}}\}}", ln)
                           for ln in r["cond_lines"])
                )
                row[zh_sex] = node(hit, zh, [f"{'男性' if sex == 'Male' else '女性'} {cls}"],
                                   fourth[hit], with_pb=False)
            stage4.append(row)

        if s1_name not in ties:
            sys.exit(f"no tie-break rule for {s1_name}")
        classes[cls] = {"label": label, "en": en, "tieBreak": ties[s1_name],
                        "stage1": stage1, "stage2": stage2,
                        "stage3": stage3, "stage4": stage4}

    data = {
        "meta": {"idGroups": ID_GROUPS, "idColors": ID_COLORS,
                 "pbNames": PB_NAMES, "effects": EFFECTS, "events": EVENTS,
                 "colors": mag_colors(raw)},
        "classes": classes,
    }
    return data, truth


def self_check(data: dict, truth: set) -> None:
    """Round-trip: the emitted structure must reproduce the wikitext exactly."""
    got = set()
    for cls, c in data["classes"].items():
        for grp in ("A", "B"):
            for m in c["stage3"][grp]:
                for rule in m["cond"]:
                    got.add((cls, grp, rule, m["name"]))
    missing, extra = truth - got, got - truth
    for t in sorted(missing):
        print(f"  MISSING {t}", file=sys.stderr)
    for t in sorted(extra):
        print(f"  EXTRA   {t}", file=sys.stderr)
    if missing or extra:
        sys.exit("self-check FAILED: emitted data does not match the wikitext")
    print(f"self-check OK — {len(truth)} Lv.50 rules round-trip")


def main() -> None:
    data, truth = build()
    self_check(data, truth)

    blob = json.dumps(data, ensure_ascii=False, indent=2)
    OUT.write_text(
        "/* Generated by scripts/build_mag_data.py from wiki.pioneer2.net/w/Mags\n"
        " * Chinese names sourced from assets/js/i18n/items_i18n.js\n"
        " * Regenerate:  python3 scripts/build_mag_data.py\n"
        " * Do not edit by hand. */\n"
        f"window.MAG_EVOLUTION = {blob};\n",
        encoding="utf-8",
    )
    n = sum(len(c["stage3"]["A"]) + len(c["stage3"]["B"]) for c in data["classes"].values())
    print(f"wrote {OUT.relative_to(ROOT)} — {n} Lv.50 mags across 3 classes")

    # TODO(mag-sim task 3+): grows beyond feedTables/mags as later tasks land.
    feed = parse_feed_tables(fetch_raw(FEED_URL))
    mags = parse_mag_tables(fetch_raw(FEED_PAGE_URL))
    sim = {"feedTables": feed, "mags": mags}
    SIM_OUT.write_text(
        "/* Generated by scripts/build_mag_data.py — do not edit by hand. */\n"
        "window.MAG_SIM = " + json.dumps(sim, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {SIM_OUT.relative_to(ROOT)} — {len(feed)} feed tables, {len(mags)} mags")


if __name__ == "__main__":
    main()
