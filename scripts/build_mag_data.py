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


def load_zh_names() -> dict[str, str]:
    src = I18N.read_text(encoding="utf-8")
    body = src[src.index("{"): src.rindex("}") + 1]
    data = json.loads(body)
    return {k: v["zh"] for k, v in data.items() if "zh" in v}


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

    first = parse_rows(section(raw, "First evolution Mags"), True)
    second = parse_rows(section(raw, "Second evolution Mags"), True)
    third = parse_rows(section(raw, "Third evolution Mags"), True)
    fourth = parse_rows(section(raw, "Fourth evolution Mags"), False)

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

        # stage 2 — "POW > Others" etc., keyed by the stage-1 mag it evolves from
        stage2 = []
        for stat in ("POW", "DEX", "MIND"):
            hit = next(n for n, r in second.items()
                       if f"{stat} > Others" in " ".join(r["cond_lines"])
                       and f"Evolves from {s1_name}" in " ".join(r["cond_lines"]))
            stage2.append(node(hit, zh, [f"{stat} 最大"], second[hit]))

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
        if cls == "FO":
            special = []
            for name in ("Andhaka", "Bana"):
                conds = [re.sub(r"^FO\s*", "", ln).strip()
                         for ln in third[name]["cond_lines"] if ln.startswith("FO")]
                conds = [re.sub(r"^\(All IDs?\)\s*", "", c) for c in conds]
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

        classes[cls] = {"label": label, "en": en, "stage1": stage1,
                        "stage2": stage2, "stage3": stage3, "stage4": stage4}

    data = {
        "meta": {"idGroups": ID_GROUPS, "idColors": ID_COLORS,
                 "pbNames": PB_NAMES, "effects": EFFECTS, "events": EVENTS},
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


if __name__ == "__main__":
    main()
