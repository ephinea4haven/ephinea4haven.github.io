# Game Subcommands Reference (0x60/0x62/0x6C/0x6D)

Game subcommands are carried inside the main protocol commands 0x60 (broadcast), 0x62 (to specific player), 0x6C (extended broadcast), 0x6D (extended to specific player). Each subcommand has a 1-byte sub-opcode (0x00-0xFF).

## Subcommand Header Format

Standard header: 4 bytes — subcommand(1), size_in_dwords(1), data...
Extended header (size=0): 8 bytes — subcommand(1), 0x00, extended_size(4), data...

## Version Mapping

Each subcommand has three opcode columns:
- **DC NTE** — Dreamcast Network Trial Edition
- **DC 11/2000** — Dreamcast prototype (Nov 2000)
- **Final** — All other versions (DCV1, DCV2, PC, GC, EP3, XB, BB)

NONE means the subcommand does not exist for that version.

---

## Player Movement & Position

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6x1F | on_change_floor | Change floor (includes teleport/pipe transitions) |
| 6x20 | on_movement_xyz_with_floor | Set position with floor (SetPosition) |
| 6x21 | on_change_floor | Change floor (alternate) |
| 6x24 | on_movement_xyz | Teleport player to XYZ position |
| 6x3E | on_movement_xyz_with_floor | Stop at position |
| 6x3F | on_movement_xyz_with_floor | Set position (alternate) |
| 6x40 | on_movement_xz | Walk to position (XZ plane) |
| 6x41 | on_movement_xz | Run/move to position |
| 6x42 | on_movement_xz | Run/move to position (alternate) |
| 6x55 | on_movement_xyz | Intra-map warp |
| 6x56 | on_movement_xyz | Set player position and angle |
| 6x94 | on_warp | Warp to another area |

---

## Player State & Animation

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6x02 | forward_subcommand_m | (basic forward) |
| 6x03 | forward_subcommand_m | (basic forward) |
| 6x04 | forward_subcommand_m | (basic forward) |
| 6x05 | on_switch_state_changed | Switch state changed |
| 6x0C | on_received_condition | Received negative condition (status effect) |
| 6x0E | forward (entity_id_transcode) | Clear negative status effects |
| 6x17 | on_set_entity_pos_and_angle | Set entity position and angle |
| 6x23 | on_set_player_visible | Set player visible |
| 6x2F | on_change_hp | Change player HP |
| 6x30 | on_level_up | Player level up |
| 6x4A | on_change_hp | Change HP (variant) |
| 6x4B | on_change_hp | Change HP (variant) |
| 6x4C | on_change_hp | Change HP (variant) |
| 6x4D | on_player_died | Player died |
| 6x4E | on_player_revivable | Player became revivable |
| 6x4F | on_player_revived | Player revived |
| 6x52 | on_set_animation_state | Set animation state |

---

## Item & Inventory Operations

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6x25 | on_equip_item | Equip item |
| 6x26 | on_unequip_item | Unequip item |
| 6x27 | on_use_item | Use item (consume) |
| 6x28 | on_feed_mag | Feed MAG |
| 6x29 | on_destroy_inventory_item | Destroy item in inventory |
| 6x2A | on_player_drop_item | Player drops item to floor |
| 6x2B | on_create_inventory_item | Create item in inventory |
| 6x59 | on_pick_up_item | Pick up item (confirmed) |
| 6x5A | on_pick_up_item_request | Pick up item request |
| 6x5C | on_destroy_floor_item | Destroy floor item |
| 6x5D | on_drop_partial_stack | Drop partial stack of items |
| 6x5E | on_buy_shop_item | Buy item from shop |
| 6x5F | on_box_or_enemy_item_drop | Box/enemy item drop notification |
| 6x60 | on_entity_drop_item_request | Entity drop item request |
| 6x63 | on_destroy_floor_item | Destroy floor item (alternate) |
| 6xA2 | on_entity_drop_item_request | Entity drop item request (alternate) |

---

## Combat & Attack

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6x46 | forward (entity_targets_transcode) | Attack finished (hit targets) |
| 6x47 | forward (entity_targets_transcode) | Cast technique (hit targets) |
| 6x48 | on_cast_technique_finished | Technique cast finished |
| 6x49 | forward (entity_targets_transcode) | Execute photon blast (hit targets) |
| 6x89 | forward (entity_id_transcode) | Set killer entity ID |
| 6x8F | forward (entity_id_transcode) | Add battle damage scores |
| 6x91 | on_update_attackable_col_state | Update attackable collision state |
| 6xE4 | on_incr_enemy_damage | Increment enemy damage (extended) |

---

## Boss Actions

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6x10 | forward (entity_id_transcode) | Dragon boss actions |
| 6x11 | forward (entity_id_transcode) | Dragon boss actions (alt) |
| 6x12 | on_dragon_actions | Dragon actions (special) |
| 6x13 | forward (entity_id_transcode) | De Rol Le boss actions |
| 6x14 | forward (entity_id_transcode) | De Rol Le boss actions with target |
| 6x15 | forward (entity_id_transcode) | Vol Opt boss actions |
| 6x16 | on_vol_opt_actions | Vol Opt boss actions (special) |
| 6x18 | forward (entity_id_transcode) | Vol Opt Phase 2 boss actions |
| 6x19 | forward (entity_id_transcode) | Dark Falz actions |
| 6x84 | on_vol_opt_actions | Vol Opt boss actions (V2+) |
| 6x9F | forward (entity_id_transcode) | Gal Gryphon boss actions |
| 6xA0 | forward (entity_id_transcode) | Gal Gryphon boss actions (alt) |
| 6xA3 | forward (entity_id_transcode) | Olga Flow boss actions |
| 6xA4 | forward (entity_id_transcode) | Olga Flow boss actions (alt) |
| 6xA5 | forward (entity_id_transcode) | Olga Flow boss actions (alt 2) |
| 6xA8 | on_gol_dragon_actions | Gol Dragon actions |
| 6xA9 | forward (entity_id_transcode) | Barba Ray boss actions |
| 6xAA | forward (entity_id_transcode) | Barba Ray boss actions (alt) |

---

## Enemy & Object State

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6x0A | on_update_enemy_state | Update enemy state |
| 6x0B | on_update_object_state | Update object state |
| 6x76 | on_set_entity_set_flag | Set entity set flag |
| 6x86 | on_update_object_state | Hit destructible object |
| 6x9C | on_set_enemy_low_game_flags_ultimate | Set enemy flags (Ultimate difficulty) |

---

## Game Sync & Join

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6x6B | on_sync_joining_player_compressed_state | Sync joining player state (compressed, player 0) |
| 6x6C | on_sync_joining_player_compressed_state | Sync joining player state (compressed, player 1) |
| 6x6D | on_sync_joining_player_compressed_state | Sync joining player state (compressed, player 2) |
| 6x6E | on_sync_joining_player_compressed_state | Sync joining player state (compressed, player 3) |
| 6x6F | on_sync_joining_player_quest_flags | Sync joining player quest flags |
| 6x70 | on_sync_joining_player_disp_and_inventory | Sync joining player display data and inventory |

---

## Event & Map Triggers

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6x67 | on_trigger_set_event | Trigger set event |
| 6x68 | on_update_telepipe_state | Update telepipe state |
| 6x69 | on_npc_control | NPC control |
| 6x6A | on_set_boss_warp_flags | Set boss warp flags |
| 6x75 | on_set_quest_flag | Set quest flag |
| 6x77 | on_sync_quest_register | Sync quest register |
| 6x93 | on_activate_timed_switch | Activate timed switch |

---

## Communication

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6x06 | on_send_guild_card | Send guild card to another player |
| 6x07 | on_symbol_chat | Symbol chat |
| 6x74 | on_word_select | Word select (predefined phrases) |
| 6xBD | on_ep3_private_word_select_bb_bank_action | EP3 private word select / BB bank action |
| 6xB2 | on_play_sound_from_player | Play sound effect from player |

---

## Challenge & Battle Mode

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6x7C | on_challenge_update_records | Update challenge mode records |
| 6x7D | on_update_battle_data | Update battle mode data |
| 6x7F | on_battle_scores | Battle mode scores |
| 6x97 | on_challenge_mode_retry_or_quit | Challenge mode retry or quit |
| 6xCF | on_battle_restart_bb | Battle mode restart (BB) |
| 6xD0 | on_battle_level_up_bb | Battle mode level up (BB) |
| 6xD1 | on_request_challenge_grave_recovery_item_bb | Challenge grave recovery item (BB) |

---

## BB-Specific Subcommands

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6xB5 | on_open_shop_bb_or_ep3_battle_subs | Open shop (BB) / EP3 battle subs |
| 6xB7 | on_buy_shop_item_bb | Buy shop item (BB) |
| 6xB8 | on_identify_item_bb | Identify item (Tekker) |
| 6xBA | on_accept_identify_item_bb | Accept identified item |
| 6xBB | on_open_bank_bb_or_card_trade_counter_ep3 | Open bank (BB) / Card trade counter (EP3) |
| 6xC0 | on_sell_item_at_shop_bb | Sell item at shop |
| 6xC3 | on_drop_partial_stack_bb | Drop partial stack |
| 6xC4 | on_sort_inventory_bb | Sort inventory |
| 6xC5 | on_medical_center_bb | Medical center (heal) |
| 6xC6 | on_steal_exp_bb | Steal EXP (weapon special) |
| 6xC7 | on_charge_attack_bb | Charge attack (weapon special) |
| 6xC8 | on_enemy_exp_request_bb | Enemy EXP request |
| 6xC9 | on_adjust_player_meseta_bb | Adjust player meseta |
| 6xCA | on_quest_create_item_bb | Quest create item |
| 6xCB | on_transfer_item_via_mail_message_bb | Transfer item via mail |
| 6xCC | on_exchange_item_for_team_points_bb | Exchange item for team points |
| 6xD2 | on_write_quest_counter_bb | Write quest counter |
| 6xD5 | on_quest_exchange_item_bb | Quest exchange item |
| 6xD6 | on_wrap_item_bb | Wrap item (present) |
| 6xD7 | on_photon_drop_exchange_for_item_bb | Photon Drop exchange for item |
| 6xD8 | on_photon_drop_exchange_for_s_rank_special_bb | Photon Drop exchange for S-Rank special |
| 6xD9 | on_momoka_item_exchange_bb | Momoka item exchange |
| 6xDA | on_upgrade_weapon_attribute_bb | Upgrade weapon attribute |
| 6xDE | on_secret_lottery_ticket_exchange_bb | Secret lottery ticket exchange |
| 6xDF | on_photon_crystal_exchange_bb | Photon Crystal exchange |
| 6xE0 | on_quest_F95E_result_bb | Quest F95E result |
| 6xE1 | on_quest_F95F_result_bb | Quest F95F result |
| 6xE2 | on_quest_F960_result_bb | Quest F960 result |

---

## EP3 Card Battle Subcommands

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6xBC | on_ep3_trade_card_counts | EP3 trade card counts |
| 6xBF | on_forward_check_ep3_lobby | EP3 lobby forward |

---

## Xbox-Specific

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6xB3 | on_xbox_voice_chat_control | Xbox voice chat control |
| 6xB4 | on_xbox_voice_chat_control | Xbox voice chat control |

---

## Debug

| Sub-opcode | Handler | Description |
|------------|---------|-------------|
| 6xFF | on_debug_info | Debug info (extended subcommand, used for debugging patches) |

---

## Summary

Total subcommands defined: **256** (0x00-0xFF)
- Active handlers (not `on_invalid`): **~160**
- Forward-only (no server-side logic): **~60**
- Server-side processing: **~100**

