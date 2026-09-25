# ゲームサブコマンド リファレンス（0x60/0x62/0x6C/0x6D）

ゲームのサブコマンドは、メインプロトコルのコマンド 0x60（全体に送信）、0x62（特定のプレイヤーへ）、0x6C（拡張・全体に送信）、0x6D（拡張・特定のプレイヤーへ）の中で運ばれます。各サブコマンドには 1 バイトのサブオペコード（0x00–0xFF）があります。

## サブコマンドヘッダーの形式

標準ヘッダー：4 バイト — subcommand(1)、size_in_dwords(1)、data...
拡張ヘッダー（size=0）：8 バイト — subcommand(1)、0x00、extended_size(4)、data...

## バージョンの対応

各サブコマンドには 3 つのオペコード列があります：
- **DC NTE** — ドリームキャスト Network Trial Edition
- **DC 11/2000** — ドリームキャストの試作版（2000年11月）
- **Final** — そのほかのすべてのバージョン（DCV1、DCV2、PC、GC、EP3、XB、BB）

NONE は、そのバージョンにはそのサブコマンドが存在しないことを表します。

---

## プレイヤーの移動と位置

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6x1F | on_change_floor | フロアの変更（テレポートやパイプでの移動を含む） |
| 6x20 | on_movement_xyz_with_floor | フロア付きで位置を設定（SetPosition） |
| 6x21 | on_change_floor | フロアの変更（別形式） |
| 6x24 | on_movement_xyz | プレイヤーを XYZ 位置へテレポート |
| 6x3E | on_movement_xyz_with_floor | 位置で停止 |
| 6x3F | on_movement_xyz_with_floor | 位置の設定（別形式） |
| 6x40 | on_movement_xz | 位置まで歩く（XZ 平面） |
| 6x41 | on_movement_xz | 位置まで走る／移動する |
| 6x42 | on_movement_xz | 位置まで走る／移動する（別形式） |
| 6x55 | on_movement_xyz | マップ内ワープ |
| 6x56 | on_movement_xyz | プレイヤーの位置と向きを設定 |
| 6x94 | on_warp | 別のエリアへワープ |

---

## プレイヤーの状態とアニメーション

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6x02 | forward_subcommand_m | （基本の転送） |
| 6x03 | forward_subcommand_m | （基本の転送） |
| 6x04 | forward_subcommand_m | （基本の転送） |
| 6x05 | on_switch_state_changed | スイッチの状態が変化 |
| 6x0C | on_received_condition | 状態異常を受けた |
| 6x0E | forward (entity_id_transcode) | 状態異常を解除 |
| 6x17 | on_set_entity_pos_and_angle | エンティティの位置と向きを設定 |
| 6x23 | on_set_player_visible | プレイヤーを表示状態にする |
| 6x2F | on_change_hp | プレイヤーの HP を変更 |
| 6x30 | on_level_up | プレイヤーのレベルアップ |
| 6x4A | on_change_hp | HP の変更（別種） |
| 6x4B | on_change_hp | HP の変更（別種） |
| 6x4C | on_change_hp | HP の変更（別種） |
| 6x4D | on_player_died | プレイヤーが戦闘不能 |
| 6x4E | on_player_revivable | プレイヤーが復活可能になった |
| 6x4F | on_player_revived | プレイヤーが復活した |
| 6x52 | on_set_animation_state | アニメーションの状態を設定 |

---

## アイテムと所持品の操作

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6x25 | on_equip_item | アイテムを装備 |
| 6x26 | on_unequip_item | アイテムの装備を外す |
| 6x27 | on_use_item | アイテムを使用（消費） |
| 6x28 | on_feed_mag | マグにエサを与える |
| 6x29 | on_destroy_inventory_item | 所持品のアイテムを破棄 |
| 6x2A | on_player_drop_item | プレイヤーがアイテムを床に落とす |
| 6x2B | on_create_inventory_item | 所持品にアイテムを作成 |
| 6x59 | on_pick_up_item | アイテムを拾う（確定） |
| 6x5A | on_pick_up_item_request | アイテムを拾う要求 |
| 6x5C | on_destroy_floor_item | 床のアイテムを破棄 |
| 6x5D | on_drop_partial_stack | スタックの一部を落とす |
| 6x5E | on_buy_shop_item | ショップでアイテムを購入 |
| 6x5F | on_box_or_enemy_item_drop | 箱・エネミーからのドロップ通知 |
| 6x60 | on_entity_drop_item_request | エンティティのドロップ要求 |
| 6x63 | on_destroy_floor_item | 床のアイテムを破棄（別形式） |
| 6xA2 | on_entity_drop_item_request | エンティティのドロップ要求（別形式） |

---

## 戦闘と攻撃

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6x46 | forward (entity_targets_transcode) | 攻撃完了（命中した対象） |
| 6x47 | forward (entity_targets_transcode) | テクニックを発動（命中した対象） |
| 6x48 | on_cast_technique_finished | テクニックの発動完了 |
| 6x49 | forward (entity_targets_transcode) | フォトンブラストを発動（命中した対象） |
| 6x89 | forward (entity_id_transcode) | 倒した側のエンティティ ID を設定 |
| 6x8F | forward (entity_id_transcode) | バトルのダメージスコアを加算 |
| 6x91 | on_update_attackable_col_state | 攻撃可能な当たり判定の状態を更新 |
| 6xE4 | on_incr_enemy_damage | エネミーのダメージを加算（拡張） |

---

## ボスの行動

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6x10 | forward (entity_id_transcode) | ドラゴン（ボス）の行動 |
| 6x11 | forward (entity_id_transcode) | ドラゴン（ボス）の行動（別形式） |
| 6x12 | on_dragon_actions | ドラゴンの行動（特殊） |
| 6x13 | forward (entity_id_transcode) | デ・ロル・レ（ボス）の行動 |
| 6x14 | forward (entity_id_transcode) | デ・ロル・レ（ボス）の対象付き行動 |
| 6x15 | forward (entity_id_transcode) | ボルオプト（ボス）の行動 |
| 6x16 | on_vol_opt_actions | ボルオプト（ボス）の行動（特殊） |
| 6x18 | forward (entity_id_transcode) | ボルオプト第2形態（ボス）の行動 |
| 6x19 | forward (entity_id_transcode) | ダークファルスの行動 |
| 6x84 | on_vol_opt_actions | ボルオプト（ボス）の行動（V2 以降） |
| 6x9F | forward (entity_id_transcode) | ガル・グリフォン（ボス）の行動 |
| 6xA0 | forward (entity_id_transcode) | ガル・グリフォン（ボス）の行動（別形式） |
| 6xA3 | forward (entity_id_transcode) | オルガ・フロウ（ボス）の行動 |
| 6xA4 | forward (entity_id_transcode) | オルガ・フロウ（ボス）の行動（別形式） |
| 6xA5 | forward (entity_id_transcode) | オルガ・フロウ（ボス）の行動（別形式2） |
| 6xA8 | on_gol_dragon_actions | ゴル　ドラゴンの行動 |
| 6xA9 | forward (entity_id_transcode) | バルバレイ（ボス）の行動 |
| 6xAA | forward (entity_id_transcode) | バルバレイ（ボス）の行動（別形式） |

---

## エネミーとオブジェクトの状態

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6x0A | on_update_enemy_state | エネミーの状態を更新 |
| 6x0B | on_update_object_state | オブジェクトの状態を更新 |
| 6x76 | on_set_entity_set_flag | エンティティのセットフラグを設定 |
| 6x86 | on_update_object_state | 破壊可能なオブジェクトに命中 |
| 6x9C | on_set_enemy_low_game_flags_ultimate | エネミーのフラグを設定（アルティメット） |

---

## ゲームの同期と参加

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6x6B | on_sync_joining_player_compressed_state | 参加するプレイヤーの状態を同期（圧縮、プレイヤー 0） |
| 6x6C | on_sync_joining_player_compressed_state | 参加するプレイヤーの状態を同期（圧縮、プレイヤー 1） |
| 6x6D | on_sync_joining_player_compressed_state | 参加するプレイヤーの状態を同期（圧縮、プレイヤー 2） |
| 6x6E | on_sync_joining_player_compressed_state | 参加するプレイヤーの状態を同期（圧縮、プレイヤー 3） |
| 6x6F | on_sync_joining_player_quest_flags | 参加するプレイヤーのクエストフラグを同期 |
| 6x70 | on_sync_joining_player_disp_and_inventory | 参加するプレイヤーの表示データと所持品を同期 |

---

## イベントとマップのトリガー

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6x67 | on_trigger_set_event | セットイベントを発生させる |
| 6x68 | on_update_telepipe_state | テレパイプの状態を更新 |
| 6x69 | on_npc_control | NPC の制御 |
| 6x6A | on_set_boss_warp_flags | ボスワープのフラグを設定 |
| 6x75 | on_set_quest_flag | クエストフラグを設定 |
| 6x77 | on_sync_quest_register | クエストレジスタを同期 |
| 6x93 | on_activate_timed_switch | 時限スイッチを作動 |

---

## コミュニケーション

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6x06 | on_send_guild_card | ほかのプレイヤーにギルドカードを送る |
| 6x07 | on_symbol_chat | シンボルチャット |
| 6x74 | on_word_select | ワードセレクト（定型文） |
| 6xBD | on_ep3_private_word_select_bb_bank_action | EP3 のプライベートワードセレクト／BB の銀行操作 |
| 6xB2 | on_play_sound_from_player | プレイヤーから効果音を再生 |

---

## チャレンジモードとバトルモード

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6x7C | on_challenge_update_records | チャレンジモードの記録を更新 |
| 6x7D | on_update_battle_data | バトルモードのデータを更新 |
| 6x7F | on_battle_scores | バトルモードのスコア |
| 6x97 | on_challenge_mode_retry_or_quit | チャレンジモードのリトライまたは終了 |
| 6xCF | on_battle_restart_bb | バトルモードの再開（BB） |
| 6xD0 | on_battle_level_up_bb | バトルモードのレベルアップ（BB） |
| 6xD1 | on_request_challenge_grave_recovery_item_bb | チャレンジのお墓からの回復アイテム（BB） |

---

## BB 専用のサブコマンド

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6xB5 | on_open_shop_bb_or_ep3_battle_subs | ショップを開く（BB）／EP3 のバトル用サブコマンド |
| 6xB7 | on_buy_shop_item_bb | ショップのアイテムを購入（BB） |
| 6xB8 | on_identify_item_bb | アイテムの鑑定（テッカー） |
| 6xBA | on_accept_identify_item_bb | 鑑定したアイテムを受け取る |
| 6xBB | on_open_bank_bb_or_card_trade_counter_ep3 | 銀行を開く（BB）／カードトレードカウンター（EP3） |
| 6xC0 | on_sell_item_at_shop_bb | ショップでアイテムを売る |
| 6xC3 | on_drop_partial_stack_bb | スタックの一部を落とす |
| 6xC4 | on_sort_inventory_bb | 所持品の並べ替え |
| 6xC5 | on_medical_center_bb | メディカルセンター（回復） |
| 6xC6 | on_steal_exp_bb | 経験値を奪う（武器のエクストラアタック） |
| 6xC7 | on_charge_attack_bb | チャージ攻撃（武器のエクストラアタック） |
| 6xC8 | on_enemy_exp_request_bb | エネミーの経験値の要求 |
| 6xC9 | on_adjust_player_meseta_bb | プレイヤーのメセタを調整 |
| 6xCA | on_quest_create_item_bb | クエストでアイテムを作成 |
| 6xCB | on_transfer_item_via_mail_message_bb | メールでアイテムを送る |
| 6xCC | on_exchange_item_for_team_points_bb | アイテムをチームポイントと交換 |
| 6xD2 | on_write_quest_counter_bb | クエストカウンターの書き込み |
| 6xD5 | on_quest_exchange_item_bb | クエストでのアイテム交換 |
| 6xD6 | on_wrap_item_bb | アイテムのラッピング（プレゼント） |
| 6xD7 | on_photon_drop_exchange_for_item_bb | フォトンドロップとアイテムの交換 |
| 6xD8 | on_photon_drop_exchange_for_s_rank_special_bb | フォトンドロップと S ランク特殊能力の交換 |
| 6xD9 | on_momoka_item_exchange_bb | モモカとのアイテム交換 |
| 6xDA | on_upgrade_weapon_attribute_bb | 武器の属性を強化 |
| 6xDE | on_secret_lottery_ticket_exchange_bb | シークレットくじ券の交換 |
| 6xDF | on_photon_crystal_exchange_bb | フォトンクリスタルの交換 |
| 6xE0 | on_quest_F95E_result_bb | クエスト F95E の結果 |
| 6xE1 | on_quest_F95F_result_bb | クエスト F95F の結果 |
| 6xE2 | on_quest_F960_result_bb | クエスト F960 の結果 |

---

## EP3 カードバトルのサブコマンド

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6xBC | on_ep3_trade_card_counts | EP3 のトレードカードの枚数 |
| 6xBF | on_forward_check_ep3_lobby | EP3 ロビーへの転送 |

---

## Xbox 専用

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6xB3 | on_xbox_voice_chat_control | Xbox のボイスチャットの制御 |
| 6xB4 | on_xbox_voice_chat_control | Xbox のボイスチャットの制御 |

---

## デバッグ

| サブオペコード | ハンドラー | 説明 |
|------------|---------|-------------|
| 6xFF | on_debug_info | デバッグ情報（拡張サブコマンド。パッチのデバッグに使用） |

---

## まとめ

定義済みのサブコマンドの総数：**256**（0x00–0xFF）
- 有効なハンドラー（`on_invalid` 以外）：**約 160**
- 転送のみ（サーバー側の処理なし）：**約 60**
- サーバー側で処理：**約 100**
