#!/usr/bin/env python3
"""Build the hand-authored, localized challenge-map atlas."""

from __future__ import annotations

import html
import re
import subprocess
import tempfile
import unicodedata
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets/img/challenge/ep1/maps"
SOURCE = ROOT / "assets/img/challenge/ep1/original"
LANGUAGES = {
    "zh": {
        "area": "区域 05",
        "start": "起点",
        "next": "前往下一区",
        "ignore": "无视敌人",
        "route": "主路线",
        "branch": "回收支线",
        "switch": "地板机关",
        "warp": "传送点",
        "tips": "关键提醒",
        "tip_a_title": "穿墙捷径",
        "tip_a": "无视敌人，穿过北墙进入传送点；同时避开下一出口房间的陷阱。",
        "tip_b_title": "三机关接力",
        "tip_b": "一人踩右侧机关；通过屏障后踩中央机关取箱；取箱者再踩左侧机关放行队友。",
        "tip_c_title": "可选补给",
        "tip_c": "传送点后的假墙内有箱子。非 TA 时可由机器人绕行回收。",
        "sources": "提示依据：PSO World · Sakura 攻略",
    },
    "en": {
        "area": "AREA 05",
        "start": "START",
        "next": "NEXT AREA",
        "ignore": "IGNORE ENEMIES",
        "route": "MAIN ROUTE",
        "branch": "PICKUP BRANCH",
        "switch": "FLOOR SWITCH",
        "warp": "WARP",
        "tips": "KEY NOTES",
        "tip_a_title": "WALL SHORTCUT",
        "tip_a": "Ignore the enemies and pass through the north wall to the warp; this also skips the traps by the next-area gate.",
        "tip_b_title": "THREE-SWITCH RELAY",
        "tip_b": "One player holds the right switch; after crossing, use the center switch for the boxes, then the collector holds the left switch.",
        "tip_c_title": "OPTIONAL SUPPLIES",
        "tip_c": "Boxes are behind a false wall past the warp. An android can collect them when the run is not TA.",
        "sources": "Notes: PSO World · Sakura guide",
    },
    "ja": {
        "area": "エリア 05",
        "start": "スタート",
        "next": "次のエリアへ",
        "ignore": "敵は無視",
        "route": "メインルート",
        "branch": "回収ルート",
        "switch": "床スイッチ",
        "warp": "ワープ",
        "tips": "重要ポイント",
        "tip_a_title": "隠し通路",
        "tip_a": "敵を無視して北の壁を抜けワープへ。次エリアのゲート部屋にある罠も回避できる。",
        "tip_b_title": "3スイッチ連携",
        "tip_b": "右を1人が踏み、通過後に中央で箱を回収。回収役が左を踏んで残りを進ませる。",
        "tip_c_title": "任意の補給",
        "tip_c": "ワープ先の隠し部屋に箱。TAでなければアンドロイドが回収候補。",
        "sources": "攻略情報：PSO World · Sakura",
    },
}

C2_NOTES = {
    "zh": {
        4: ["分队：一人向南踩限时机关，其余队员向东推进。", "射击门上方目标，取得固定手枪；先行者放置武器，后续队员回收。", "在红色机关放置一把武器，解除红色屏障并取得箱子。", "击碎左侧岩石进入治疗环。"],
        6: ["枪手射击入口右侧门上方目标，Force 回收房内箱子。", "粉色机关需要放置 4 把武器；提前保留无用武器。", "标记箱固定出护甲。", "新月房有陷阱；机器人处理后隔着岩石射击并前进。"],
        7: ["黑暗房北侧高处岩石需用枪打破；Force 可取隐藏箱，其余队员向东。", "击碎岩石露出机关，解除出口屏障。", "穿过出口后的假墙回收盾/甲；下一图区需要 4 面盾。"],
        8: ["按 1–6 顺序踩黄色机关，一人连续前进并用编号口令同步。", "粉色机关需要放置 4 面盾。", "新月房先处理陷阱，再踩中央机关并逐个击破红/蓝火球。"],
    },
    "en": {
        4: ["Split up: one player takes the timed switch south while the others continue east.", "Shoot the target above the door for the fixed handgun; the leader drops a weapon and the trailing player collects the boxes.", "Leave one weapon on the red switch to pass the red barrier and collect the boxes.", "Break the left boulder to reach the healing ring."],
        6: ["A gun user shoots the target above the right-hand door; the Force collects the boxes.", "The pink switch needs four weapons. Save spare weapons in advance.", "The marked box contains fixed armor.", "The crescent room has traps; let an android clear them, then shoot through the rocks."],
        7: ["Use a gun on the high northern boulder in the dark room; the Force can collect the hidden boxes while the others head east.", "Break the boulder to uncover the switch and release the exit barrier.", "Pass through the false wall beyond the gate for shields and armor; four shields are needed in the next area."],
        8: ["Step on yellow switches 1–6 in order while one player advances; call the numbers to synchronize.", "The pink switch requires four shields.", "Clear the crescent-room traps, press the center switch, then destroy each red or blue flame."],
    },
    "ja": {
        4: ["分担：1人が南の時間制スイッチへ、残りは東へ進む。", "扉上の標的を撃って固定ハンドガンを回収。先行役が武器を置き、後続役が箱を取る。", "赤スイッチに武器を1本置き、赤バリア奥の箱を回収。", "左の岩を壊して回復リングへ。"],
        6: ["銃役が入口右の扉上スイッチを撃ち、フォースが箱を回収。", "桃色スイッチには武器4本。不要武器を事前に確保。", "表示位置の箱は固定の鎧。", "三日月部屋は罠あり。アンドロイドが処理後、岩越しに撃って進む。"],
        7: ["暗い部屋の北にある高い岩を銃で破壊。フォースが隠し箱を取り、他は東へ。", "岩を壊してスイッチを出し、出口バリアを解除。", "ゲート奥の隠し壁から盾・鎧を回収。次エリアで盾4個が必要。"],
        8: ["黄色スイッチを1～6の順に踏み、1人が前進。番号を声掛けして同期する。", "桃色スイッチには盾4個が必要。", "三日月部屋の罠を処理し、中央スイッチ後に赤・青の火球を順に撃つ。"],
    },
}

C1_NOTES = {
    "zh": {
        1: ["Force 或 Ranger 回收首房箱子；其余队员直接推进。", "两名强力队员在屏障前留守，另两人继续去踩机关。", "踩机关时无视敌人；最弱队员留守，另一人经 1→1′ 回援。", "清场后派一人向南无视敌人踩粉色机关，其余人在门前等待。", "留守队员踩黄色机关放行；随后继续无视敌人取得下一区机关。"],
        2: ["踩限时绿色机关的队员留守，过门队员进入 1→1′。", "传送后立刻回头进入 2→2′并踩紫色机关；正前方 3 号补给传送耗时，TA 忽略。", "Boss 前 Hunter 将替身娃娃优先交给 Force / Ranger。"],
    },
    "en": {
        1: ["The Force or Ranger collects the first-room boxes while the others advance.", "The two strongest players wait at the barrier while the other pair goes for the switch.", "Ignore enemies while taking the switch; leave the weakest player behind and send the other through warp 1→1′ to help.", "After clearing, send one player south to take the pink switch while the others wait at the door.", "The waiting player takes the yellow switch, then ignores enemies and continues to the next-area switch."],
        2: ["Players who took the timed green switch wait here while the players through the gate use warp 1→1′.", "Turn around immediately after warping and use 2→2′ for the purple switch. Warp 3 leads to slow optional boxes and is skipped in TA.", "Before the boss, Hunters should give spare Scape Dolls to the Force or Ranger."],
    },
    "ja": {
        1: ["最初の箱はフォースかレンジャーが回収し、他は先行。", "強い2人はバリア前で待機し、残り2人がスイッチへ。", "敵を無視してスイッチを踏む。最弱役を残し、もう1人は1→1′で援護へ。", "殲滅後、1人が南へ走り敵を無視して桃色スイッチ。他は扉前待機。", "待機役が黄色スイッチで開門し、そのまま敵を無視して次エリア用スイッチへ。"],
        2: ["時間制の緑スイッチ役は待機。ゲート通過組は1→1′へ。", "転送後すぐ後ろの2→2′へ入り紫スイッチ。正面の3番は箱部屋で、TAでは無視。", "ボス前にハンターの予備スケープドールをフォース／レンジャーへ渡す。"],
    },
}

C1_BADGES = {
    1: [(1, 159, 235), (2, 95, 27), (3, 414, 160), (4, 492, 426), (5, 558, 130)],
    2: [(1, 554, 629), (2, 751, 751)],
}

C1_TERMINALS = {
    1: ((123, 561), (620, 95)),
    2: ((46, 43), (555, 65)),
}

C1_SYMBOLS = {
    1: [
        ("switch", 118, 238, "#61e89f"), ("switch", 405, 146, "#ac65c6"),
        ("switch", 465, 405, "#ffe45c"), ("switch", 575, 94, "#ffe45c"),
        ("switch", 636, 588, "#ac65c6"),
    ],
    2: [
        ("switch", 568, 577, "#ac65c6"), ("switch", 662, 699, "#61e89f"),
    ],
}

C3_NOTES = {
    "zh": {
        9: ["中央有陷阱；机器人射掉或沿边绕行。活塞下机关需与传送队员同步。", "一人经传送点无视敌人取机关，到锁门处通知队友启动活塞机关。", "无视敌人，只射最左目标；无枪则清场后从侧室取得手枪。", "一人按 1→2→3 踩正确机关，逐段解除屏障；其余都是伤害陷阱。"],
        10: ["到传送点后两两分队；先踩入口机关开放 1 号传送。", "1 号传送组踩正确绿色机关，解除另一组通往 2→2′ 的屏障。", "岩石区只打行进方向右侧岩石；其他岩石会爆炸伤人。"],
        11: ["六机关只踩入口视角左下及其右上；其余为陷阱。", "四个隐藏机关分别在高处、水下、草丛及门左；两人通过后两人留守。", "一人压机关，另一人严格沿光路前进；离开光路会触发陷阱。", "光路队员到位后再进房，无视敌人直接踩机关开出口。"],
        12: ["本区很短：从起点直接走主路，第二个房间的隐藏房不进入。"],
        13: ["压机房只碰入口视角右侧的正确机关，其余队员在门边等待。", "按 3:1 分队；最强或最熟练队员单走 1→1′。", "单人组三个机关，主队补最后一个：入口左草丛、左右水下及小岛右侧。", "四机关完成后，紧接走廊有陷阱，提前减速处理。"],
    },
    "en": {
        9: ["The center is trapped; let an android shoot the traps or skirt the edge. Coordinate the piston switch with the warp player.", "One player warps, ignores enemies and takes the switch; call at the locked door so the team can operate the piston.", "Ignore enemies and shoot only the left target. Without a gun, clear the room and take the handgun from the side room.", "One player presses switches 1→2→3 to release each barrier; every other pad is a damage trap."],
        10: ["Split into pairs at the warp; press the entrance switch to open warp 1.", "The warp-1 pair takes the correct green switch, releasing the other pair toward 2→2′.", "Break only the boulders on the right in the direction of travel; the others explode."],
        11: ["At the six-pad puzzle, press only lower-left and the pad above-right from the entrance.", "The four hidden switches are high, underwater, in bushes and left of the door; send two through and leave two behind.", "One holds the switch while the other follows the light path exactly; stepping off triggers traps.", "Enter only after the light-path player is ready, then ignore enemies and run over the exit switch."],
        12: ["This area is short: follow the main route and skip the hidden room off the second room."],
        13: ["In the piston room, touch only the correct switches on the right from the entrance; the others wait by the door.", "Split 3:1; the strongest or most experienced player takes 1→1′ solo.", "The solo player gets three switches and the main team gets the fourth: left bushes, both underwater sides and the island's right side.", "Traps wait in the corridor immediately after all four switches activate."],
    },
    "ja": {
        9: ["中央は罠。アンドロイドが撃つか外周を通る。プレス下スイッチはワープ役と同期。", "1人がワープして敵を無視しスイッチへ。施錠扉で合図し、残りがプレスを作動。", "敵を無視し左端だけ撃つ。銃がなければ殲滅して脇部屋のハンドガンを取る。", "1人が1→2→3の正解スイッチを踏み順番にバリア解除。他はダメージ罠。"],
        10: ["ワープ前で2人ずつ分担。入口スイッチでワープ1を開く。", "ワープ1組が正解の緑スイッチを踏み、残り組の2→2′へのバリアを解除。", "岩は進行方向右側だけ壊す。他は爆発する罠。"],
        11: ["6個の床スイッチは入口から左下とその右上だけ踏む。", "隠し4スイッチは高所・水中・草むら・扉左。2人通過、2人待機。", "1人がスイッチ保持、もう1人が光の道を厳守。外れると罠。", "光路役が到着してから入り、敵を無視して出口スイッチへ。"],
        12: ["短いエリア。主ルートを直進し、2部屋目の隠し部屋は無視。"],
        13: ["プレス部屋は入口から右側の正解だけ触る。他は扉前待機。", "3:1に分担し、最強または熟練者が1→1′を単独担当。", "単独役が3個、主隊が最後の1個。入口左の草、水中左右、小島右。", "4スイッチ後の通路には罠。手前で減速して処理。"],
    },
}

C3_BADGES = {
    9: [(1, 282, 174), (2, 140, 160), (3, 287, 530), (4, 397, 526)],
    10: [(1, 682, 381), (2, 186, 316), (3, 232, 80)],
    11: [(1, 160, 535), (2, 316, 92), (3, 426, 204), (4, 410, 135)],
    12: [],
    13: [(1, 170, 182), (2, 410, 272), (3, 541, 281), (4, 645, 390)],
}

C3_TERMINALS = {
    9: ((735, 251), (77, 712)), 10: ((190, 512), (344, 54)),
    11: ((323, 758), (449, 58)), 12: ((40, 270), (132, 48)),
    13: ((690, 532), (58, 69)),
}

C3_SYMBOLS = {
    9: [("hazard", 145, 515, "#ffe45c"), ("switch", 250, 265, "#61e89f")],
    10: [("rocks", 230, 72, "#ffb04a"), ("switch", 190, 390, "#61e89f")],
    11: [("sequence", 145, 532, "#ffe45c"), ("switch", 316, 50, "#61e89f")],
    12: [],
    13: [("hazard", 630, 400, "#ffe45c"), ("sequence", 520, 270, "#ffe45c")],
}

C4_NOTES = {
    "zh": {
        14: ["TA 可提前左右分队；普通队先集中右路，到 Y 字口再按 1:3 分开。", "留守者先取机关再取箱，无视刷新的敌人，门应在交战前开启。", "右路靠近控制台解锁传送；留守者等第二控制台生效后再传送会合。", "进入右侧房先靠近控制台，不要直接进传送。", "暗房中央机关负责照明，由 Force 或持枪队员留守。"],
        15: ["Y 字口走左侧 1→1′ 才通往出口；先按附近机关破岩，与队友会合后再进下一图区。"],
        16: ["三人先过限时门，一人留后启动绿色限时机关。", "三机关只踩左侧；其余是伤害陷阱，之后立即进入传送。"],
        17: ["暗房清场后，三人穿假墙，一人留守限时机关；过压机后有人踩机关接应尾队。"],
        18: ["Y 字口按 1:3 或 2:2 分队；两边最好都有技术使用者以处理 Pan Arms。", "右路机关组只踩入口视角最右机关。"],
    },
    "en": {
        14: ["TA can split left/right early; otherwise push the right side together and split 1:3 at the Y junction.", "The solo player takes the switch before boxes and ignores the spawning enemies; the door should open before combat.", "The right team approaches the console to reveal the warp; the waiting player uses it only after the second console is active.", "On entering the right room, approach the console first and do not take the warp.", "The center switch lights the dark room; leave the Force or a gun user on it."],
        15: ["At the Y junction, the left warp 1→1′ leads to the exit. Hit the nearby switch to break the rock and regroup before leaving."],
        16: ["Three players pass the timed gate while one stays behind on the green timed switch.", "Touch only the left of the three switches; the others are traps, then enter the warp without hesitation."],
        17: ["After clearing the dark room, three pass the false wall while one holds the timed switch; a player beyond the piston must release the trailer."],
        18: ["Split 1:3 or 2:2 at the Y; each side should have a tech-capable player for Pan Arms.", "The right-side group touches only the rightmost switch from the entrance."],
    },
    "ja": {
        14: ["TAは早めに左右分担。通常は右を集中攻略し、Y字で1:3に分かれる。", "留守役はスイッチ優先、箱は後。出現する敵を無視し戦闘前に開門。", "右組が端末に近づきワープを出す。留守役は2つ目の端末作動後に合流。", "右部屋では最初に端末へ近づき、ワープには入らない。", "暗い部屋は中央スイッチで照明。フォースか銃役が担当。"],
        15: ["Y字は左の1→1′が出口。近くのスイッチで岩を壊し、合流してから次へ。"],
        16: ["3人が時間扉を先行し、1人が緑の時間スイッチを担当。", "3個のうち左だけ踏む。他は罠。その後は迷わずワープへ。"],
        17: ["暗部屋殲滅後、3人が隠し壁へ、1人が時間スイッチ。プレス通過後に尾行役を通す。"],
        18: ["Y字で1:3または2:2。各側にテク使用者を置きパンアームズ対策。", "右側組は入口から右端のスイッチだけ踏む。"],
    },
}

C4_BADGES = {
    14: [(1, 440, 670), (2, 595, 380), (3, 390, 28), (4, 860, 250), (5, 282, 312)],
    15: [(1, 197, 77)], 16: [(1, 112, 463), (2, 181, 235)],
    17: [(1, 125, 455)], 18: [(1, 50, 500), (2, 180, 365)],
}
C4_TERMINALS = {
    14: ((245, 690), (92, 100)), 15: ((50, 270), (317, 94)),
    16: ((267, 490), (50, 42)), 17: ((45, 263), (410, 470)),
    18: ((190, 650), (292, 32)),
}
C4_SYMBOLS = {
    14: [("hazard", 330, 690, "#ffe45c"), ("switch", 540, 111, "#39d6ff"), ("switch", 860, 268, "#39d6ff")],
    15: [("rocks", 270, 105, "#ffb04a"), ("switch", 235, 64, "#61e89f")],
    16: [("switch", 145, 371, "#61e89f"), ("sequence", 148, 226, "#ffe45c")],
    17: [("sequence", 442, 110, "#ffe45c"), ("switch", 245, 460, "#61e89f")],
    18: [("sequence", 200, 365, "#ffe45c"), ("switch", 40, 445, "#ffb04a")],
}

C5_NOTES = {
    "zh": {
        20: ["暗房照明机关在入口视角左后方房间，踩橙色机关。", "下一个房间的机关会升起炮台；边走边踩可避开射击，出现后由 Ranger 处理。", "后半广间附近的箱子可交给 Force 回收；治疗环处的炮台直接无视。"],
        21: ["第二房机关会升起炮台；开门后直接无视。", "下一组炮台需要处理后再推进。"],
        22: ["四岔地形中央机关开门，同时会升起炮台。", "暗房只踩右后方粉色机关；附近地板机关不要碰。", "后半纵长屏障房，前进前先触碰入口处控制台。"],
        23: ["从入口视角进入左侧 1 号传送点。", "传送后立刻回头穿过假墙，进入通往下一区的传送点。"],
        24: ["第二房清场后可让 Force 回收箱子；凹形地带有陷阱，先用 Trap Vision。", "暗房照明机关在左后方；随后两处炮台都直接跑过。", "射击门上方目标开门，不要停在炮台射线上。"],
    },
    "en": {
        20: ["The dark-room light is the orange switch in the rear-left room from the entrance.", "The next floor switch raises turrets; keep moving across it and let the Ranger destroy them.", "The Force can collect the late boxes. Ignore the turrets at the healing ring."],
        21: ["The second-room switch raises turrets; ignore them once the door opens.", "Destroy the next turret group before advancing."],
        22: ["The center switch in the four-way room opens the door and raises turrets.", "In the dark room, press only the rear-right pink switch; do not touch the nearby floor pad.", "Touch the console at the entrance to the long barrier room before moving on."],
        23: ["Take warp 1 on the left as viewed from the entrance.", "After warping, turn around immediately, pass through the false wall and take the next-area warp."],
        24: ["After clearing the second room, the Force may collect the boxes. Use Trap Vision in the recessed trap section.", "The dark-room light is rear-left; run through both later turret sections.", "Shoot the target above the door and keep out of the turret line."],
    },
    "ja": {
        20: ["暗い部屋は入口から左奥のオレンジスイッチで点灯。", "次の床スイッチで砲台が出る。歩きながら踏み、レンジャーが破壊。", "後半の箱はフォースが回収可能。温泉の砲台は無視。"],
        21: ["2部屋目のスイッチで砲台が出る。開門後は無視。", "次の砲台は処理してから進む。"],
        22: ["4分岐中央のスイッチで開門し、砲台も出現。", "暗い部屋は右奥の桃色だけ踏む。近くの床スイッチは触らない。", "後半の縦長バリア部屋は入口の端末に触れてから進む。"],
        23: ["入口から見て左のワープ1へ入る。", "転送後すぐ後ろの隠し通路を抜け、次エリアのワープへ。"],
        24: ["2部屋目殲滅後、フォースが箱を回収可。凹型地形はトラップビジョン。", "暗い部屋は左奥で点灯。その後の砲台2か所は走り抜ける。", "扉上の標的を撃って開門し、砲台の射線に止まらない。"],
    },
}

C5_BADGES = {
    20: [(1, 526, 355), (2, 862, 183), (3, 472, 414)],
    21: [(1, 272, 59), (2, 552, 194)],
    22: [(1, 176, 415), (2, 676, 440), (3, 450, 560)],
    23: [(1, 560, 135), (2, 224, 58)],
    24: [(1, 579, 159), (2, 742, 551), (3, 895, 461)],
}
C5_TERMINALS = {
    20: ((88, 158), (1212, 115)), 21: ((80, 138), (654, 166)),
    22: ((40, 25), (884, 207)), 23: ((78, 435), (246, 24)),
    24: ((91, 35), (1120, 572)),
}
C5_SYMBOLS = {
    20: [("switch", 559, 285, "#ffb04a"), ("hazard", 558, 434, "#ffe45c"), ("hazard", 840, 186, "#ffe45c")],
    21: [("hazard", 251, 38, "#ffe45c"), ("hazard", 542, 166, "#ffe45c")],
    22: [("switch", 197, 365, "#ffb04a"), ("switch", 644, 443, "#ff5ca8"), ("hazard", 155, 414, "#ffe45c")],
    23: [("switch", 525, 154, "#39d6ff")],
    24: [("switch", 556, 159, "#ffb04a"), ("hazard", 662, 175, "#ffe45c"), ("hazard", 895, 495, "#ffe45c")],
}

C6_NOTES = {
    "zh": {
        25: ["第三个小房的墙面机关无视；暗房先去入口视角左后方开灯。", "四机关只踩入口视角左后方；房内若只有少量弱敌，可清掉争取掉落。"],
        26: ["主路线为单行；隐藏房由 Force 或 Ranger 回收箱子，其中固定有 Buster。"],
        27: ["第三个小房机关不要踩；最弱队员去暗房开灯并回收箱子。", "1→1′ 右侧有箱子；北侧治疗环仅非 TA 时考虑。"],
        28: ["全员先走 1→1′；一人进入九层屏障迷宫，另外三人按 1–8 顺序踩机关，最后再踩 1。", "推荐分工：一人负责 1/7/5，一人负责 3/6，一人负责 2/4/8；迷宫内队员到中心后启动机关。", "假墙后的箱房有 Zonde 陷阱；无大剑、长刀或 Gizonde 时直接放弃。随后走 2→2′、3→3′。"],
        29: ["四机关只踩入口视角左前方。", "暗房必须清场后才能开灯；先用小地图判断双方位置。", "Boss 前清场后派一人返回限时机关，其余分房回收；机关会同时升起陷阱，留守队员先打掉。"],
    },
    "en": {
        25: ["Ignore the wall switch in the third small room; light the dark room from the rear-left room first.", "At the four-pad puzzle, press only rear-left from the entrance. Clear a few easy enemies if the drop chance is worthwhile."],
        26: ["The main route is linear. A Force or Ranger takes the hidden-room boxes; one contains a fixed Buster."],
        27: ["Do not press the switch in the third small room. The weakest player lights the dark room and opens its boxes.", "Boxes sit to the right of warp 1→1′. Use the northern healing ring only outside TA."],
        28: ["Everyone takes 1→1′. One enters the nine-barrier maze while the other three press 1–8 in order, then 1 again.", "Efficient split: one player handles 1/7/5, one 3/6, and one 2/4/8; the maze player activates the center switch.", "False-wall box rooms contain Zonde traps. Skip without a sword, partisan or Gizonde, then use 2→2′ and 3→3′."],
        29: ["At the four-pad puzzle, press only front-left from the entrance.", "The light switch unlocks only after the dark room is clear; use the minimap to fight before then.", "After the boss-hall wave, send one player back to the timed switch while the others collect boxes. The switch also raises a trap; clear it for the returning player."],
    },
    "ja": {
        25: ["3つ目の小部屋の壁スイッチは無視。暗い部屋は入口から左奥で先に点灯。", "4スイッチは入口から左奥だけ踏む。弱い敵が少数ならドロップ狙いで倒してもよい。"],
        26: ["最短ルートは一本道。隠し部屋はフォースかレンジャーが回収し、固定バスターあり。"],
        27: ["3つ目の小部屋のスイッチは踏まない。最弱役が暗部屋を点灯して箱を回収。", "1→1′の右に箱。北の回復リングは非TA時のみ。"],
        28: ["全員1→1′へ。1人が9枚バリア迷路、外の3人が1～8順、最後に再び1を踏む。", "分担例：1/7/5、3/6、2/4/8。迷路役は中央でスイッチを作動。", "隠し箱部屋はゾンデ罠。大剣・パルチザン・ギゾンデなしなら無視し、2→2′、3→3′へ。"],
        29: ["4スイッチは入口から左手前だけ踏む。", "暗い部屋は殲滅後のみ点灯可能。先にレーダーで位置を判断。", "ボス前殲滅後、1人が時間スイッチへ戻り他は箱回収。作動で罠も出るため待機組が破壊。"],
    },
}
C6_BADGES = {
    25: [(1, 600, 443), (2, 880, 516)], 26: [(1, 336, 22)],
    27: [(1, 403, 452), (2, 828, 367)],
    28: [(1, 456, 319), (2, 410, 152), (3, 80, 34)],
    29: [(1, 121, 282), (2, 870, 278), (3, 920, 402)],
}
C6_TERMINALS = {
    25: ((38, 20), (884, 786)), 26: ((78, 204), (806, 122)),
    27: ((39, 16), (988, 386)), 28: ((267, 499), (355, 34)),
    29: ((280, 18), (808, 405)),
}
C6_SYMBOLS = {
    25: [("switch", 631, 376, "#ffe45c"), ("switch", 906, 509, "#ffb04a"), ("hazard", 363, 433, "#ffe45c")],
    26: [("switch", 298, 18, "#61e89f")],
    27: [("switch", 414, 389, "#ffb04a"), ("heal", 691, 446, "#78f05f")],
    28: [("sequence8", 502, 236, "#ffe45c")],
    29: [("switch", 126, 251, "#ff4d4d"), ("switch", 879, 226, "#ffb04a"), ("hazard", 848, 440, "#ffe45c")],
}

C7_NOTES = {
    "zh": {
        31: ["左侧箱房有 Zonde 陷阱；队伍无枪就跳过。瀑布后箱子无陷阱。", "三人原地等，一人踩机关；机关会启动两陷阱，走右上传送并踩机关开放左下传送。", "击碎标记碎石可回收额外箱子。"],
        32: ["一人向东击碎岩石解除屏障，既开放箱子也避开后续陷阱。", "限时门启动时会触发 Foie 陷阱，直接无视。", "走先前开放的内侧路线，避开控制台；普通路线靠近控制台会启动多枚 Foie 陷阱。"],
        33: ["标记箱子伴随陷阱；缩小机关会越来越小，注意脚下。", "穿石捷径仍可挤过，但不熟练时走正常路线更稳定。", "出口选择左侧传送点。"],
        34: ["击碎瀑布后的岩石进入治疗环。", "机关组只踩图示正确机关。", "房间中央机关负责照明且复位很快；留一人持续踩住，清场后继续为下一暗房照明。"],
        35: ["三组双传送依次选左、左、右，一人取机关，其余原地等待。", "沿通道左侧前进以避开 Foie 陷阱。", "击碎标记岩石才能进入照明机关。"],
    },
    "en": {
        31: ["The left box room has a Zonde trap; skip it without a gun. Boxes behind the waterfall are safe.", "Three wait while one takes the pad. It triggers two traps; use the upper-right warp and hold the pad to open the lower-left warp.", "Break the marked rubble for additional boxes."],
        32: ["Send one player east to break the boulder and release the gate, opening boxes and a later trap-free route.", "The timed door triggers Foie traps; ignore them.", "Use the newly opened inner path and avoid the console. The obvious route near it triggers several Foie traps."],
        33: ["The marked boxes are trapped. The shrinking pads become progressively smaller, so watch your footing.", "The rock squeeze shortcut still works, but the normal route is more reliable without practice.", "Take the left warp at the exit."],
        34: ["Break the boulder behind the waterfall to reach the healing ring.", "Activate only the marked switches.", "The center light pad resets quickly. Leave one player on it during the room and for the next dark room."],
        35: ["Across the three pairs of warps choose left, left, then right. One player gets the switch while the others wait.", "Stay along the left side of the path to avoid Foie traps.", "Break the marked boulder to access the light switch."],
    },
    "ja": {
        31: ["左の箱部屋はゾンデ罠。銃なしなら無視。滝裏の箱は罠なし。", "3人待機、1人が床スイッチ。罠2個が出るので右上ワープ後にスイッチを踏み左下を開く。", "瓦礫を壊して追加箱を回収。"],
        32: ["1人が東の岩を壊しゲート解除。箱と後半の安全ルートを開く。", "時間扉でフォイエ罠が出るが無視。", "先に開けた内側を通り端末を避ける。通常路で端末前を通るとフォイエ罠多数。"],
        33: ["表示箱は罠あり。縮小スイッチは小さくなるので足元注意。", "岩抜け短縮は可能だが、未経験なら通常路が安定。", "出口は左ワープ。"],
        34: ["滝裏の岩を壊し回復リングへ。", "表示された正解スイッチだけ踏む。", "中央の照明スイッチは復帰が早い。1人が踏み続け、次の暗部屋も照らす。"],
        35: ["3組のワープを左・左・右の順。1人がスイッチ、他は待機。", "フォイエ罠回避のため通路左寄りを進む。", "岩を壊して照明スイッチへ。"],
    },
}
C7_BADGES = {
    31: [(1, 776, 438), (2, 576, 157), (3, 420, 580)],
    32: [(1, 290, 181), (2, 362, 276), (3, 385, 88)],
    33: [(1, 356, 517), (2, 51, 451), (3, 490, 194)],
    34: [(1, 430, 432), (2, 50, 286), (3, 313, 120)],
    35: [(1, 212, 106), (2, 245, 439), (3, 535, 708)],
}
C7_TERMINALS = {
    31: ((815, 526), (818, 803)), 32: ((60, 265), (655, 175)),
    33: ((405, 751), (659, 50)), 34: ((439, 521), (558, 130)),
    35: ((867, 250), (550, 845)),
}
C7_SYMBOLS = {
    31: [("hazard", 205, 300, "#ffe45c"), ("rocks", 558, 502, "#ffb04a")],
    32: [("rocks", 336, 307, "#ffb04a"), ("hazard", 453, 147, "#ffe45c")],
    33: [("hazard", 170, 468, "#ffe45c"), ("rocks", 510, 178, "#ffb04a")],
    34: [("rocks", 472, 424, "#ffb04a"), ("switch", 97, 285, "#ff5ca8")],
    35: [("sequence", 184, 135, "#ffe45c"), ("hazard", 205, 440, "#ffe45c"), ("rocks", 560, 702, "#ffb04a")],
}

C8_NOTES = {
    "zh": {
        36: ["前两房报告武器总数；凑齐 4 把可走武器机关捷径，否则通常走 2→2′。", "并排的 3/4 传送选左侧 3→3′，落地后跑过炮台；盾牌 4 件机关和小房传送都无视。", "暗房机关在毒罐下；大广间箱子由 Force 注意毒罐回收，出口箱房炮台无视。"],
        37: ["走 1→1′ 后，从落点视角进入右侧门，沿主路线直达出口。"],
        38: ["本区所有传送点都不要进入；第二房侧室箱子可在开路期间回收。", "至少两人负责开路，通路就绪后再通知留守者踩限时机关。", "大广间后的分岔派一人向右，其余在暗房门口待命；机关启动后避开炮台冲入暗房。"],
        39: ["第二通道房击碎岩石推进；破岩会升起炮台，优先用机枪远程处理。", "进路右侧的岩石和机关都是陷阱，全部无视。", "1→1′ 后的屏障房，踩入口左侧机关背后的隐藏机关。"],
        40: ["首房直行箱子交给 Force；两组四武器机关后分队，强者走南侧红线，其余向北。", "蓝线至少两人：先走 2→2′ 开机关，再走 3→3′，不要踩中央机关。", "大广间传送与 MAG 门后的治疗环都无视。"],
    },
    "en": {
        36: ["Call the team's weapon count after the first two rooms. Four weapons unlock the shortcut; otherwise use 2→2′.", "At paired warps 3/4, take left 3→3′ and run past the turrets. Ignore the four-shield switch and small-room warp.", "The dark-room switch is under the poison pot. The Force collects hall boxes carefully; ignore turrets in the exit box room."],
        37: ["After 1→1′, take the right-hand door from the arrival point and follow the main route."],
        38: ["Do not enter any warp in this area. Collect the second-room side boxes while opening the route.", "Use at least two players to open the path; only then call for the waiting player to press the timed switch.", "After the large hall send one right while the others wait at the dark-room door; dodge the turrets when the switch fires."],
        39: ["Break the boulders in the second corridor room; they raise turrets, so a mechgun is ideal.", "Ignore the boulder and switch on the right side of travel; both are traps.", "After 1→1′, press the hidden switch behind the first switch on the left."],
        40: ["The Force collects the first-room boxes. After the paired four-weapon switches, the strongest player takes the southern red route and the others north.", "The blue route needs two players: use 2→2′, activate the switch, then 3→3′; do not press the center pad.", "Ignore the large-hall warp and the healing ring behind the MAG door."],
    },
    "ja": {
        36: ["最初の2部屋で武器数を報告。4本あれば短縮、なければ通常は2→2′。", "並ぶ3/4は左の3→3′。砲台を走り抜け、盾4個スイッチと小部屋ワープは無視。", "暗部屋スイッチは毒壺の下。大広間の箱はフォース、出口箱部屋の砲台は無視。"],
        37: ["1→1′後、到着位置から右の扉へ進み主ルートを直進。"],
        38: ["このエリアのワープは全て入らない。2部屋目の脇箱は通路確保中に回収。", "2人以上で通路を開け、完了後に待機役へ時間スイッチの合図。", "大広間後は1人右、残りは暗部屋前。作動後に砲台を避けて突入。"],
        39: ["2つ目の通路部屋で岩を破壊。砲台が出るためマシンガン推奨。", "進行方向右の岩とスイッチは罠なので無視。", "1→1′後、入口左のスイッチの裏にある隠しスイッチを踏む。"],
        40: ["最初の箱はフォース。武器4本スイッチ2個後、最強役が南の赤、残りは北。", "青ルートは2人必要。2→2′でスイッチ後3→3′、中央は踏まない。", "大広間ワープとMAG扉先の温泉は無視。"],
    },
}
C8_BADGES = {
    36: [(1, 317, 411), (2, 406, 398), (3, 495, 309)],
    37: [(1, 220, 180)], 38: [(1, 650, 415), (2, 980, 410), (3, 1100, 410)],
    39: [(1, 420, 499), (2, 515, 318), (3, 245, 20)],
    40: [(1, 665, 474), (2, 649, 325), (3, 680, 246)],
}
C8_TERMINALS = {
    36: ((79, 334), (1370, 444)), 37: ((158, 520), (70, 181)),
    38: ((78, 42), (1095, 616)), 39: ((76, 379), (887, 319)),
    40: ((95, 374), (1304, 215)),
}
C8_SYMBOLS = {
    36: [("sequence", 365, 232, "#ffe45c"), ("hazard", 1042, 345, "#ffe45c")],
    37: [("switch", 193, 205, "#ffb04a")],
    38: [("hazard", 1060, 408, "#ffe45c"), ("switch", 758, 420, "#61e89f")],
    39: [("rocks", 320, 374, "#ffb04a"), ("hazard", 430, 270, "#ffe45c")],
    40: [("sequence", 500, 336, "#ffe45c"), ("switch", 649, 323, "#61e89f")],
}

C9_NOTES = {
    "zh": {
        41: ["井字房射击侧面机关；门开后主队走右下传送，Force 走左下 2→2′ 回收箱子。", "Force 先在 MAG 机关放置 MAG，为下一区暗房照明。"],
        42: ["首次分队建议三人走左传送、一人走右；左路更快，右路需要破岩。", "传送箱房会触发 Foie 陷阱；先在外用枪打箱，再传送进去清陷阱。", "落点机关踩行进方向左侧；随后左组走 3→3′，右组从门进入。"],
        43: ["首房击碎右后方岩石开灯；下一房可摸黑打，否则移动中在左机关放 MAG。", "中央地板机关会升起四枚 Foie；第四个远端机关还会触发 Zonde，第三个完成后留守者移到门边。", "最后一人开第四机关后立即走 2→2′；长廊前暗房的照明机关必须用枪射击。"],
        44: ["清场后 Force 压入口机关；枪手单走西路，两人走东路，西路完成后回援。", "开箱廊只踩入口视角右侧机关；错误提示音可无视，另一个机关会关灯。", "岩石箱区有天花陷阱；中央平台箱子绕路太长，通常放弃。"],
        45: ["第三个小房的双机关会让上一暗房出现 Zonde 陷阱。", "8 武器 + 8 盾捷径只在不牺牲主装备且确有时间收益时启用；机关会触发 Foie。", "大房墙面与下一门上机关都是关灯假机关，持枪者不要误射；后段中央机关也会触发陷阱。"],
    },
    "en": {
        41: ["Shoot the side switch in the hash room. The main team takes lower-right; the Force uses lower-left 2→2′ for boxes.", "The Force leaves a MAG on the MAG switch to light the next dark area."],
        42: ["Split three left and one right at the first warps. Left is faster; right requires breaking rubble.", "The box-room warp triggers Foie traps. Shoot the boxes from outside first, then warp in with a clear line to the traps.", "At arrival press the switch on the left in the direction of travel; the left team then uses 3→3′ while the right team enters through the door."],
        43: ["Break the rear-right boulder for the first light. Fight the next room dark or place a MAG on the left switch while moving.", "The center pad raises four Foie traps; the fourth remote switch also triggers Zonde. Move the pad holder to the door after switch three.", "The last switch player immediately uses 2→2′. The light before the long corridor must be shot with a gun."],
        44: ["After clearing, the Force holds the entrance pad; a gun user goes west and two go east, then the west player helps east.", "In the box hall press only the right-hand switch from the entrance. Ignore the error sound; the other switch turns off the lights.", "Rubble boxes have ceiling traps. The central-platform boxes are usually not worth the detour."],
        45: ["Both switches in the third small room activate Zonde traps in the previous dark room.", "Use the eight-weapon/eight-shield shortcut only without sacrificing equipped gear and when the time justifies it; every pad triggers Foie.", "The wall switch and next door target are fake light-off switches. Gun users must not hit them; a later center pad also triggers traps."],
    },
    "ja": {
        41: ["＃部屋は側面スイッチを撃つ。主隊は右下、フォースは左下2→2′で箱回収。", "フォースはMAGスイッチにMAGを置き、次の暗部屋を照らす。"],
        42: ["最初は左3・右1。左が速く、右は瓦礫破壊が必要。", "箱部屋ワープでフォイエ罠。外から銃で箱を壊してから入り、罠を撃つ。", "到着後は進行方向左のスイッチ。左組は3→3′、右組は扉から入る。"],
        43: ["最初は右奥の岩で点灯。次は暗いまま戦うか、移動しながら左スイッチにMAG。", "中央床でフォイエ4個、4つ目の遠隔スイッチでゾンデも出る。3つ目後に床役は扉際へ。", "最後の役は即2→2′。長廊下前の照明は銃で撃つ必要あり。"],
        44: ["殲滅後フォースが入口スイッチ。銃役1人が西、2人が東、西終了後に援護。", "箱廊は入口から右だけ踏む。エラー音は無視し、もう一方は消灯する。", "岩箱は天井罠あり。中央台の箱は通常割に合わない。"],
        45: ["3つ目の小部屋の2スイッチで前の暗部屋にゾンデ罠。", "武器8・盾8短縮は装備を犠牲にせず時間価値がある時だけ。各床でフォイエ罠。", "壁と次の扉上は消灯ダミー。銃役は撃たない。後半中央床も罠。"],
    },
}
C9_BADGES = {
    41: [(1, 247, 268), (2, 388, 374)],
    42: [(1, 624, 400), (2, 241, 149), (3, 316, 513)],
    43: [(1, 317, 414), (2, 245, 373), (3, 430, 325)],
    44: [(1, 260, 388), (2, 294, 548), (3, 467, 230)],
    45: [(1, 1000, 763), (2, 1050, 434), (3, 930, 205)],
}
C9_TERMINALS = {
    41: ((190, 17), (192, 1100)), 42: ((428, 134), (70, 17)),
    43: ((508, 879), (1060, 17)), 44: ((260, 145), (640, 17)),
    45: ((1136, 843), (80, 248)),
}
C9_SYMBOLS = {
    41: [("sequence", 125, 365, "#ffe45c"), ("switch", 390, 340, "#ffe45c")],
    42: [("rocks", 514, 480, "#ffb04a"), ("hazard", 300, 507, "#ffe45c")],
    43: [("rocks", 474, 346, "#ffb04a"), ("hazard", 715, 225, "#ffe45c")],
    44: [("switch", 260, 347, "#39d6ff"), ("rocks", 95, 365, "#ffb04a"), ("hazard", 460, 205, "#ffe45c")],
    45: [("sequence8", 1210, 126, "#ffe45c"), ("hazard", 1088, 750, "#ffe45c")],
}

C2_BADGES = {
    4: [(1, 131, 409), (2, 775, 234), (3, 849, 489), (4, 847, 634)],
    6: [(1, 53, 196), (2, 274, 530), (3, 554, 463), (4, 654, 381)],
    7: [(1, 224, 248), (2, 318, 213), (3, 431, 224)],
    8: [(1, 200, 323), (2, 351, 320), (3, 827, 354)],
}

C2_TERMINALS = {
    4: ((60, 324), (748, 550)),
    6: ((247, 151), (753, 115)),
    7: ((72, 134), (427, 273)),
    8: ((194, 60), (940, 70)),
}

C2_SYMBOLS = {
    4: [
        ("switch", 219, 338, "#61e89f"), ("switch", 794, 238, "#ffe45c"),
        ("switch", 879, 509, "#ff4d4d"), ("heal", 149, 500, "#78f05f"),
        ("rocks", 847, 638, "#ffb04a"),
    ],
    6: [
        ("switch", 291, 432, "#ff5ca8"), ("switch", 530, 459, "#61e89f"),
        ("rocks", 626, 404, "#ffb04a"),
    ],
    7: [
        ("rocks", 224, 247, "#ffb04a"), ("rocks", 338, 242, "#ffb04a"),
        ("switch", 335, 229, "#ff5ca8"), ("switch", 329, 278, "#78f05f"),
    ],
    8: [
        ("sequence", 190, 324, "#ffe45c"), ("switch", 364, 230, "#ff5ca8"),
        ("hazard", 828, 354, "#ffe45c"),
    ],
}


def label(text: str, x: int, y: int, *, anchor: str = "start", accent: str = "#dff8ff") -> str:
    return (
        f'<text x="{x}" y="{y}" text-anchor="{anchor}" fill="{accent}" '
        'font-family="system-ui,-apple-system,sans-serif" font-size="20" '
        f'font-weight="800" letter-spacing=".04em">{html.escape(text)}</text>'
    )


def wrap_text(text: str, width: int, size: int) -> list[str]:
    def advance(character: str) -> float:
        if unicodedata.east_asian_width(character) in {"W", "F"}:
            return size
        if character.isspace():
            return size * 0.34
        return size * 0.62

    lines: list[str] = []
    line = ""
    line_width = 0.0
    for character in text:
        character_width = advance(character)
        if line and line_width + character_width > width:
            lines.append(line.rstrip())
            line = ""
            line_width = 0.0
        line += character
        line_width += character_width
    if line:
        lines.append(line.rstrip())
    return lines


def wrapped_lines(text: str, x: int, y: int, width: int, *, size: int = 17) -> str:
    """Wrap localized SVG copy without relying on browser-only foreignObject."""
    lines = wrap_text(text, width, size)
    tspans = "".join(
        f'<tspan x="{x}" dy="{0 if index == 0 else 24}">{html.escape(line)}</tspan>'
        for index, line in enumerate(lines)
    )
    return f'<text x="{x}" y="{y}" fill="#bcd7ea" font-family="system-ui,-apple-system,sans-serif" font-size="{size}" font-weight="650">{tspans}</text>'


def remove_small_components(mask: Image.Image, minimum: int = 90) -> Image.Image:
    """Remove disconnected annotation glyphs while retaining map geometry."""
    width, height = mask.size
    pixels = mask.load()
    visited = [[False] * width for _ in range(height)]
    clean = Image.new("1", mask.size, 1)
    clean_pixels = clean.load()
    for y in range(height):
        for x in range(width):
            if visited[y][x] or pixels[x, y] != 0:
                continue
            component: list[tuple[int, int]] = []
            queue = deque([(x, y)])
            visited[y][x] = True
            while queue:
                current_x, current_y = queue.popleft()
                component.append((current_x, current_y))
                for target_x, target_y in ((current_x - 1, current_y), (current_x + 1, current_y), (current_x, current_y - 1), (current_x, current_y + 1)):
                    if 0 <= target_x < width and 0 <= target_y < height and not visited[target_y][target_x] and pixels[target_x, target_y] == 0:
                        visited[target_y][target_x] = True
                        queue.append((target_x, target_y))
            xs = [point[0] for point in component]
            ys = [point[1] for point in component]
            component_width = max(xs) - min(xs) + 1
            component_height = max(ys) - min(ys) + 1
            is_map_geometry = (
                len(component) >= 250
                or component_width >= 90
                or component_height >= 30
            )
            if len(component) >= minimum and is_map_geometry:
                for component_x, component_y in component:
                    clean_pixels[component_x, component_y] = 0
    return clean


def tip_marker(letter: str, x: int, y: int) -> str:
    return f'''<g transform="translate({x} {y})" filter="url(#shadow)">
  <path d="M0-23 23 0 0 23-23 0Z" fill="#ffb04a" stroke="#061329" stroke-width="4"/>
  <text y="7" text-anchor="middle" fill="#08162b" font-family="system-ui,-apple-system,sans-serif" font-size="19" font-weight="950">{letter}</text>
</g>'''


def numbered_badge(number: int, x: int, y: int) -> str:
    return f'''<g transform="translate({x} {y})" filter="url(#shadow)">
  <rect x="-15" y="-19" width="30" height="30" rx="7" fill="#ffe45c" stroke="#061329" stroke-width="3"/>
  <text y="4" text-anchor="middle" fill="#08162b" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="950">{number}</text>
</g>'''


def terminal_marker(kind: str, x: int, y: int, text: str) -> str:
    color = "#39d6ff" if kind == "start" else "#ff5ca8"
    direction = "M0 18-14 42h28Z" if kind == "exit" else "M0-18-14-42h28Z"
    label_y = 61 if kind == "exit" else -48
    return f'''<g transform="translate({x} {y})" filter="url(#shadow)">
  <circle r="14" fill="{color}" stroke="#061329" stroke-width="4"/><path d="{direction}" fill="{color}" stroke="#061329" stroke-width="4"/>
  <text y="{label_y}" text-anchor="middle" fill="{color}" font-family="system-ui,-apple-system,sans-serif" font-size="17" font-weight="900">{html.escape(text)}</text>
</g>'''


def semantic_symbol(kind: str, x: int, y: int, color: str) -> str:
    if kind == "switch":
        body = f'<rect x="-24" y="-7" width="48" height="14" rx="7" fill="{color}"/>'
    elif kind == "heal":
        body = f'<circle r="17" fill="{color}"/><path d="M-8 0h16M0-8v16" stroke="#08162b" stroke-width="5"/>'
    elif kind == "rocks":
        body = f'<path d="M-30 10-22-12-8-5 2-20 14-5 29-13 34 10 16 18 1 10-12 20Z" fill="{color}"/>'
    elif kind == "sequence":
        body = ''.join(
            f'<circle cx="{((index - 1) % 3 - 1) * 24}" cy="{((index - 1) // 3) * 24 - 12}" r="10" fill="{color}"/><text x="{((index - 1) % 3 - 1) * 24}" y="{((index - 1) // 3) * 24 - 8}" text-anchor="middle" font-size="11" font-weight="950" fill="#08162b">{index}</text>'
            for index in range(1, 7)
        )
    elif kind == "sequence8":
        body = ''.join(
            f'<circle cx="{((index - 1) % 4 - 1.5) * 23}" cy="{((index - 1) // 4) * 24 - 12}" r="10" fill="{color}"/><text x="{((index - 1) % 4 - 1.5) * 23}" y="{((index - 1) // 4) * 24 - 8}" text-anchor="middle" font-size="11" font-weight="950" fill="#08162b">{index}</text>'
            for index in range(1, 9)
        )
    else:
        body = f'<path d="M0-27 26 19h-52Z" fill="{color}"/><path d="M0-12v17M0 12v2" stroke="#08162b" stroke-width="5" stroke-linecap="round"/>'
    return f'<g transform="translate({x} {y})" stroke="#061329" stroke-width="4" stroke-linejoin="round" filter="url(#shadow)">{body}</g>'


def notes_panel(notes: list[str], words: dict[str, str], width: int, y: int) -> tuple[str, int]:
    columns = 2 if width >= 700 else 1
    column_width = (width - 72) // columns
    column_notes = [notes[column::columns] for column in range(columns)]
    column_heights = []
    for entries in column_notes:
        column_heights.append(sum(max(68, len(wrap_text(note, column_width - 54, 15)) * 24 + 28) for note in entries))
    height = 72 + max(column_heights, default=0) + 36
    items: list[str] = []
    offsets = [66] * columns
    for index, note in enumerate(notes):
        column = index % columns
        x = 26 + column * column_width
        item_y = offsets[column]
        items.append(numbered_badge(index + 1, x + 14, item_y + 4))
        items.append(wrapped_lines(note, x + 42, item_y, column_width - 54, size=15))
        offsets[column] += max(68, len(wrap_text(note, column_width - 54, 15)) * 24 + 28)
    return f'''<g transform="translate(18 {y})">
  <rect width="{width - 36}" height="{height}" rx="14" fill="#0b2745" stroke="#2c648b" stroke-width="2"/>
  <text x="24" y="34" fill="#e7f9ff" font-family="system-ui,-apple-system,sans-serif" font-size="19" font-weight="900">{html.escape(words["tips"])}</text>
  {''.join(items)}
  <text x="{width - 60}" y="{height - 16}" text-anchor="end" fill="#7698b1" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="650">{html.escape(words["sources"])}</text>
</g>''', height


def trace_mask(mask: Image.Image, color: str) -> str:
    """Convert a clean binary semantic layer to smooth SVG paths."""
    with tempfile.TemporaryDirectory(prefix="challenge-map-") as directory:
        bitmap = Path(directory) / "layer.pbm"
        vector = Path(directory) / "layer.svg"
        mask.save(bitmap)
        subprocess.run(
            ["potrace", str(bitmap), "--svg", "--flat", "--turdsize", "3", "--alphamax", "1", "--output", str(vector)],
            check=True,
            capture_output=True,
        )
        content = vector.read_text(encoding="utf-8")
    group = re.search(r'(<g transform="[^"]+"[^>]*>.*</g>)', content, re.DOTALL)
    if not group:
        raise RuntimeError("Potrace returned no SVG group")
    return re.sub(r'fill="#000000"', f'fill="{color}"', group.group(1), count=1)


def source_layers(area: int) -> tuple[int, int, str, str, str]:
    """Recover geometry and route layers from the clean PSO World source scan."""
    source = Image.open(SOURCE / f"area_{area:02d}.png").convert("RGB")
    width, height = source.size
    pixels = source.load()
    boundary = Image.new("1", source.size, 1)
    route = Image.new("1", source.size, 1)
    boundary_pixels = boundary.load()
    route_pixels = route.load()
    boundary_floor = 45 if area >= 20 else 105
    for y in range(height):
        for x in range(width):
            red, green, blue = pixels[x, y]
            neutral = max(red, green, blue) - min(red, green, blue) <= 10
            is_boundary = neutral and boundary_floor <= red <= 225
            is_route = red >= 210 and green <= 125 and blue <= 145
            if is_boundary:
                boundary_pixels[x, y] = 0
            if is_route:
                route_pixels[x, y] = 0

    # Heal gaps where source symbols cross room boundaries before flooding.
    if area not in {15, 16, 17, 18}:
        boundary = remove_small_components(boundary)
    healed_boundary = boundary.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
    healed_pixels = healed_boundary.load()
    # Build the flood barrier only from the cleaned geometry. Using the raw
    # neutral pixels here reintroduced removed source labels as holes in rooms.
    expanded = [[False] * width for _ in range(height)]
    for y in range(height):
        for x in range(width):
            if healed_pixels[x, y] == 0:
                for offset_y in (-1, 0, 1):
                    for offset_x in (-1, 0, 1):
                        target_x, target_y = x + offset_x, y + offset_y
                        if 0 <= target_x < width and 0 <= target_y < height:
                            expanded[target_y][target_x] = True
    exterior = [[False] * width for _ in range(height)]
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        if exterior[y][x] or expanded[y][x]:
            continue
        exterior[y][x] = True
        for target_x, target_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= target_x < width and 0 <= target_y < height:
                queue.append((target_x, target_y))
    interior = Image.new("1", source.size, 1)
    interior_pixels = interior.load()
    for y in range(height):
        for x in range(width):
            if not exterior[y][x] and not expanded[y][x]:
                interior_pixels[x, y] = 0
    if area == 28:
        # The source maze grid is orange with gray antialiasing. Close those
        # narrow antialias gaps so they cannot survive as dark source noise.
        interior = interior.filter(ImageFilter.MinFilter(7))
    return width, height, trace_mask(interior, "#173d60"), trace_mask(boundary, "#8edfff"), trace_mask(route, "#ff5c72")


def area_05(language: str) -> str:
    words = LANGUAGES[language]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1080" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
<title id="title">{html.escape(words["area"])}</title>
<desc id="desc">{html.escape(words["route"])}; {html.escape(words["branch"])}; {html.escape(words["switch"])}; {html.escape(words["warp"])}.</desc>
<defs>
  <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#061329"/><stop offset="1" stop-color="#0b2845"/></linearGradient>
  <marker id="route-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#ff5c72"/></marker>
  <marker id="branch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#ffb04a"/></marker>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="8" flood-color="#000" flood-opacity=".3"/></filter>
</defs>
<rect width="1000" height="1080" rx="28" fill="url(#background)"/>
<g transform="translate(34 28)"><rect width="164" height="48" rx="24" fill="#0e3760"/><text x="82" y="32" text-anchor="middle" fill="#e5fbff" font-family="system-ui,-apple-system,sans-serif" font-size="20" font-weight="900">{html.escape(words["area"])}</text></g>

<!-- Map geometry, redrawn from the original PSO World Area 05 plan. -->
<g fill="#173d60" stroke="#8edfff" stroke-width="4" stroke-linejoin="round" filter="url(#shadow)">
  <circle cx="157" cy="536" r="107"/>
  <path d="M286 210 327 187 397 198 499 196 519 241 495 278 511 326 487 376 441 389 402 371 367 386 329 376 307 338 316 296 286 267Z"/>
  <path d="M707 210 747 188 814 198 832 188 897 202 926 244 910 280 928 318 898 369 852 383 815 368 780 382 741 370 719 334 728 293 706 257Z"/>
  <circle cx="824" cy="545" r="107"/>
  <path d="M787 387h74v42h-74Z"/>
  <path d="M812 652v34h-18v55h60v-55h-18v-34Z"/>
</g>
<g fill="none" stroke-linecap="square" stroke-linejoin="round" filter="url(#shadow)">
  <path d="M157 717v-74M157 429V318h240V78" stroke="#8edfff" stroke-width="48"/>
  <path d="M157 717v-74M157 429V318h240V78" stroke="#173d60" stroke-width="40"/>
</g>

<!-- Primary route and optional pickup branch. -->
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="M157 717V318H397V78" stroke="#ff5c72" stroke-width="7" stroke-dasharray="14 12" marker-end="url(#route-arrow)"/>
  <path d="M824 741V649a107 107 0 0 0 0-208v-54" stroke="#ff5c72" stroke-width="7" stroke-dasharray="14 12" marker-end="url(#route-arrow)"/>
  <path d="M824 558 890 507" stroke="#ffb04a" stroke-width="7" stroke-dasharray="12 10" marker-end="url(#branch-arrow)"/>
</g>

<!-- Start, next-area warp, switches, door and pickup. -->
<g stroke="#061329" stroke-width="5">
  <circle cx="157" cy="717" r="17" fill="#39d6ff"/>
  <path d="M397 73l-20-35h40Z" fill="#ff5ca8"/><circle cx="397" cy="78" r="17" fill="#ff5ca8"/>
  <circle cx="824" cy="741" r="17" fill="#ff5ca8"/><path d="M824 746l-20 35h40Z" fill="#ff5ca8"/>
  <rect x="779" y="443" width="86" height="13" rx="6" fill="#61e89f"/>
  <rect x="785" y="524" width="36" height="36" rx="8" fill="#61e89f"/>
  <path d="M795 530h16v16l-8 7-8-7Z" fill="#0d7d47" stroke-width="3"/>
  <rect x="780" y="401" width="88" height="13" rx="6" fill="#ff5ca8"/>
  <rect x="860" y="480" width="74" height="13" rx="6" fill="#5278ff"/>
  <circle cx="803" cy="487" r="13" fill="#ff4d4d"/>
  <circle cx="759" cy="501" r="13" fill="#78f05f"/>
  <circle cx="898" cy="527" r="13" fill="#5278ff"/>
  <circle cx="824" cy="608" r="13" fill="#ff5ca8"/>
</g>

<!-- Localized labels and numbered callouts. -->
{label(words["start"], 157, 758, anchor="middle")}
{label(words["next"], 909, 772, anchor="middle", accent="#ff9dca")}
{label(words["ignore"], 407, 352, anchor="middle")}
{label(words["next"], 815, 281, anchor="middle", accent="#ffed72")}
<g font-family="system-ui,-apple-system,sans-serif" font-size="20" font-weight="900" text-anchor="middle">
  <g transform="translate(397 260)"><rect x="-18" y="-24" width="36" height="32" rx="7" fill="#ffe45c"/><text y="1" fill="#08162b">1</text></g>
  <g transform="translate(754 622)"><rect x="-18" y="-24" width="36" height="32" rx="7" fill="#ffe45c"/><text y="1" fill="#08162b">2</text></g>
  <g transform="translate(815 317)"><rect x="-18" y="-24" width="36" height="32" rx="7" fill="#ffe45c"/><text y="1" fill="#08162b">3</text></g>
</g>

<!-- Evidence-backed tactical reminders. Letters keep the map readable at small sizes. -->
{tip_marker("A", 452, 318)}
<g fill="none" stroke="#ffb04a" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 7">
  <path d="M692 540 785 535"/>
  <path d="M948 535 866 535"/>
</g>
{tip_marker("B", 670, 540)}
{tip_marker("C", 956, 535)}
<g transform="translate(34 826)">
  <rect width="932" height="218" rx="18" fill="#0b2745" stroke="#2c648b" stroke-width="2"/>
  <text x="24" y="40" fill="#e7f9ff" font-family="system-ui,-apple-system,sans-serif" font-size="21" font-weight="900">{html.escape(words["tips"])}</text>
  <g transform="translate(24 68)">
    <circle cx="14" cy="14" r="14" fill="#ffb04a"/><text x="14" y="21" text-anchor="middle" fill="#08162b" font-family="system-ui,-apple-system,sans-serif" font-size="17" font-weight="950">A</text>
    <text x="40" y="20" fill="#ffcf7c" font-family="system-ui,-apple-system,sans-serif" font-size="17" font-weight="900">{html.escape(words["tip_a_title"])}</text>
    {wrapped_lines(words["tip_a"], 40, 46, 408, size=16)}
  </g>
  <g transform="translate(484 68)">
    <circle cx="14" cy="14" r="14" fill="#ffb04a"/><text x="14" y="21" text-anchor="middle" fill="#08162b" font-family="system-ui,-apple-system,sans-serif" font-size="17" font-weight="950">B</text>
    <text x="40" y="20" fill="#ffcf7c" font-family="system-ui,-apple-system,sans-serif" font-size="17" font-weight="900">{html.escape(words["tip_b_title"])}</text>
    {wrapped_lines(words["tip_b"], 40, 46, 408, size=16)}
  </g>
  <g transform="translate(24 146)">
    <circle cx="14" cy="14" r="14" fill="#ffb04a"/><text x="14" y="21" text-anchor="middle" fill="#08162b" font-family="system-ui,-apple-system,sans-serif" font-size="17" font-weight="950">C</text>
    <text x="40" y="20" fill="#ffcf7c" font-family="system-ui,-apple-system,sans-serif" font-size="17" font-weight="900">{html.escape(words["tip_c_title"])}</text>
    {wrapped_lines(words["tip_c"], 40, 46, 408, size=16)}
  </g>
  <text x="908" y="196" text-anchor="end" fill="#7698b1" font-family="system-ui,-apple-system,sans-serif" font-size="14" font-weight="650">{html.escape(words["sources"])}</text>
</g>
</svg>
'''


def traced_map(area: int, language: str, notes_by_language: dict, badges_by_area: dict, terminals_by_area: dict, symbols_by_area: dict) -> str:
    """Build a source-measured redraw with hand-authored semantic layers."""
    width, height, rooms, boundaries, route = source_layers(area)
    if area in {15, 16, 17, 18}:
        rooms = rooms.replace(
            'stroke="none"',
            'stroke="#8edfff" stroke-width="3" stroke-linejoin="round"',
            1,
        )
        boundaries = ""
    canvas_width = max(width, 520)
    map_offset = (canvas_width - width) // 2
    words = LANGUAGES[language]
    notes = notes_by_language[language][area]
    panel, panel_height = notes_panel(notes, words, canvas_width, height + 18)
    start, exit_point = terminals_by_area[area]
    badges = "".join(numbered_badge(number, x, y) for number, x, y in badges_by_area[area])
    terminals = terminal_marker("start", *start, words["start"]) + terminal_marker("exit", *exit_point, words["next"])
    symbols = "".join(semantic_symbol(*symbol) for symbol in symbols_by_area[area])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_width} {height + panel_height + 36}" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
<title id="title">{html.escape(words["area"].replace("05", f"{area:02d}"))}</title>
<desc id="desc">{html.escape(words["route"])}.</desc>
<defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity=".32"/></filter></defs>
<rect width="{canvas_width}" height="{height + panel_height + 36}" rx="18" fill="#071a31"/>
<g transform="translate({map_offset} 0)">
  <g filter="url(#shadow)">{rooms}</g>
  <g>{boundaries}</g>
  <g>{route}</g>
  {badges}
  {symbols}
  {terminals}
</g>
{panel}
</svg>'''


def main() -> None:
    for language in LANGUAGES:
        directory = OUTPUT / language
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "area_05.svg").write_text(area_05(language), encoding="utf-8")
        for area in (4, 6, 7, 8):
            svg = traced_map(area, language, C2_NOTES, C2_BADGES, C2_TERMINALS, C2_SYMBOLS)
            (directory / f"area_{area:02d}.svg").write_text(svg, encoding="utf-8")
        for area in (1, 2):
            svg = traced_map(area, language, C1_NOTES, C1_BADGES, C1_TERMINALS, C1_SYMBOLS)
            (directory / f"area_{area:02d}.svg").write_text(svg, encoding="utf-8")
        for area in (9, 10, 11, 12, 13):
            svg = traced_map(area, language, C3_NOTES, C3_BADGES, C3_TERMINALS, C3_SYMBOLS)
            (directory / f"area_{area:02d}.svg").write_text(svg, encoding="utf-8")
        for area in (14, 15, 16, 17, 18):
            svg = traced_map(area, language, C4_NOTES, C4_BADGES, C4_TERMINALS, C4_SYMBOLS)
            (directory / f"area_{area:02d}.svg").write_text(svg, encoding="utf-8")
        for area in (20, 21, 22, 23, 24):
            svg = traced_map(area, language, C5_NOTES, C5_BADGES, C5_TERMINALS, C5_SYMBOLS)
            (directory / f"area_{area:02d}.svg").write_text(svg, encoding="utf-8")
        for area in (25, 26, 27, 28, 29):
            svg = traced_map(area, language, C6_NOTES, C6_BADGES, C6_TERMINALS, C6_SYMBOLS)
            (directory / f"area_{area:02d}.svg").write_text(svg, encoding="utf-8")
        for area in (31, 32, 33, 34, 35):
            svg = traced_map(area, language, C7_NOTES, C7_BADGES, C7_TERMINALS, C7_SYMBOLS)
            (directory / f"area_{area:02d}.svg").write_text(svg, encoding="utf-8")
        for area in (36, 37, 38, 39, 40):
            svg = traced_map(area, language, C8_NOTES, C8_BADGES, C8_TERMINALS, C8_SYMBOLS)
            (directory / f"area_{area:02d}.svg").write_text(svg, encoding="utf-8")
        for area in (41, 42, 43, 44, 45):
            svg = traced_map(area, language, C9_NOTES, C9_BADGES, C9_TERMINALS, C9_SYMBOLS)
            (directory / f"area_{area:02d}.svg").write_text(svg, encoding="utf-8")
    print("Built all localized EP1 challenge vector redraws.")


if __name__ == "__main__":
    main()
