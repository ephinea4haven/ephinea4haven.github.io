#!/usr/bin/env python3
"""Build localized Episode II challenge maps from Ephinea Wiki originals.

The high-resolution Wiki PNGs are immutable source evidence. Generated assets
separate map geometry from labels so route overlays always sit below room
numbers and mechanism icons.
"""

from __future__ import annotations

import base64
import html
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

from build_challenge_map_atlas import LANGUAGES as EP1_LANGUAGES, notes_panel


ROOT = Path(__file__).resolve().parents[1]
EP2_ROOT = ROOT / "assets/img/challenge/ep2"
SOURCE = EP2_ROOT / "original/wiki"
OUTPUT = EP2_ROOT / "maps"
BASE_OUTPUT = OUTPUT / "base"

MAPS = {
    1: [1, 2, 3, 4, 5, 6],
    2: [8, 9, 10, 11, 12, 13],
    3: [15, 16, 17, 18, 19],
    4: [21, 22, 23, 24, 25, 26],
    5: [28, 29],
}

SOURCE_NAMES = {
    area: ("2ca22(drue).png" if area == 22 else f"2ca{area}.png")
    for areas in MAPS.values()
    for area in areas
}

STAGE_NOTES = {
    1: {
        "zh": "神殿机关较多；严格按地图编号与机关标记推进，分队完成后再会合。",
        "en": "Temple is switch-heavy. Follow the numbered rooms and mechanism markers, and regroup only after each split is complete.",
        "ja": "神殿は仕掛けが多い。番号と仕掛け表示に従い、分担完了後に合流する。",
    },
    2: {
        "zh": "宇宙船多出生点并行推进；各组只处理自己的机关，开门后立即会合。",
        "en": "Spaceship uses parallel spawn routes. Each group handles its own mechanisms and regroups as soon as the gate opens.",
        "ja": "宇宙船は複数地点から並行進行。各組が担当の仕掛けを処理し、開門後すぐ合流する。",
    },
    3: {
        "zh": "中央管理区只打挡门敌人；固定回收与分队机关必须按地图标记完成。",
        "en": "In CCA, fight gatekeepers only. Complete every marked fixed pickup and split-route mechanism.",
        "ja": "中央管理区は門番のみ撃破。固定回収と分担仕掛けをマップ表示どおり完了する。",
    },
    4: {
        "zh": "海床强制分队且敌人危险；各组完成自己的机关与回收后再确认推进。",
        "en": "Seabed forces dangerous split play. Finish each group's mechanisms and pickups before confirming the advance.",
        "ja": "海底は危険な強制分担。各組の仕掛けと回収を終えてから進行を確認する。",
    },
    5: {
        "zh": "东塔由下向上、西塔由上向下推进；危险楼层保持队形，不要被箱子拖慢。",
        "en": "Climb East Tower and descend West Tower. Stay grouped on dangerous floors and do not lose time on ordinary crates.",
        "ja": "東塔は上り、西塔は下り。危険階では隊列を保ち、通常箱で時間を失わない。",
    },
}

AREA_NOTES_ZH = {
    1: "Area 1 在 2 号房分队；6a 为可选武器箱支线，8 号房需要留人踩机关升桥。",
    2: "按 1→5 的编号推进；4a 为替身娃娃支线，确认机关后再进入下一区。",
    3: "地图包含两组并行机关与会合路线；不要误入回程传送。",
    4: "四条支路分别处理机关；所有开关确认完成后再回到中央出口。",
    5: "按编号清理必要敌人；西侧固定箱与替身娃娃根据队伍状态决定是否回收。",
    6: "注意落锤与激光区域；Boss 前整理恢复品、魂粉与替身娃娃。",
    8: "两个出生组分别推进；只清挡门敌人，门开后立即通过。",
    9: "四人从不同位置处理机关；按房间编号完成后从中央路线会合。",
    10: "各出生组完成对应开关与固定回收，不跨线重复跑图。",
    11: "按编号完成房间机关；传送开放后立即集中。",
    12: "两组从不同入口推进；中央机关确认后再向出口集中。",
    13: "分队解除传送屏障；Boss 前保留魂粉与恢复品。",
    15: "两组只清必要敌人并开启机关；固定道具房不要漏取。",
    16: "短图快速推进；巨型花附近注意陷阱和倒地连击。",
    17: "两组分别处理小 Boss 与机关；两侧确认完成后再离开。",
    18: "分路回收固定装备并开启传送；只处理挡门敌人。",
    19: "按白色光柱和编号机关推进；误触机关会产生额外敌人。",
    21: "四人独立出生；按 P1–P4 的地图标记完成各自机关后从西侧出口离开。",
    22: "各出生点独立完成开关；末端替身娃娃需要破坏墙壁后回收。",
    23: "分队完成四组机关和固定回收；全部确认后进入下一区。",
    24: "沿编号分别处理机关；危险房优先使用远程攻击和陷阱控制。",
    25: "两组沿上下路线推进；解除屏障后在中央会合。",
    26: "逐段确认真假传送；隐藏房有替身娃娃与固定强化物资。",
    28: "东塔由 1F 向 10F 推进；4F 回收武器，5F 将敌人引出红外线区，9F 分批处理镰刀男。",
    29: "西塔从塔顶向下；7F 回收两个 General/Power，5F 先向右卡狗，3F 直接冲已打开的门。",
}

AREA_GENERIC = {
    "en": "Use the source-numbered rooms as the route order; colored symbols identify switches, barriers, warps and fixed pickups.",
    "ja": "元マップの部屋番号を進行順として使い、色付き記号でスイッチ・障壁・ワープ・固定回収を確認する。",
}

MAX_MAP_WIDTH = 864
MAX_MAP_HEIGHT = 760
FLOOR_COLOR = (62, 65, 69)
BACKGROUND = (7, 26, 49, 255)
FILL = (23, 61, 96, 255)
OUTLINE = (142, 223, 255, 255)


def source_path(area: int) -> Path:
    return SOURCE / SOURCE_NAMES[area]


def floor_mask(source: Image.Image) -> Image.Image:
    """Return all floor-colored components, including warp-separated rooms."""
    rgb = source.convert("RGB")
    mask = Image.new("L", rgb.size, 0)
    src = rgb.load()
    dst = mask.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            red, green, blue = src[x, y]
            if (red, green, blue) == FLOOR_COLOR:
                dst[x, y] = 255

    # Source labels and icons punch small holes in the flat floor color. Closing
    # repairs only those local holes and leaves room/corridor topology intact.
    return mask.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.MinFilter(21))


def label_layer(source: Image.Image) -> Image.Image:
    """Keep colored mechanisms and bright room labels; remove black/grey map."""
    rgb = source.convert("RGB")
    labels = Image.new("RGBA", rgb.size, (0, 0, 0, 0))
    src = rgb.load()
    dst = labels.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            red, green, blue = src[x, y]
            high = max(red, green, blue)
            low = min(red, green, blue)
            saturation = 0 if high == 0 else (high - low) / high
            if saturation >= .24 or low >= 185:
                dst[x, y] = (red, green, blue, 255)
    return labels


def write_layers(stage: int, area: int) -> tuple[int, int]:
    source = Image.open(source_path(area)).convert("RGBA")
    mask = floor_mask(source)
    dilated = mask.filter(ImageFilter.MaxFilter(7))
    outline = ImageChops.subtract(dilated, mask)

    base = Image.new("RGBA", source.size, BACKGROUND)
    base.paste(Image.new("RGBA", source.size, FILL), mask=mask)
    base.paste(Image.new("RGBA", source.size, OUTLINE), mask=outline)

    stem = f"c{stage}_area_{area:02d}"
    BASE_OUTPUT.mkdir(parents=True, exist_ok=True)
    base.save(BASE_OUTPUT / f"{stem}_base.png", optimize=True)
    label_layer(source).save(BASE_OUTPUT / f"{stem}_labels.png", optimize=True)
    return source.size


def map_layout(width: int, height: int) -> tuple[int, int, int, int, float]:
    scale = min(MAX_MAP_WIDTH / width, MAX_MAP_HEIGHT / height)
    rendered_width = round(width * scale)
    rendered_height = round(height * scale)
    canvas = max(688, rendered_width + 36)
    offset_x = (canvas - rendered_width) // 2
    return canvas, rendered_width, rendered_height, offset_x, scale


def area_notes(stage: int, area: int, language: str) -> list[str]:
    detail = AREA_NOTES_ZH[area] if language == "zh" else AREA_GENERIC[language]
    return [STAGE_NOTES[stage][language], detail]


def png_data_uri(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def inline_approved_area_one() -> None:
    """Make the manually approved Chinese Area 1 browser-self-contained."""
    directory = OUTPUT / "zh"
    path = directory / "c1_area_01.svg"
    svg = path.read_text(encoding="utf-8")
    for suffix in ("base", "labels"):
        name = f"c1_area_01_{suffix}.png"
        reference = f'href="{name}"'
        if reference in svg:
            svg = svg.replace(reference, f'href="{png_data_uri(directory / name)}"')
    path.write_text(svg, encoding="utf-8")


def accepted_area_one_route(scale: float, offset_x: int, offset_y: int) -> str:
    return f'''<g transform="translate({offset_x} {offset_y}) scale({scale})" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="M252 225H320V520V760V840H545V770H568V463H650V390H752V620V744H593V1025H752V1104" stroke="#ff5c72" stroke-width="8" stroke-dasharray="16 12"/>
  <path d="M320 520H135V710H320" stroke="#ffb04a" stroke-width="8" stroke-dasharray="14 11"/>
  <path d="M568 463V245V70" stroke="#ffe45c" stroke-width="7" stroke-dasharray="11 11"/>
</g>'''


def build_svg(stage: int, area: int, language: str, size: tuple[int, int]) -> str:
    width, height = size
    canvas, map_width, map_height, offset_x, scale = map_layout(width, height)
    offset_y = 18
    notes = area_notes(stage, area, language)
    words = {**EP1_LANGUAGES[language], "sources": {
        "zh": "结构与机关：Ephinea Wiki · Episode 2 Stage Guide",
        "en": "Geometry and mechanisms: Ephinea Wiki · Episode 2 Stage Guide",
        "ja": "構造・仕掛け：Ephinea Wiki · Episode 2 Stage Guide",
    }[language]}
    panel, panel_height = notes_panel(notes, words, canvas, offset_y + map_height + 18)
    total_height = offset_y + map_height + panel_height + 54
    stem = f"c{stage}_area_{area:02d}"
    route = accepted_area_one_route(scale, offset_x, offset_y) if (stage, area) == (1, 1) else ""
    base_uri = png_data_uri(BASE_OUTPUT / f"{stem}_base.png")
    labels_uri = png_data_uri(BASE_OUTPUT / f"{stem}_labels.png")
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas} {total_height}" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
<title id="title">EP2 C{stage} {html.escape(words["area"].replace("05", f"{area:02d}"))}</title>
<desc id="desc">{html.escape(" ".join(notes))}</desc>
<defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity=".32"/></filter></defs>
<rect width="{canvas}" height="{total_height}" rx="18" fill="#071a31"/>
<image href="{base_uri}" x="{offset_x}" y="{offset_y}" width="{map_width}" height="{map_height}" preserveAspectRatio="xMidYMid meet"/>
{route}
<image href="{labels_uri}" x="{offset_x}" y="{offset_y}" width="{map_width}" height="{map_height}" preserveAspectRatio="xMidYMid meet"/>
{panel}
</svg>'''


def main() -> None:
    sizes = {
        (stage, area): write_layers(stage, area)
        for stage, areas in MAPS.items()
        for area in areas
    }
    for language in ("zh", "en", "ja"):
        directory = OUTPUT / language
        directory.mkdir(parents=True, exist_ok=True)
        for stage, areas in MAPS.items():
            for area in areas:
                # The Chinese Area 1 was manually reviewed and approved. Keep
                # that exact composition while sharing its extracted layers.
                if (language, stage, area) == ("zh", 1, 1):
                    continue
                stem = f"c{stage}_area_{area:02d}"
                path = directory / f"c{stage}_area_{area:02d}.svg"
                path.write_text(build_svg(stage, area, language, sizes[(stage, area)]), encoding="utf-8")
    inline_approved_area_one()
    for directory in [BASE_OUTPUT, *(OUTPUT / language for language in ("zh", "en", "ja"))]:
        for layer in directory.glob("*_base.png"):
            layer.unlink()
        for layer in directory.glob("*_labels.png"):
            layer.unlink()
    BASE_OUTPUT.rmdir()
    print("Built 25 high-resolution EP2 challenge maps in zh/en/ja.")


if __name__ == "__main__":
    main()
