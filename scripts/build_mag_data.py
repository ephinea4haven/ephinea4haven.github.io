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
import itertools
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

# --- simulator constants (Task 5) -------------------------------------------
# Feeding-item gil costs and canonical feed order, from the Ephinea shop /
# mag feeding tables. A freshly-bought Mag always starts DEF 5 / Synchro 20,
# every other stat 0.
COSTS = {"Monomate": 50, "Dimate": 300, "Trimate": 2000, "Monofluid": 100,
         "Difluid": 500, "Trifluid": 3600, "Antidote": 60, "Antiparalysis": 60,
         "Sol Atomizer": 300, "Moon Atomizer": 500, "Star Atomizer": 5000}
ITEM_ORDER = ["Monomate", "Dimate", "Trimate", "Monofluid", "Difluid", "Trifluid",
              "Antidote", "Antiparalysis", "Sol Atomizer", "Moon Atomizer",
              "Star Atomizer"]
FRESH_MAG = {"magId": "Mag", "def": 5, "pow": 0, "dex": 0, "mind": 0,
             "synchro": 20, "iq": 0}

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


# --- stage4 reference chart + mag cells (Task 4) ---------------------------
# The three stat-balance formulas, in the column order the reference chart
# prints them. A group's single fourth-evolution mag sits under exactly the
# column matching its Section ID Type (Type1→[1], Type2→[2], Type3→[0]); this
# is the same mapping build()'s stage4 uses.
FORMULAS = ["DEF+POW=DEX+MIND", "DEF+DEX=POW+MIND", "DEF+MIND=POW+DEX"]

# Cells whose result can itself re-evolve via another cell (the game's
# MagCellsExclusion whitelist — e.g. Devil's Wing → Devil's Tail with a second
# Heart of Devil, or the System mags' Mark III → … → Dreamcast progression).
RE_EVO_WHITELIST = {"Heart of Devil", "Kit of Master System", "Kit of Genesis",
                    "Kit of Sega Saturn", "Kit of Dreamcast", "Tablet", "Amitie's Memo"}

_CLASS_KEY = {"Hunter": "HU", "Ranger": "RA", "Force": "FO"}
_GENDER_KEY = {"Male": "M", "Female": "F"}


def section_slice(text: str, title: str) -> str:
    """Slice a `==== title ====` (any level) section up to the next heading.

    Unlike section()/section_between() this matches the heading *line*, so a
    bare mention of the title in prose (e.g. the '[[#List of Mag cells|…]]'
    link) is not mistaken for the section start."""
    m = re.search(rf"^=+\s*{re.escape(title)}\s*=+\s*$", text, re.M)
    if not m:
        sys.exit(f"section_slice: heading {title!r} not found")
    start = m.end()
    nxt = re.search(r"^==+", text[start:], re.M)
    return text[start: start + nxt.start() if nxt else len(text)]


def _split_cells(rowtext: str) -> list[str]:
    """Split one wikitable row (text between `|-` markers) into its `!`/`|`
    cells. Every cell in the tables we parse begins its own line, so a line
    opening with `!` or `|` starts a new cell and following lines belong to it."""
    cells: list[str] = []
    cur: str | None = None
    for line in rowtext.split("\n"):
        s = line.lstrip()
        if s[:1] in ("!", "|") and not s.startswith("|-") and not s.startswith("|}"):
            if cur is not None:
                cells.append(cur)
            cur = line
        elif cur is not None:
            cur += "\n" + line
    if cur is not None:
        cells.append(cur)
    return cells


def _cell(cell: str) -> tuple[str, int, str]:
    """Return (marker, colspan, content) for a raw cell string.

    Strips a leading `attr="v" …|` prefix (colspan/rowspan/class/style) — those
    attributes always quote their values, so `{{Mag|rare|X}}` and a bare `-`,
    which carry no `key="v"|`, are left intact as content."""
    body = cell.lstrip()
    marker = body[0]
    body = body[1:]
    colspan = 1
    m = re.match(r'\s*((?:[\w-]+\s*=\s*"[^"]*"\s*)+)\|(.*)$', body, re.S)
    if m:
        attrs, body = m.group(1), m.group(2)
        cm = re.search(r'colspan\s*=\s*"(\d+)"', attrs)
        if cm:
            colspan = int(cm.group(1))
    return marker, colspan, body.strip()


def _mag_name(params: str) -> str:
    """Canonical mag name from the inside of a `{{Mag|…}}` template. Drops the
    rare/attributes prefix and any `nolink=…`, and prefers the display override
    of a `[[Page|Display]]`-style call (so `Rappy (Mag)|Rappy` → 'Rappy')."""
    parts = [p.strip() for p in params.split("|")]
    parts = [p for p in parts if p and not p.startswith("nolink")]
    if parts and parts[0] in ("rare", "attributes"):
        parts = parts[1:]
    return parts[-1] if parts else ""


def parse_stage4_chart(page: str) -> dict:
    """Parse the '==== Fourth evolution reference chart ====' wikitable into
    stage4[class][gender][TypeN][formula] = magName | None.

    The table is a colspan/rowspan grid of 5 columns (Character, Section ID,
    then the 3 formula columns). Each Character header spans 3 rows (its 3
    Types); Type2/Type3 rows inherit the Character via that rowspan, so we only
    map the `|` *data* cells to formulas and carry (class, gender) forward. A
    `| -` is a null formula; `|colspan="2"| -` is two consecutive nulls."""
    body = section_slice(page, "Fourth evolution reference chart")
    table = body[body.index("{|"): body.index("|}")]
    out: dict = {}
    cls = gender = None
    for rowtext in table.split("\n|-"):
        row_type = None
        data: list[tuple[int, str | None]] = []
        for cell in _split_cells(rowtext):
            if not cell.lstrip() or cell.lstrip()[0] not in "!|":
                continue
            marker, colspan, content = _cell(cell)
            if marker == "!":
                cm = re.match(r"(Hunter|Ranger|Force),\s*(?:<br>)?\s*(Male|Female)",
                              content)
                tm = re.match(r"\{\{Type([123])\}\}", content)
                if cm:
                    cls, gender = _CLASS_KEY[cm.group(1)], _GENDER_KEY[cm.group(2)]
                elif tm:
                    row_type = tm.group(1)
                # other `!` cells (Character/Section ID/formula headers) skipped
            else:
                mm = re.search(r"\{\{Mag\|([^{}]*)\}\}", content)
                data.append((colspan, _mag_name(mm.group(1)) if mm else None))
        if row_type is None:
            continue
        slots: list[str | None] = []
        for span, val in data:
            slots.extend([val] * span)
        if len(slots) != 3:
            sys.exit(f"stage4 {cls}/{gender}/Type{row_type}: "
                     f"got {len(slots)} formula cells, expected 3")
        out.setdefault(cls, {}).setdefault(gender, {})[f"Type{row_type}"] = {
            FORMULAS[i]: slots[i] for i in range(3)
        }
    groups = [(c, g) for c in out for g in out[c]]
    if len(groups) != 6 or any(len(out[c][g]) != 3 for c, g in groups):
        sys.exit(f"stage4: expected 6 class/gender groups of 3 Types, got {out.keys()}")
    return out


def _parse_req(cond: str) -> dict:
    """Structure one 'Evolution Conditions' cell: min character/mag level,
    the source mag species it must evolve from, and any Section ID (Type A/B)
    restriction, plus a readable `raw` fallback."""
    req: dict = {}
    lm = re.search(r"Level (\d+)\+", cond)
    if lm:
        req["minLevel"] = int(lm.group(1))
    mags = [_mag_name(m.group(1)) for m in re.finditer(r"\{\{Mag\|([^{}]*)\}\}", cond)]
    if mags:
        req["requiresMag"] = mags if len(mags) > 1 else mags[0]
    rm = re.search(r"\{\{Type([AB])\}\}", cond)
    if rm:
        req["race"] = rm.group(1)
    raw = re.sub(r"\{\{Mag\|([^{}]*)\}\}", lambda m: _mag_name(m.group(1)), cond)
    raw = re.sub(r"\{\{Type([AB])\}\}", r"Type\1", raw)
    raw = re.sub(r"\s+", " ", raw.replace("<br>", " ").replace("'''", "")).strip()
    req["raw"] = raw
    return req


def parse_mag_cells(page: str) -> dict:
    """'====List of Mag cells====' (cell → target mag(s)) merged with the
    per-mag requirements from '====List of cell Mags===='."""
    # requirements keyed by the (display) mag name
    reqs: dict[str, dict] = {}
    for block in section_slice(page, "List of cell Mags").split("\n|-"):
        fm = re.search(r"\[\[File:[^\]]*\]\]\s*<br>\s*\[\[([^\]]+)\]\]", block)
        if not fm:
            continue
        mag = fm.group(1).split("|")[-1].strip()
        cells = [_cell(c)[2] for c in _split_cells(block)]
        if len(cells) >= 3:
            reqs[mag] = _parse_req(cells[2])

    out: dict[str, dict] = {}
    for block in section_slice(page, "List of Mag cells").split("\n|-"):
        tm = re.search(r"\{\{Tool\|rare\|([^}]+)\}\}", block)
        if not tm:
            continue
        cell = tm.group(1).strip()
        assoc = block[tm.end():]
        targets = [_mag_name(m.group(1))
                   for m in re.finditer(r"\{\{Mag\|([^{}]*)\}\}", assoc)]
        if not targets:
            sys.exit(f"mag cell {cell!r}: no associated mag parsed")
        out[cell] = {
            "target": targets if len(targets) > 1 else targets[0],
            "requires": {t: reqs.get(t, {}) for t in targets},
            "reEvoWhitelist": cell in RE_EVO_WHITELIST,
        }
    return out


def add_cell_mags(mags: dict, magcells: dict) -> None:
    """Cell mags are never named on the feeding-tables page, so mags has no
    entry for them. Every cell mag uses feeding table 7 and is a fourth
    evolution, so register any missing target under {feedTableId:'7', stage:4}
    (without clobbering a mag that is already listed)."""
    for info in magcells.values():
        tgt = info["target"]
        for t in (tgt if isinstance(tgt, list) else [tgt]):
            mags.setdefault(t, {"feedTableId": "7", "stage": 4})


def sim_id_groups(id_groups: dict) -> dict:
    """Reshape ID_GROUPS (meta.idGroups, keyed 'A'/'B'/'1'/'2'/'3') into the
    simulator's naming, keyed 'A'/'B'/'Type1'/'Type2'/'Type3' — matching the
    TypeN keys already used throughout evolution['stage4']."""
    return {
        "A": id_groups["A"], "B": id_groups["B"],
        "Type1": id_groups["1"], "Type2": id_groups["2"], "Type3": id_groups["3"],
    }


def audit_sim(sim: dict) -> None:
    """Fail the build loudly if the structured sim data has gaps.

    parse_mag_tables() and parse_mag_cells() have no fail-loud count guards of
    their own (unlike parse_feed_tables()/parse_stage4_chart()), so a wiki
    markup change that silently drops rows would otherwise pass through
    unnoticed. This is the safety net that catches that: every feed table
    reference, and every evolution/mag-cell target, must resolve to a mag
    actually present in sim['mags']; and the mags/magCells dicts themselves
    must not have silently shrunk below a sane floor.
    """
    if len(sim["feedTables"]) != 8:
        sys.exit(f"audit_sim: expected 8 feed tables, got {len(sim['feedTables'])}")

    known = set(sim["mags"])
    if len(known) < 70:
        sys.exit(f"audit_sim: only {len(known)} mags parsed (expected ~80+) "
                 "— parse_mag_tables may have silently dropped rows")
    if "Mag" not in known:
        sys.exit("audit_sim: base 'Mag' missing from mags")
    if len(sim["magCells"]) < 25:
        sys.exit(f"audit_sim: only {len(sim['magCells'])} mag cells parsed "
                 "(expected ~30+) — parse_mag_cells may have silently dropped rows")

    for mag, info in sim["mags"].items():
        tid = info["feedTableId"]
        if tid not in sim["feedTables"]:
            sys.exit(f"audit_sim: {mag} references missing feed table {tid}")

    ev = sim["evolution"]

    # stage1: class -> mag
    for c, tgt in ev["stage1"].items():
        if tgt not in known:
            sys.exit(f"audit_sim: stage1 {c}->{tgt} unknown mag")

    # stage2: source mag -> stat -> mag
    for src, by_stat in ev["stage2"].items():
        if src not in known:
            sys.exit(f"audit_sim: stage2 source {src!r} unknown mag")
        for stat, tgt in by_stat.items():
            if tgt not in known:
                sys.exit(f"audit_sim: stage2 {src}.{stat}->{tgt} unknown mag")

    # stage3: source mag -> perm -> {A, B} -> mag
    for src, by_perm in ev["stage3"].items():
        if src not in known:
            sys.exit(f"audit_sim: stage3 source {src!r} unknown mag")
        for perm, groups in by_perm.items():
            for grp, tgt in groups.items():
                if tgt not in known:
                    sys.exit(f"audit_sim: stage3 {src}.{perm}.{grp}->{tgt} unknown mag")

    # stage4: class -> gender -> TypeN -> formula -> mag | null
    for cls, by_gender in ev["stage4"].items():
        for gender, by_type in by_gender.items():
            for typ, by_formula in by_type.items():
                for formula, tgt in by_formula.items():
                    if tgt is not None and tgt not in known:
                        sys.exit(f"audit_sim: stage4 {cls}.{gender}.{typ}."
                                 f"{formula}->{tgt} unknown mag")

    # tieBreak: class -> stat name (sanity-check the value, not a mag ref)
    for c, stat in ev["tieBreak"].items():
        if stat not in ("POW", "DEX", "MIND"):
            sys.exit(f"audit_sim: tieBreak {c}->{stat!r} not a known stat")

    # stage3Ties: class -> {eq, lt, A, B} (A/B are mag refs)
    for c, tie in ev["stage3Ties"].items():
        for grp in ("A", "B"):
            if tie[grp] not in known:
                sys.exit(f"audit_sim: stage3Ties {c}.{grp}->{tie[grp]} unknown mag")

    # stage3SpecialFO: {minDef, powMax, other} (powMax/other are mag refs)
    for key in ("powMax", "other"):
        tgt = ev["stage3SpecialFO"][key]
        if tgt not in known:
            sys.exit(f"audit_sim: stage3SpecialFO.{key}->{tgt} unknown mag")

    # magCells: cell -> {target: mag | [mag, ...], requires: {mag: {...}}}
    for cell, info in sim["magCells"].items():
        targets = info["target"]
        targets = targets if isinstance(targets, list) else [targets]
        for tgt in targets:
            if tgt not in known:
                sys.exit(f"audit_sim: mag cell {cell!r} target {tgt} unknown mag")
        for req_mag, req in info["requires"].items():
            rm = req.get("requiresMag")
            if rm is None:
                continue
            for r in (rm if isinstance(rm, list) else [rm]):
                if r not in known:
                    sys.exit(f"audit_sim: mag cell {cell!r} requires[{req_mag!r}]"
                             f".requiresMag {r} unknown mag")


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


# --- machine-evaluable evolution predicates (Task 3) -----------------------
# stage1/stage2 are fixed lineage facts; they are cross-checked against the
# in-memory MAG_EVOLUTION structure in build_evolution_std so they cannot drift.
STAGE1 = {"HU": "Varuna", "RA": "Kalki", "FO": "Vritra"}
STAGE2 = {
    "Varuna": {"POW": "Rudra", "DEX": "Marutah", "MIND": "Vayu"},
    "Kalki":  {"POW": "Surya", "DEX": "Mitra",   "MIND": "Tapas"},
    "Vritra": {"POW": "Sumba", "DEX": "Ashvinau", "MIND": "Namuci"},
}

# The 6 strict orderings of the three stats, high -> low.
ALL_PERMS = [">".join(p) for p in itertools.permutations(("POW", "DEX", "MIND"))]


def _eval_cond(cond: str, rank: dict) -> bool:
    """Does a strict stat ordering satisfy one Lv.50 rule string?

    `rank` maps each stat to a distinct value (bigger = higher). A rule is a
    chain like 'POW ≥ DEX ≥ MIND' or 'DEX = MIND > POW'. For a *strict* ordering
    (all ranks distinct) '≥' coincides with '>' and '=' can never hold, so the
    '=' tie-rules never fire on their own — they only ever share a mag with an
    accompanying '≥'/'>' rule, which is what keeps the 6-way partition clean.
    """
    tok = cond.split()
    for i in range(0, len(tok) - 2, 2):
        left, op, right = tok[i], tok[i + 1], tok[i + 2]
        lv, rv = rank[left], rank[right]
        ok = (lv > rv) if op == ">" else (lv >= rv) if op == "≥" else \
             (lv == rv) if op == "=" else None
        if ok is None:
            sys.exit(f"perms_from_cond: unknown operator {op!r} in {cond!r}")
        if not ok:
            return False
    return True


def perms_from_cond(conds: list[str]) -> list[str]:
    """Expand a mag's Lv.50 conditions into the strict stat orderings it wins.

    Returns canonical perm keys ('POW>DEX>MIND' etc.) — every ordering for which
    at least one of `conds` holds."""
    out = []
    for perm in ALL_PERMS:
        stats = perm.split(">")
        rank = {s: len(stats) - i for i, s in enumerate(stats)}
        if any(_eval_cond(c, rank) for c in conds):
            out.append(perm)
    return out


def build_evolution_std(classes: dict) -> dict:
    """Transform the in-memory MAG_EVOLUTION classes into machine keys a
    simulator can execute: stage1/stage2 lineage maps and a stage3 lookup of
    `{firstEvoMag: {perm: {"A": name, "B": name}}}` over the 6 stat orderings,
    plus the per-class tie-break stat. Fails loudly if any of the 6 perms is
    left uncovered or claimed by two mags in the same ID group."""
    stage3: dict = {}
    for c in ("HU", "RA", "FO"):
        s3 = classes[c]["stage3"]
        first = STAGE1[c]
        # cross-check the fixed lineage facts against the derived structure
        if classes[c]["stage1"]["name"] != first:
            sys.exit(f"stage1 mismatch for {c}: {classes[c]['stage1']['name']} != {first}")
        derived2 = {m["cond"][0].split()[0]: m["name"] for m in classes[c]["stage2"]}
        if derived2 != STAGE2[first]:
            sys.exit(f"stage2 mismatch for {first}: {derived2} != {STAGE2[first]}")

        lineage: dict = {}
        for grp in ("A", "B"):
            for entry in s3[grp]:
                for perm in perms_from_cond(entry["cond"]):
                    slot = lineage.setdefault(perm, {})
                    if grp in slot:
                        sys.exit(f"stage3 {first} {perm} group {grp}: "
                                 f"{slot[grp]} and {entry['name']} both claim it")
                    slot[grp] = entry["name"]
        for perm in ALL_PERMS:
            slot = lineage.get(perm)
            if not slot or "A" not in slot or "B" not in slot:
                sys.exit(f"stage3 {first} {perm}: incomplete mapping {slot}")
        if len(lineage) != 6:
            sys.exit(f"stage3 {first}: expected 6 perms, got {len(lineage)}")
        stage3[first] = lineage

    return {
        "stage1": STAGE1,
        "stage2": STAGE2,
        "stage3": stage3,
        "tieBreak": {c: classes[c]["tieBreak"] for c in ("HU", "RA", "FO")},
    }


TIE_COND_RE = re.compile(r"^(POW|DEX|MIND) = (POW|DEX|MIND) > (POW|DEX|MIND)$")


def build_stage3_extras(classes: dict) -> dict:
    """Derive the two stage3 mechanics build_evolution_std() deliberately
    drops: the exact-tie rule (one per lineage, the single `=`-cond shared by
    an A mag and a B mag) and FO's DEF>=45 special override.

    Both are read straight from the in-memory `classes[C].stage3` structure
    (same data as mag-evolution.js), not re-derived from wikitext, and each
    is assert-checked against the shape the wiki actually encodes so a future
    wiki change fails loudly here rather than silently drifting."""
    ties: dict = {}
    for c in ("HU", "RA", "FO"):
        s3 = classes[c]["stage3"]
        found: list[tuple[str, str, str]] = []  # (group, mag name, cond)
        for grp in ("A", "B"):
            for entry in s3[grp]:
                for cond in entry["cond"]:
                    if "=" in cond:
                        found.append((grp, entry["name"], cond))
        conds = {cond for _, _, cond in found}
        if len(conds) != 1:
            sys.exit(f"build_stage3_extras: expected exactly one '=' cond for "
                     f"{c}, got {conds}")
        cond = next(iter(conds))
        m = TIE_COND_RE.match(cond)
        if not m:
            sys.exit(f"build_stage3_extras: unrecognised tie cond {cond!r} for {c}")
        s1, s2, lt = m.group(1), m.group(2), m.group(3)
        by_grp = {grp: name for grp, name, _ in found}
        if set(by_grp) != {"A", "B"}:
            sys.exit(f"build_stage3_extras: tie cond {cond!r} for {c} not "
                     f"carried by both A and B groups, got {by_grp}")
        ties[c] = {"eq": [s1, s2], "lt": lt, "A": by_grp["A"], "B": by_grp["B"]}

    special = classes["FO"]["stage3"]["special"]
    if not special or len(special) != 2:
        sys.exit(f"build_stage3_extras: expected 2-entry FO stage3 special, "
                 f"got {special}")
    names = {entry["name"] for entry in special}
    if names != {"Andhaka", "Bana"}:
        sys.exit(f"build_stage3_extras: expected FO special {{Andhaka, Bana}}, "
                 f"got {names}")
    andhaka = next(e for e in special if e["name"] == "Andhaka")
    if andhaka["cond"] != ["POW > Others"]:
        sys.exit(f"build_stage3_extras: unexpected Andhaka special cond "
                 f"{andhaka['cond']}")
    special_fo = {"minDef": 45, "powMax": "Andhaka", "other": "Bana"}

    return {"stage3Ties": ties, "stage3SpecialFO": special_fo}


def build() -> tuple[dict, set, str]:
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
    return data, truth, raw


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
    data, truth, raw = build()
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

    feed = parse_feed_tables(fetch_raw(FEED_URL))
    mags = parse_mag_tables(fetch_raw(FEED_PAGE_URL))
    magcells = parse_mag_cells(raw)
    add_cell_mags(mags, magcells)  # register cell targets on feeding table 7
    evolution = build_evolution_std(data["classes"])
    evolution["stage4"] = parse_stage4_chart(raw)
    evolution.update(build_stage3_extras(data["classes"]))
    sim = {"feedTables": feed, "mags": mags, "evolution": evolution, "magCells": magcells}
    sim.update(costs=COSTS, itemOrder=ITEM_ORDER, freshMag=FRESH_MAG,
               idGroups=sim_id_groups(data["meta"]["idGroups"]))
    audit_sim(sim)

    sim_blob = json.dumps(sim, ensure_ascii=False, indent=2)
    SIM_OUT.write_text(
        "/* Generated by scripts/build_mag_data.py from wiki.pioneer2.net/w/Mags\n"
        " * and Template:MagFeedTable / Mag_feeding_tables.\n"
        " * Regenerate:  python3 scripts/build_mag_data.py\n"
        " * Do not edit by hand. */\n"
        f"window.MAG_SIM = {sim_blob};\n",
        encoding="utf-8",
    )
    print(f"wrote {SIM_OUT.relative_to(ROOT)} — {len(feed)} feed tables, {len(mags)} mags")


if __name__ == "__main__":
    main()
