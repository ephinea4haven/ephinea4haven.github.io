import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


S = 2
W = 1180
FONT_REG = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
MAG_IMAGE_DIR = Path("assets/img/mag/wiki")
MAG_IMAGE_ALIASES = {"Bhairava": "Bhirava", "Lv.35": "Mag"}
MAG_IMAGE_CACHE = {}
SURFACE = None

NEUTRAL = {
    "bg": "#f8fafc",
    "surface": "#ffffff",
    "surface_alt": "#f1f5f9",
    "border": "#d9e2ec",
    "border_soft": "#e5edf5",
    "shadow": "#e3eaf2",
    "text": "#0f172a",
    "muted": "#475569",
    "faint": "#64748b",
}

ACCENT_SOFT = {
    "#b45309": "#fff7ed",
    "#0f766e": "#ecfdf5",
    "#6d28d9": "#f5f3ff",
}

ID_GROUPS = {
    "A": ("A 组", "Viridia · Skyly · Purplenum", "Redria · Yellowboze"),
    "B": ("B 组", "Greenill · Bluefull · Pinkal", "Oran · Whitill"),
    "I": ("ID 组 1", "Viridia · Bluefull", "Redria · Whitill"),
    "II": ("ID 组 2", "Greenill · Purplenum · Oran", ""),
    "III": ("ID 组 3", "Skyly · Pinkal · Yellowboze", ""),
}


def f(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size * S)


def p(v):
    return int(v * S)


def rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(tuple(p(v) for v in box), radius=p(radius), fill=fill, outline=outline, width=p(width))


def soft_card(draw, box, radius=12, fill="#ffffff", outline="#e2e8f0"):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle((p(x1 + 1), p(y1 + 3), p(x2 + 1), p(y2 + 3)), radius=p(radius), fill=NEUTRAL["shadow"])
    rect(draw, box, radius, fill, outline, 1)


def text(draw, xy, value, size=18, fill="#172033", bold=False, anchor=None):
    draw.text((p(xy[0]), p(xy[1])), value, font=f(size, bold), fill=fill, anchor=anchor)


def line(draw, pts, fill="#b42318", width=2):
    draw.line([(p(x), p(y)) for x, y in pts], fill=fill, width=p(width), joint="curve")


def arrow(draw, start, end, fill="#b42318"):
    line(draw, [start, end], fill, 3)
    sx, sy = start
    ex, ey = end
    dx, dy = ex - sx, ey - sy
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    tip = (p(ex), p(ey))
    left = (p(ex - ux * 13 + px * 7), p(ey - uy * 13 + py * 7))
    right = (p(ex - ux * 13 - px * 7), p(ey - uy * 13 - py * 7))
    draw.polygon([tip, left, right], fill=fill)


def wrap(draw, value, font, width):
    lines, line = [], ""
    for ch in value:
        candidate = line + ch
        if draw.textbbox((0, 0), candidate, font=font)[2] <= p(width) or not line:
            line = candidate
        else:
            lines.append(line)
            line = ch
    if line:
        lines.append(line)
    return lines[:3]


def pretty_rule(value):
    value = value.replace(" and ", " 且 ").replace(" or ", " 或 ")
    value = re.sub(r"\s*(>=|=|>)\s*", r" \1 ", value)
    return re.sub(r"\s+", " ", value).strip()


PB = {
    "Golla": ("G", "#059669"),
    "Pilla": ("P", "#6d28d9"),
    "Estlla": ("E", "#2563eb"),
    "Farlla": ("F", "#d97706"),
    "M&Y": ("M", "#be123c"),
    "Leilla": ("L", "#0891b2"),
}

TRIGGER = {
    "BP100": ("100", "#1f2937"),
    "濒死": ("HP", "#14b8a6"),
    "死亡": ("KO", "#dc2626"),
    "BOSS": ("王", "#c2410c"),
}


def badge(draw, x, y, label, palette, w=42):
    value, color = palette[label]
    rect(draw, (x, y, x + w, y + 26), 13, color)
    text(draw, (x + w / 2, y + 13), value, 12, "#fff", True, "mm")


def image_key(title):
    key = title.split("|")[-1].strip()
    return MAG_IMAGE_ALIASES.get(key, key)


def mag_asset(name):
    path = MAG_IMAGE_DIR / f"{name}.png"
    if not path.exists():
        return None
    if name not in MAG_IMAGE_CACHE:
        image = Image.open(path).convert("RGBA")
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if bbox:
            image = image.crop(bbox)
        MAG_IMAGE_CACHE[name] = image
    return MAG_IMAGE_CACHE[name]


def mag_icon(draw, x, y, accent, index=0, name=None, radius=28):
    cx, cy = p(x), p(y)
    draw.ellipse((cx - p(radius), cy - p(radius), cx + p(radius), cy + p(radius)), fill=ACCENT_SOFT.get(accent, NEUTRAL["surface_alt"]), outline=accent, width=p(2))
    asset = mag_asset(name) if name else None
    if asset is not None and SURFACE is not None:
        icon = asset.copy()
        icon.thumbnail((p(radius * 1.8), p(radius * 1.8)), Image.Resampling.LANCZOS)
        SURFACE.paste(icon, (cx - icon.width // 2, cy - icon.height // 2), icon)
        return
    r = p(18)
    wing = p(16)
    alt = ["#dbeafe", "#ede9fe", "#fee2e2", "#dcfce7", "#fef3c7"][index % 5]
    draw.polygon([(cx - r, cy), (cx - r - wing, cy - p(12)), (cx - r - p(4), cy + p(14))], fill=alt, outline=accent)
    draw.polygon([(cx + r, cy), (cx + r + wing, cy - p(12)), (cx + r + p(4), cy + p(14))], fill=alt, outline=accent)
    draw.rounded_rectangle((cx - p(10), cy - p(10), cx + p(10), cy + p(11)), radius=p(5), fill=accent)
    draw.ellipse((cx - p(4), cy - p(4), cx + p(4), cy + p(5)), fill="#fff")


def node(draw, x, y, w, h, title, rule, pb, triggers, accent, index=0):
    soft_card(draw, (x, y, x + w, y + h), 8, NEUTRAL["surface"], NEUTRAL["border"])
    draw.rounded_rectangle((p(x), p(y + 8), p(x + 4), p(y + h - 8)), radius=p(2), fill=accent)
    icon_radius = 28 if h >= 112 else 24
    icon_y = y + 36
    mag_icon(draw, x + 38, icon_y, accent, index, image_key(title), icon_radius)
    text(draw, (x + 82, y + 14), title, 16, NEUTRAL["text"], True)
    line_y = y + 43
    for i, ln in enumerate(wrap(draw, pretty_rule(rule), f(13), w - 98)):
        text(draw, (x + 82, line_y + i * 18), ln, 13, NEUTRAL["muted"])

    meta_y = y + h - 40
    if not pb and not triggers:
        return
    if pb:
        text(draw, (x + 18, meta_y + 5), "PB", 11, NEUTRAL["faint"], True)
        for i, item in enumerate(pb):
            badge(draw, x + 48 + i * 46, meta_y, item, PB)
        trigger_x = x + w - 204
        badge_x = x + w - 160
    else:
        trigger_x = x + 18
        badge_x = x + 62
    text(draw, (trigger_x, meta_y + 5), "触发", 11, NEUTRAL["faint"], True)
    for i, item in enumerate(triggers):
        badge(draw, badge_x + i * 38, meta_y, item, TRIGGER, 34)


def chip(draw, x, y, value, accent, w=170):
    value = pretty_rule(value)
    rect(draw, (x, y, x + w, y + 36), 18, ACCENT_SOFT.get(accent, NEUTRAL["surface"]), accent, 2)
    size = 14
    while size > 9 and draw.textbbox((0, 0), value, font=f(size, True))[2] > p(w - 22):
        size -= 1
    text(draw, (x + w / 2, y + 18), value, size, NEUTRAL["text"], True, "mm")


def group_panel(draw, x, y, w, group_key, accent, prefix=""):
    label, row1, row2 = ID_GROUPS[group_key]
    rect(draw, (x, y, x + w, y + 64), 8, ACCENT_SOFT.get(accent, NEUTRAL["surface_alt"]))
    text(draw, (x + 16, y + 12), f"{prefix}{label}", 13, accent, True)
    text(draw, (x + 16, y + 33), row1, 12, NEUTRAL["text"])
    if row2:
        text(draw, (x + 16, y + 50), row2, 12, NEUTRAL["muted"])


def rare_condition(draw, x, y, w, column, accent, index):
    soft_card(draw, (x, y, x + w, y + 100), 8, ACCENT_SOFT.get(accent, NEUTRAL["surface_alt"]), NEUTRAL["border"])
    rect(draw, (x + 14, y + 14, x + 42, y + 42), 14, accent)
    text(draw, (x + 28, y + 28), str(index + 1), 11, "#ffffff", True, "mm")
    text(draw, (x + 54, y + 13), pretty_rule(column["formula"]), 14, NEUTRAL["text"], True)
    label, row1, row2 = ID_GROUPS[column["group"]]
    text(draw, (x + 54, y + 42), label, 11, accent, True)
    text(draw, (x + 54, y + 61), row1, 11, NEUTRAL["text"])
    if row2:
        text(draw, (x + 54, y + 79), row2, 11, NEUTRAL["muted"])


def unique_rare_items(columns, item_index):
    result = []
    seen = set()
    for column in columns:
        item = column["items"][item_index]
        if item[0] not in seen:
            seen.add(item[0])
            result.append(item)
    return result


def rare_output_positions(items, top):
    if len(items) == 1:
        return {items[0][0]: top + 126}
    return {item[0]: top + i * 212 for i, item in enumerate(items)}


def section(draw, y, title, accent, step):
    rect(draw, (42, y, 112, y + 28), 14, accent)
    text(draw, (77, y + 14), step, 11, "#ffffff", True, "mm")
    text(draw, (126, y + 1), title, 24, NEUTRAL["text"], True)
    draw.rounded_rectangle((p(42), p(y + 40), p(W - 42), p(y + 44)), radius=p(3), fill=NEUTRAL["border_soft"])
    draw.rounded_rectangle((p(42), p(y + 40), p(248), p(y + 44)), radius=p(3), fill=accent)


def header(draw, cfg):
    draw.rectangle((0, 0, p(W), p(144)), fill=NEUTRAL["surface"])
    draw.rectangle((0, 0, p(W), p(8)), fill=cfg["accent"])
    draw.line((0, p(143), p(W), p(143)), fill=NEUTRAL["border"])
    rect(draw, (42, 30, 110, 58), 14, ACCENT_SOFT.get(cfg["accent"], NEUTRAL["surface_alt"]), cfg["accent"], 1)
    text(draw, (76, 44), cfg["class"].split()[0], 12, cfg["accent"], True, "mm")
    text(draw, (42, 68), cfg["title"], 34, NEUTRAL["text"], True)
    text(draw, (44, 108), cfg["subtitle"], 16, NEUTRAL["muted"])
    soft_card(draw, (850, 24, 1136, 126), 12, NEUTRAL["surface"], NEUTRAL["border"])
    text(draw, (872, 40), "触发条件", 14, NEUTRAL["text"], True)
    labels = ["BP100", "濒死", "死亡", "BOSS"]
    for i, lab in enumerate(labels):
        badge(draw, 872 + i * 58, 64, lab, TRIGGER, 38)
    descriptions = ["满 PB", "低 HP", "倒地", "BOSS"]
    for i, label in enumerate(descriptions):
        text(draw, (891 + i * 58, 105), label, 9, NEUTRAL["faint"], False, "mm")


def render_chart(cfg):
    global SURFACE
    rows = max(len(cfg["left"]), len(cfg["right"]))
    special_rows = (len(cfg.get("special", [])) + 1) // 2
    h = 1400 + rows * 126 + special_rows * 126 + (80 if cfg.get("special") else 0)
    img = Image.new("RGB", (W * S, h * S), NEUTRAL["bg"])
    SURFACE = img
    draw = ImageDraw.Draw(img)
    header(draw, cfg)
    accent = cfg["accent"]

    y = 174
    section(draw, y, "Lv.1 -> Lv.35 基础进化", accent, "STEP 1")
    node(draw, 52, y + 68, 250, 112, "Mag", "初始形态", [], [], accent, 0)
    arrow(draw, (304, y + 124), (448, y + 124), accent)
    chip(draw, 316, y + 76, cfg["class"], accent, 120)
    node(draw, 464, y + 68, 250, 112, cfg["lv10"][0], cfg["lv10"][1], cfg["lv10"][2], cfg["lv10"][3], accent, 1)
    arrow(draw, (716, y + 124), (860, y + 124), accent)
    chip(draw, 728, y + 76, "达到 Lv.35", accent, 120)
    node(draw, 876, y + 68, 252, 112, "Lv.35 判定", "比较 POW / DEX / MIND 最大值", [], [], accent, 2)

    branch_y = y + 212
    centers = [216, 590, 964]
    line(draw, [(1002, y + 180), (1002, branch_y), (centers[0], branch_y)], accent, 2)
    for center in centers:
        arrow(draw, (center, branch_y), (center, y + 232), accent)

    y += 232
    for i, item in enumerate(cfg["lv35"]):
        node(draw, 52 + i * 374, y, 328, 120, item[0], item[1], item[2], item[3], accent, i + 3)

    y += 168
    section(draw, y, "Lv.50 按 ID + 数值分支", accent, "STEP 2")
    y0 = y + 62
    if cfg.get("special"):
        chip(draw, 460, y0, cfg["special_rule"], accent, 260)
        y0 += 60
        special_centers = []
        for i, item in enumerate(cfg["special"]):
            x = 52 if i % 2 == 0 else 704
            yy = y0 + (i // 2) * 126
            node(draw, x, yy, 424, 108, item[0], item[1], item[2], item[3], accent, i + 40)
            special_centers.append((x + 212, yy))
        if special_centers:
            branch_y = y0 - 12
            line(draw, [(590, y0 - 24), (590, branch_y), (special_centers[0][0], branch_y), (special_centers[-1][0], branch_y)], accent, 2)
            for center, node_y in special_centers:
                arrow(draw, (center, branch_y), (center, node_y - 2), accent)
        y0 += special_rows * 126 + 8
    group_panel(draw, 52, y0, 390, "A", accent, cfg.get("group_prefix", ""))
    group_panel(draw, 738, y0, 390, "B", accent, cfg.get("group_prefix", ""))
    y0 += 84
    for i in range(rows):
        yy = y0 + i * 126
        if i < len(cfg["left"]):
            item = cfg["left"][i]
            node(draw, 52, yy, 390, 108, item[0], item[1], item[2], item[3], accent, i + 7)
        if i < len(cfg["right"]):
            item = cfg["right"][i]
            node(draw, 738, yy, 390, 108, item[0], item[1], item[2], item[3], accent, i + 17)
        if i < len(cfg["rules"]):
            chip(draw, 470, yy + 36, cfg["rules"][i], accent, 240)
            if i < len(cfg["left"]):
                arrow(draw, (470, yy + 54), (444, yy + 54), accent)
            if i < len(cfg["right"]):
                arrow(draw, (710, yy + 54), (736, yy + 54), accent)

    y = y0 + rows * 126 + 44
    section(draw, y, "Lv.100 按公式 + ID + 性别分支", accent, "STEP 3")
    text(draw, (44, y + 54), "Lv.100 起每逢 10 的倍数：公式、Section ID 与角色性别必须同时满足；不会新增 PB。", 15, NEUTRAL["muted"])
    chip(draw, 108, y + 88, "男性角色", accent, 180)
    chip(draw, 500, y + 88, "数值公式 + ID 组", accent, 180)
    chip(draw, 892, y + 88, "女性角色", accent, 180)

    formula_x = 410
    formula_top = y + 142
    formula_mids = []
    for i, column in enumerate(cfg["rare_columns"]):
        formula_y = formula_top + i * 126
        formula_mids.append(formula_y + 50)
        rare_condition(draw, formula_x, formula_y, 360, column, accent, i)

    male_items = unique_rare_items(cfg["rare_columns"], 0)
    female_items = unique_rare_items(cfg["rare_columns"], 1)
    male_y = rare_output_positions(male_items, formula_top)
    female_y = rare_output_positions(female_items, formula_top)

    for i, column in enumerate(cfg["rare_columns"]):
        formula_mid = formula_mids[i]
        male_mid = male_y[column["items"][0][0]] + 56
        female_mid = female_y[column["items"][1][0]] + 56
        left_lane = 394 - i * 6
        right_lane = 786 + i * 6
        line(draw, [(410, formula_mid), (left_lane, formula_mid), (left_lane, male_mid)], accent, 2)
        arrow(draw, (left_lane, male_mid), (364, male_mid), accent)
        line(draw, [(770, formula_mid), (right_lane, formula_mid), (right_lane, female_mid)], accent, 2)
        arrow(draw, (right_lane, female_mid), (816, female_mid), accent)

    for i, item in enumerate(male_items):
        node(draw, 52, male_y[item[0]], 310, 112, item[0], item[1], [], item[3], accent, i + 30)
    for i, item in enumerate(female_items):
        node(draw, 818, female_y[item[0]], 310, 112, item[0], item[1], [], item[3], accent, i + 40)

    img = img.resize((W, h), Image.Resampling.LANCZOS).convert("RGB")
    out = Path(cfg["out"])
    img.save(out, optimize=True)
    print(f"wrote {out} {W}x{h}")


T_ALL = ["BP100", "濒死", "死亡", "BOSS"]
T_BB = ["BP100", "濒死", "BOSS"]


CHARTS = [
    {
        "out": "assets/img/mag/HU-MAG.png",
        "title": "战士系 Mag 进化路线",
        "subtitle": "Hunters / HU - Lv.35、Lv.50、Lv.100 进化条件总览",
        "class": "HU 职业",
        "accent": "#b45309",
        "gradient": ((146, 64, 14), (24, 32, 48)),
        "lv10": ("伐楼那 | Varuna", "Lv.10", ["Farlla"], ["BP100", "BOSS"]),
        "lv35": [
            ("伐陀罗 | Rudra", "POW 最大", ["Golla"], T_BB),
            ("摩罗陀 | Marutah", "DEX 最大", ["Pilla"], ["BP100", "濒死"]),
            ("伐由 | Vayu", "MIND 最大", ["M&Y"], ["BP100", "濒死", "BOSS"]),
        ],
        "left_rule": "左侧 ID 组",
        "right_rule": "右侧 ID 组",
        "rules": ["POW>=DEX>=MIND", "POW>=MIND>DEX", "DEX>POW>MIND", "DEX>MIND>=POW", "MIND>POW>=DEX", "MIND>DEX>POW"],
        "left": [
            ("伐罗诃 | Varaha", "POW>=DEX>=MIND / DEX=MIND>POW", ["Golla"], T_ALL),
            ("伐罗婆 | Bhairava", "POW>=MIND>DEX", ["Pilla"], T_ALL),
            ("翼罗 | Ila", "DEX>POW>MIND", ["M&Y"], T_BB),
            ("天竺 | Nandin", "DEX>MIND>=POW", ["Estlla"], T_ALL),
            ("迦般达 | Kabanda", "MIND>POW>=DEX", ["Estlla", "M&Y"], T_ALL),
            ("乌莎斯 | Ushasu", "MIND>DEX>POW", ["Golla"], ["BP100", "濒死", "BOSS"]),
        ],
        "right": [
            ("迦摩 | Kama", "POW>=DEX>=MIND / DEX=MIND>POW", ["Pilla"], T_ALL),
            ("阿普萨拉丝 | Apsaras", "POW>=MIND>DEX", ["Pilla", "Estlla"], T_ALL),
            ("迦楼罗 | Garuda", "DEX>POW>MIND", ["Pilla"], T_BB),
            ("夜叉 | Yaksa", "DEX>MIND>=POW", ["Golla"], T_ALL),
            ("伐梨 | Bana", "MIND>POW>=DEX", ["Estlla"], T_ALL),
            ("苏摩 | Soma", "MIND>DEX>POW", ["Estlla"], T_ALL),
        ],
        "rare_columns": [
            {
                "group": "I",
                "formula": "DEF + DEX = POW + MIND",
                "items": [
                    ("提婆 | Deva", "男性 HU", [], T_BB),
                    ("萨维特利 | Savitri", "女性 HU", [], T_ALL),
                ],
            },
            {
                "group": "II",
                "formula": "DEF + MIND = POW + DEX",
                "items": [
                    ("拉特 | Rati", "男性 HU", [], T_ALL),
                    ("萨维特利 | Savitri", "女性 HU", [], T_ALL),
                ],
            },
            {
                "group": "III",
                "formula": "DEF + POW = DEX + MIND",
                "items": [
                    ("拉特 | Rati", "男性 HU", [], T_ALL),
                    ("萨维特利 | Savitri", "女性 HU", [], T_ALL),
                ],
            },
        ],
    },
    {
        "out": "assets/img/mag/RA-MAG.png",
        "title": "枪手系 Mag 进化路线",
        "subtitle": "Rangers / RA - Lv.35、Lv.50、Lv.100 进化条件总览",
        "class": "RA 职业",
        "accent": "#0f766e",
        "gradient": ((15, 118, 110), (21, 34, 56)),
        "lv10": ("迪尔吉 | Kalki", "Lv.10", ["Estlla"], ["BP100", "BOSS"]),
        "lv35": [
            ("苏利耶 | Surya", "POW 最大", ["Golla"], T_BB),
            ("密多罗 | Mitra", "DEX 最大", ["Pilla"], ["BP100", "濒死"]),
            ("塔巴斯 | Tapas", "MIND 最大", ["M&Y"], ["BP100", "濒死", "BOSS"]),
        ],
        "left_rule": "左侧 ID 组",
        "right_rule": "右侧 ID 组",
        "rules": ["POW>DEX>=MIND", "POW>MIND>DEX", "DEX>=MIND>=POW", "MIND>POW>=DEX", "MIND>DEX>POW"],
        "left": [
            ("迦摩 | Kama", "POW>DEX>=MIND", ["Pilla"], T_ALL),
            ("伐罗婆 | Bhairava", "POW>MIND>DEX / DEX>=POW>MIND", ["Pilla"], T_ALL),
            ("迦摩 | Kama", "DEX>=MIND>=POW / POW=MIND>DEX", ["Pilla"], T_ALL),
            ("阿普萨拉丝 | Apsaras", "MIND>POW>=DEX", ["Estlla"], T_ALL),
        ],
        "right": [
            ("玛度 | Madhu", "POW>DEX>=MIND", ["M&Y"], T_ALL),
            ("髻达婆 | Kaitabha", "POW>MIND>DEX", ["M&Y"], T_ALL),
            ("伐罗诃 | Varaha", "DEX>=MIND>=POW", ["Golla"], T_ALL),
            ("迦般达 | Kabanda", "MIND>POW>=DEX", ["M&Y"], T_ALL),
            ("杜尔迦 | Durga", "MIND>DEX>POW", ["Estlla"], T_ALL),
        ],
        "rare_columns": [
            {
                "group": "I",
                "formula": "DEF + DEX = POW + MIND",
                "items": [
                    ("普香 | Pushan", "男性 RA", [], T_ALL),
                    ("鲁克明 | Rukmin", "女性 RA", [], T_BB),
                ],
            },
            {
                "group": "II",
                "formula": "DEF + MIND = POW + DEX",
                "items": [
                    ("普香 | Pushan", "男性 RA", [], T_ALL),
                    ("鲁克明 | Rukmin", "女性 RA", [], T_BB),
                ],
            },
            {
                "group": "III",
                "formula": "DEF + POW = DEX + MIND",
                "items": [
                    ("普香 | Pushan", "男性 RA", [], T_ALL),
                    ("迪华利 | Diwari", "女性 RA", [], T_ALL),
                ],
            },
        ],
    },
    {
        "out": "assets/img/mag/FO-MAG.png",
        "title": "法师系 Mag 进化路线",
        "subtitle": "Forces / FO - Lv.35、Lv.50、Lv.100 进化条件总览",
        "class": "FO 职业",
        "accent": "#6d28d9",
        "gradient": ((109, 40, 217), (32, 31, 57)),
        "lv10": ("乌利陀罗 | Vritra", "Lv.10", ["Leilla"], ["BP100", "濒死"]),
        "lv35": [
            ("修姆巴 | Sumba", "POW 最大", ["Golla"], T_ALL),
            ("阿须文 | Ashvinau", "DEX 最大", ["Pilla"], ["BP100", "濒死"]),
            ("那慕奇 | Namuci", "MIND 最大", ["M&Y"], ["BP100", "濒死", "BOSS"]),
        ],
        "special_rule": "DEF >= 45：全 ID",
        "special": [
            ("闇陀迦 | Andhaka", "POW>MIND and DEX", ["Estlla"], T_ALL),
            ("伐那 | Bana", "MIND or DEX>=POW", ["Estlla"], T_ALL),
        ],
        "left_rule": "DEF < 45 左侧 ID 组",
        "right_rule": "DEF < 45 右侧 ID 组",
        "group_prefix": "DEF < 45 · ",
        "rules": ["POW>DEX>=MIND", "POW>MIND>DEX", "DEX>POW>MIND", "DEX>MIND>=POW", "MIND>=POW=DEX", "MIND>=DEX>POW"],
        "left": [
            ("那罗迦 | Naraka", "POW>DEX>=MIND", ["Golla"], T_ALL),
            ("罗伐那 | Ravana", "POW>MIND>DEX", ["Farlla"], T_ALL),
            ("梨婆诃 | Ribhava", "DEX>POW>MIND", ["Farlla"], T_ALL),
            ("悉多 | Sita", "DEX>MIND>=POW", ["Pilla"], T_ALL),
            ("娜迦 | Naga", "MIND>=POW=DEX / POW=DEX>MIND", ["M&Y"], T_ALL),
            ("迦般达 | Kabanda", "MIND>=DEX>POW", ["M&Y"], T_ALL),
        ],
        "right": [
            ("玛度 | Madhu", "POW>MIND and DEX", ["Pilla"], T_ALL),
            ("那迦 | Naga", "POW>MIND>DEX", ["M&Y"], T_ALL),
            ("迦楼罗 | Garuda", "DEX>POW>MIND", ["Pilla"], T_ALL),
            ("伐罗婆 | Bhairava", "DEX>MIND>=POW", ["Pilla"], T_ALL),
            ("鸠摩罗 | Kumara", "MIND>=POW=DEX", ["Golla"], T_ALL),
            ("翼罗 | Ila", "MIND>=DEX>POW", ["M&Y"], T_BB),
        ],
        "rare_columns": [
            {
                "group": "I",
                "formula": "DEF + DEX = POW + MIND",
                "items": [
                    ("尼德拉 | Nidra", "男性 FO", [], T_ALL),
                    ("莎特 | Sato", "女性 FO", [], T_ALL),
                ],
            },
            {
                "group": "II",
                "formula": "DEF + MIND = POW + DEX",
                "items": [
                    ("尼德拉 | Nidra", "男性 FO", [], T_ALL),
                    ("比玛 | Bhima", "女性 FO", [], ["BP100", "濒死"]),
                ],
            },
            {
                "group": "III",
                "formula": "DEF + POW = DEX + MIND",
                "items": [
                    ("尼德拉 | Nidra", "男性 FO", [], T_ALL),
                    ("比玛 | Bhima", "女性 FO", [], ["BP100", "濒死"]),
                ],
            },
        ],
    },
]


if __name__ == "__main__":
    for chart in CHARTS:
        render_chart(chart)
