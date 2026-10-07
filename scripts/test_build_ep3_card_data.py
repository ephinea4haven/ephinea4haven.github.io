"""Pinned source slices, snapshot contracts, and optional full-input checks."""
import hashlib
import importlib.util
from collections import Counter
import json
import os
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

from . import build_ep3_card_data as ep3


FIXTURES = Path(__file__).with_name("fixtures") / "ep3-cards"
PSOEP3 = Path(os.environ.get("PSOEP3_ROOT", Path.home() / "Documents/PSOEP3"))
NEWSERV = Path(os.environ.get("NEWSERV_ROOT", ep3.ROOT.parent / "newserv"))


def records(data):
    return [data[p:p + 296] for p in range(0, len(data), 296)]


class CardDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.disc = records((FIXTURES / "disc-records.bin").read_bytes())
        cls.online = records((FIXTURES / "online-records.bin").read_bytes())
        cls.texts = {lang: ep3.read_text_records((FIXTURES / f"text-{lang}.bin").read_bytes())
                     for lang in ("en", "ja")}
        cls.cards = {c["id"]: c for c in ep3.build_cards(cls.online, cls.disc, cls.texts)}
        cls.snapshot = json.loads((ep3.ROOT / "content/ep3-card-catalog/cards.json").read_text())

    def test_fixture_provenance(self):
        manifest = json.loads((FIXTURES / "manifest.json").read_text())
        for name, info in manifest["files"].items():
            self.assertEqual(hashlib.sha256((FIXTURES / name).read_bytes()).hexdigest(), info["sha256"])
        self.assertEqual(set(self.cards), set(manifest["cardIds"]))

    def test_stat_codes_and_orland(self):
        for code, kind, value in [(0, "blank", 0), (1002, "value", 2), (2002, "plus", 2),
                                  (3003, "minus", 3), (4000, "equals", 0), (1999, "value", None),
                                  (2999, "plus", None), (3999, "minus", None), (4999, "equals", None)]:
            self.assertEqual(ep3.decode_stat(code), {"kind": kind, "value": value})
        with self.assertRaises(ValueError):
            ep3.decode_stat(5000)
        online, disc = ep3.parse_card(self.online[0]), ep3.parse_card(self.disc[0])
        self.assertEqual([online[k] for k in ("hp", "ap", "tp", "mv")],
                         [ep3.decode_stat(c) for c in (2000, 1001, 1000, 1003)])
        self.assertEqual([disc[k] for k in ("hp", "mv")], [ep3.decode_stat(c) for c in (3003, 1002)])

    def test_footer_root_bounds_and_sentinel(self):
        sentinel = bytearray(296)
        sentinel[68] = 255
        # Only the wrapper is synthetic; CardDefinition bytes are unmodified.
        payload = b"prefix00" + self.disc[0] + sentinel
        root = len(payload)
        data = payload + struct.pack(">II", 8, 2) + struct.pack(">8I", 0, 0, 0, 0, root, 0, 0, 0)
        self.assertEqual(ep3.table_records(data), [self.disc[0]])
        with self.assertRaises(ValueError):
            ep3.table_records(data[:-16] + b"\xff" * 4 + data[-12:])

    def test_names(self):
        self.assertEqual(self.cards[29]["names"], {"en": "Hildebear's Cane+", "ja": "ヒルデベアケイン＋"})
        self.assertEqual(self.cards[29]["tableName"]["en"], "BEARS CANE +")
        self.assertEqual(self.cards[560]["names"]["en"], "Penetrate Guard")
        self.assertEqual(self.cards[179]["names"]["en"], "Double- Edged Dice")
        self.assertEqual(self.cards[394]["names"]["en"], "NUG2000- Bazooka")

    def test_ability_note_and_status(self):
        tags = self.cards[100]["text"]["en"]["tags"]
        paralysis = [t for t in tags if t["name"] == "Paralysis"]
        self.assertEqual([t["kind"] for t in paralysis], ["ability", "status"])
        self.assertIn("Roll 6 or higher", paralysis[0]["body"])
        self.assertIn("unable to attack", paralysis[1]["body"])
        for language, note, ability in [("en", "Use on ally OK", "Pierce Block"),
                                         ("ja", "味方への使用可", "貫通無効")]:
            tags = self.cards[560]["text"][language]["tags"]
            self.assertEqual([(t["kind"], t["name"]) for t in tags], [("note", note), ("ability", ability)])
            self.assertTrue(all(t["body"] for t in tags))

    def test_structured_lines_and_wrapped_prose(self):
        for language, lines, expected in [
            ("en", ["Hero     : ○", "Dark     : ×", "Item     : ○", "Creature: ○", "Able to move,", "but not attack."],
             "Hero     : ○\nDark     : ×\nItem     : ○\nCreature: ○\nAble to move, but not attack."),
            ("ja", ["ヒーロー：〇", "ダーク　：×", "説明の", "続き。"], "ヒーロー：〇\nダーク　：×\n説明の続き。"),
            ("en", ["Roll the dice.", "2 or 3: Immobile", "3 turns.", "4: Hold 3 turns."],
             "Roll the dice.\n2 or 3: Immobile 3 turns.\n4: Hold 3 turns."),
            ("ja", ["出た目が", "２〜３：３ターン相", "手が移動不可", "４：３ターン相手が", "行動不可"],
             "出た目が\n２〜３：３ターン相手が移動不可\n４：３ターン相手が行動不可"),
            ("en", ["(Example:", "1 card =", "1 damage,", "2 cards =", "4 damage.)"],
             "(Example:\n1 card = 1 damage,\n2 cards = 4 damage.)"),
            ("en", ["Prevents", "Abnormal", "Conditions:", "Acid, Drop.", "", "Hard-", "wrapped prose."],
             "Prevents Abnormal Conditions: Acid, Drop.\n\nHard-wrapped prose."),
        ]:
            with self.subTest(language=language, lines=lines):
                self.assertEqual(ep3.join_lines(lines, language), expected)
        for language in ("en", "ja"):
            tags = self.cards[100]["text"][language]["tags"]
            status = next(t["body"] for t in tags if t["kind"] == "status")
            self.assertEqual(len(status.splitlines()[:4]), 4)
            self.assertTrue(all(line.rstrip().endswith(("○", "〇", "×")) for line in status.splitlines()[:4]))
        self.assertEqual(ep3.clean_text("Hero: \tO\nDark: \tX"), "Hero: ○\nDark: ×")

    def test_structured_rows_across_pages(self):
        pages = [b"Example\n---\n\tSAbility", b"\tSAbility\nHero: \tO\n(Continue)",
                 b"Dark: \tX\nHard-\n(Continue)", b"wrapped prose."]
        _, text = ep3.parse_text(pages, "en")
        self.assertEqual(text["tags"][0]["body"], "Hero: ○\nDark: ×\nHard-wrapped prose.")

    def test_header_continuation_inline_tags_and_unmarked_continuation(self):
        tags = self.cards[7]["text"]["en"]["tags"]
        self.assertTrue(next(t for t in tags if t["name"] == "Aerial Assassin")["body"])
        tags = self.cards[360]["text"]["ja"]["tags"]
        body = next(t for t in tags if t["name"] == "能力封印")["body"]
        self.assertIn("乱撃や貫通、単純、", body)
        self.assertIn("\n\n戦闘演出終了", body)
        for card_id, language, name, suffix in [(422, "en", "Counter", "No effect against Tech attacks."),
                                                (162, "ja", "グォーム", "移動不可になる。")]:
            tags = self.cards[card_id]["text"][language]["tags"]
            self.assertTrue(any(t["name"] == name and t["body"].endswith(suffix) for t in tags))
        self.assertEqual(self.cards[231]["text"]["ja"]["tags"][-1]["name"], "合成テクニック")

    def test_paragraph_break_at_page_boundary(self):
        tag = next(t for t in self.cards[179]["text"]["en"]["tags"] if t["name"] == "Russian Roulette")
        self.assertEqual(tag["body"], "The dice roll before an attack determines your fate.\n\n"
                         "4 or higher: Death to the user of this card.\n\n3 or lower: Death to the opponent.")

    def test_source_heading_disagreements_are_not_silently_rewritten(self):
        tags = self.cards[667]["text"]["en"]["tags"]
        self.assertTrue(any(t["name"] == "A/T Swap Turn" and not t["body"] for t in tags))
        self.assertTrue(any(t["name"] == "A/H Swap Turn" and t["body"] for t in tags))
        tags = self.cards[245]["text"]["ja"]["tags"]
        self.assertTrue(any(t["name"] == "ダイス目１／２" for t in tags))
        self.assertTrue(any(t["name"] == "ダイス１／２" and t["body"] for t in tags))

    def test_strict_japanese(self):
        self.assertEqual(ep3.decode_japanese(bytes.fromhex("8160817c")), "〜−")
        for data in (b"\x81", b"\xf0\x40", b"\xff"):
            with self.assertRaises((ValueError, UnicodeDecodeError)):
                ep3.decode_japanese(data)
        for pages in self.texts["ja"].values():
            for page in pages:
                self.assertNotIn("\ufffd", ep3.decode_japanese(page))

    def test_sha_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input"
            path.write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                ep3.checked_bytes(path, "0" * 64)

    def test_ranges(self):
        front = ep3.decode_range((0, 0, 0, 0, 0x100, 0))
        self.assertTrue(front["grid"][3][2])
        self.assertEqual(sum(map(sum, front["grid"])), 1)
        self.assertTrue(ep3.decode_range((0, 0, 0, 0, 0x600, 0))["entireField"])
        self.assertEqual(sum(map(sum, ep3.decode_range((0, 0, 0, 0, 0x900, 0))["grid"])), 0)
        with self.assertRaises(ValueError):
            ep3.decode_range((0, 0, 0, 0, 0xA00, 0))

    def test_snapshot_contract(self):
        cards = self.snapshot["cards"]
        ep3.validate_catalog(cards)
        self.assertEqual({c["id"] for c in cards if c["hidden"]},
                         {71, 72, *range(74, 85), *range(677, 700), 702, 703})
        self.assertEqual(sum(not c["hidden"] for c in cards), 662)
        for card in cards:
            if card["id"] in {668, 669, *range(716, 740)}:
                self.assertFalse(card["hidden"])
        self.assertEqual([c["id"] for c in cards], sorted(set(range(1, 740)) - ep3.GAPS))
        self.assertEqual([sum(c["type"] == t for c in cards) for t in ep3.TYPES], [39, 39, 259, 120, 168, 75])
        self.assertEqual({c["rank"] for c in cards}, set(ep3.RANKS[:11]))
        self.assertEqual({c["id"] for c in cards if c["names"]["en"] == "???"}, ep3.UNKNOWN_IDS)
        self.assertEqual(sum(c["names"]["en"] != c["tableName"]["en"] for c in cards), 47)
        self.assertEqual({d["field"] for c in cards for d in c["diff"]},
                         {"self_cost", "hp", "ap", "tp", "mv", "effects", "right_colors", "top_colors", "target_mode"})
        for card in cards:
            serialized = json.dumps(card, ensure_ascii=False)
            for control in ("\\t", "\ufffd", "(Continue)", "（次ページへ）"):
                self.assertNotIn(control, serialized)
            if card["id"] in self.cards:
                self.assertEqual({k: v for k, v in card.items() if k != "images"}, self.cards[card["id"]])

    def test_artwork_files_and_totals(self):
        cards = self.snapshot["cards"]
        self.assertEqual(sum("large" in c.get("images", {}) for c in cards), 608)
        self.assertEqual(sum("medium" in c.get("images", {}) and "large" not in c["images"] for c in cards), 64)
        for card in cards:
            if "large" in card.get("images", {}):
                self.assertEqual((card["images"]["large"]["width"], card["images"]["large"]["height"]), (512, 399))
        images = [im for c in cards for im in c.get("images", {}).values()]
        self.assertEqual(len(images), 1280)
        self.assertEqual({p.name for p in (ep3.ROOT / "assets/img/ep3-cards").glob("*.webp")},
                         {Path(im["path"]).name for im in images})
        self.assertEqual(len(images), self.snapshot["metadata"]["artwork"]["imageCount"])
        self.assertEqual(sum(im["bytes"] for im in images), self.snapshot["metadata"]["artwork"]["totalBytes"])
        for image in images:
            path = ep3.ROOT / image["path"].lstrip("/")
            self.assertEqual(path.stat().st_size, image["bytes"])
            data = path.read_bytes()
            self.assertEqual(data[:4], b"RIFF")
            self.assertEqual(data[8:16], b"WEBPVP8 ")
            self.assertEqual(struct.unpack_from("<I", data, 4)[0] + 8, len(data))
            self.assertEqual(data[23:26], bytes.fromhex("9d012a"))
            width, height = struct.unpack_from("<HH", data, 26)
            self.assertEqual((width & 0x3FFF, height & 0x3FFF), (image["width"], image["height"]))
            self.assertIn((image["width"], image["height"]), {(512, 399), (184, 144)})

    @unittest.skipUnless(importlib.util.find_spec("PIL"), "Pillow is only required for local artwork assembly")
    def test_medium_only_extraction_never_emits_large_and_removes_retired_file(self):
        from PIL import Image

        # Isolate the publication decision from the external gvmdump executable.
        textures = {f"unused-{i}": {} for i in range(4980)}
        for i in range(4):
            textures[f"C_001_{i:02}"] = {"size": (64, 64), "payload": b"logo"}
        textures["L_000"] = {"payload": b"logo"}
        textures["L_001"] = {"payload": b"art", "data": b"gvm", "entry": 3418}

        def decode(command, **kwargs):
            gvm = Path(command[1])
            Image.new("RGB", (256, 256), "blue").save(str(gvm) + "_L_001.gvr.bmp")

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            retired = output / "1-large.webp"
            retired.write_bytes(b"previous redundant file")
            cards = [{"id": 1}]
            with patch.object(ep3, "texture_index", return_value=textures), patch.object(ep3.subprocess, "run", side_effect=decode):
                result = ep3.build_artwork(b"archive", cards, Path("gvmdump"), output)
            self.assertEqual(set(cards[0]["images"]), {"medium"})
            self.assertEqual(result["imageCount"], 1)
            self.assertEqual(result["nativeLargeCards"], 0)
            self.assertFalse(retired.exists())
            self.assertEqual({p.name for p in output.iterdir()}, {"1-medium.webp"})

    @unittest.skipUnless(importlib.util.find_spec("PIL"), "Pillow is only required for local artwork assembly")
    def test_native_tile_assembly(self):
        from PIL import Image

        tiles = [Image.new("RGB", (256, 256), color) for color in ("red", "green", "blue", "white")]
        assembled = ep3.assemble_tiles(tiles)
        self.assertEqual(assembled.size, (512, 399))
        self.assertEqual([assembled.getpixel(point) for point in [(0, 0), (511, 0), (0, 398), (511, 398)]],
                         [(255, 0, 0), (0, 128, 0), (0, 0, 255), (255, 255, 255)])


@unittest.skipUnless((PSOEP3 / ep3.INPUTS["disc"][0]).exists() and
                     (NEWSERV / ep3.INPUTS["online"][0]).exists(), "External game inputs are not installed")
class FullInputTests(unittest.TestCase):
    def test_full_artwork_mapping(self):
        archive = ep3.checked_bytes(PSOEP3 / ep3.INPUTS["artwork"][0], ep3.INPUTS["artwork"][1])
        textures = ep3.texture_index(archive)
        self.assertEqual(len(textures), 4986)
        self.assertEqual(Counter(t["size"] for t in textures.values()),
                         {(256, 256): 3454, (64, 64): 1477, (128, 128): 31, (32, 32): 24})
        snapshot = json.loads((ep3.ROOT / "content/ep3-card-catalog/cards.json").read_text())
        missing = []
        for card in snapshot["cards"]:
            card_id = card["id"]
            tiles = [f"C_{card_id:03}_{i:02}" for i in range(4)]
            self.assertEqual([textures[name]["entry"] for name in tiles], list(range(96 + card_id * 4, 100 + card_id * 4)))
            medium = textures[f"L_{card_id:03}"]
            self.assertEqual(medium["entry"], 3417 + card_id)
            self.assertEqual(textures[f"M_{card_id:03}"]["entry"], 4201 + card_id)
            self.assertEqual("large" in card.get("images", {}), textures[tiles[0]]["size"] == (256, 256))
            if textures[tiles[0]]["size"] == (64, 64):
                for name in tiles:
                    self.assertEqual(textures[name]["payload"], textures["C_001_00"]["payload"])
                if medium["payload"] == textures["L_000"]["payload"]:
                    missing.append(card_id)
                    self.assertNotIn("images", card)
            for image in card.get("images", {}).values():
                self.assertEqual(image["entries"], [textures[name]["entry"] for name in image["textures"]])
        self.assertEqual(missing, [21, 27, 702, 703, *range(716, 740)])
        self.assertEqual(snapshot["metadata"]["artwork"]["missingCardIds"], missing)

    def test_all_source_applicability_rows_remain_separate(self):
        import re

        for language, filename in (("en", "TextCardE.bin"), ("ja", "TextCardJ.bin")):
            texts = ep3.read_text_records((PSOEP3 / "files" / filename).read_bytes())
            for card_id in set(range(1, 740)) - ep3.GAPS:
                _, text = ep3.parse_text(texts[card_id], language)
                actual = [line.strip() for tag in text["tags"] for line in tag["body"].splitlines()]
                for page in texts[card_id][1:]:
                    decoded = ep3.decode_japanese(page) if language == "ja" else page.decode("latin1")
                    for raw in decoded.splitlines():
                        line = ep3.clean_text(raw).strip()
                        if re.fullmatch(r"[^:：]+[:：]\s*[○〇×]", line):
                            self.assertIn(line, actual, (card_id, language, line))

    def test_full_tables_text_and_fixtures(self):
        inputs = {key: ep3.checked_bytes((NEWSERV if key == "online" else PSOEP3) / path, sha)
                  for key, (path, sha) in ep3.INPUTS.items()}
        tables = {key: ep3.table_records(ep3.prs_decompress(inputs[key])) for key in ("online", "disc")}
        texts = {lang: ep3.read_text_records(inputs[lang]) for lang in ("en", "ja")}
        self.assertEqual([len(t) for t in texts.values()], [753, 753])
        ep3.validate_catalog(ep3.build_cards(tables["online"], tables["disc"], texts))
        ep3.verify_japanese([p for pages in texts["ja"].values() for p in pages]
                            + [r[4:68].split(b"\0", 1)[0] for r in tables["disc"]])
        drop_ids = {int.from_bytes(a[:4], "big") for a, b in zip(tables["online"], tables["disc"])
                    if a[0x9C:0xA0] != b[0x9C:0xA0]}
        # Reported spec disagreement, with byte-level evidence in the catalog
        # document: 328 is the total, not the drop-only count (38 overlap).
        self.assertEqual(len(drop_ids), 328)
        self.assertEqual(len(drop_ids & ep3.DIFF_IDS), 38)
        self.assertEqual(len(drop_ids - ep3.DIFF_IDS), 290)
        self.assertEqual(inputs["en"], ep3.prs_decompress((NEWSERV / "system/ep3/card-text.mnr").read_bytes()))
        manifest = json.loads((FIXTURES / "manifest.json").read_text())
        for name, info in manifest["files"].items():
            key = name.split("-")[0] if "records" in name else name[5:7]
            source = ep3.prs_decompress(inputs[key]) if key in tables else inputs[key]
            cuts = b"".join(source[cut.get("offset", cut.get("decompressedOffset")):
                                   cut.get("offset", cut.get("decompressedOffset")) + cut["length"]]
                            for cut in info["cuts"])
            if key in texts:
                cuts += b"\xff\0"
            self.assertEqual(cuts, (FIXTURES / name).read_bytes())


if __name__ == "__main__":
    unittest.main()
