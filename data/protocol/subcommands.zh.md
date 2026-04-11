# 游戏子命令参考（0x60/0x62/0x6C/0x6D）

游戏子命令承载在主协议命令 0x60（广播）、0x62（发给指定玩家）、0x6C（扩展广播）、0x6D（扩展发给指定玩家）中。每个子命令有 1 字节的子操作码（0x00–0xFF）。

## 子命令头格式

标准头：4 字节 — subcommand(1)、size_in_dwords(1)、data...
扩展头（size=0）：8 字节 — subcommand(1)、0x00、extended_size(4)、data...

## 版本映射

每个子命令有三列操作码：
- **DC NTE** — Dreamcast 网络试玩版
- **DC 11/2000** — Dreamcast 原型（2000 年 11 月）
- **Final** — 所有其他版本（DCV1、DCV2、PC、GC、EP3、XB、BB）

NONE 表示该子命令在对应版本中不存在。

---

## 玩家移动与位置

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6x1F | on_change_floor | 切换楼层（含传送/传送管道过渡） |
| 6x20 | on_movement_xyz_with_floor | 设置含楼层的位置（SetPosition） |
| 6x21 | on_change_floor | 切换楼层（备用） |
| 6x24 | on_movement_xyz | 将玩家传送至 XYZ 坐标 |
| 6x3E | on_movement_xyz_with_floor | 停在指定位置 |
| 6x3F | on_movement_xyz_with_floor | 设置位置（备用） |
| 6x40 | on_movement_xz | 步行到指定位置（XZ 平面） |
| 6x41 | on_movement_xz | 跑向指定位置 |
| 6x42 | on_movement_xz | 跑向指定位置（备用） |
| 6x55 | on_movement_xyz | 地图内传送 |
| 6x56 | on_movement_xyz | 设置玩家位置和朝向 |
| 6x94 | on_warp | 传送到另一区域 |

---

## 玩家状态与动画

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6x02 | forward_subcommand_m | （基础转发） |
| 6x03 | forward_subcommand_m | （基础转发） |
| 6x04 | forward_subcommand_m | （基础转发） |
| 6x05 | on_switch_state_changed | 开关状态改变 |
| 6x0C | on_received_condition | 受到负面状态（状态异常） |
| 6x0E | forward (entity_id_transcode) | 清除负面状态效果 |
| 6x17 | on_set_entity_pos_and_angle | 设置实体位置和朝向 |
| 6x23 | on_set_player_visible | 设置玩家可见性 |
| 6x2F | on_change_hp | 改变玩家 HP |
| 6x30 | on_level_up | 玩家升级 |
| 6x4A | on_change_hp | 改变 HP（变体） |
| 6x4B | on_change_hp | 改变 HP（变体） |
| 6x4C | on_change_hp | 改变 HP（变体） |
| 6x4D | on_player_died | 玩家死亡 |
| 6x4E | on_player_revivable | 玩家可被复活 |
| 6x4F | on_player_revived | 玩家已复活 |
| 6x52 | on_set_animation_state | 设置动画状态 |

---

## 物品与背包操作

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6x25 | on_equip_item | 装备物品 |
| 6x26 | on_unequip_item | 卸下物品 |
| 6x27 | on_use_item | 使用物品（消耗） |
| 6x28 | on_feed_mag | 喂养 MAG |
| 6x29 | on_destroy_inventory_item | 销毁背包中的物品 |
| 6x2A | on_player_drop_item | 玩家丢弃物品到地面 |
| 6x2B | on_create_inventory_item | 在背包中创建物品 |
| 6x59 | on_pick_up_item | 拾取物品（已确认） |
| 6x5A | on_pick_up_item_request | 请求拾取物品 |
| 6x5C | on_destroy_floor_item | 销毁地面物品 |
| 6x5D | on_drop_partial_stack | 丢弃部分叠加物品 |
| 6x5E | on_buy_shop_item | 从商店购买物品 |
| 6x5F | on_box_or_enemy_item_drop | 箱子/怪物掉落物品通知 |
| 6x60 | on_entity_drop_item_request | 实体掉落物品请求 |
| 6x63 | on_destroy_floor_item | 销毁地面物品（备用） |
| 6xA2 | on_entity_drop_item_request | 实体掉落物品请求（备用） |

---

## 战斗与攻击

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6x46 | forward (entity_targets_transcode) | 攻击完成（命中目标） |
| 6x47 | forward (entity_targets_transcode) | 释放技能（命中目标） |
| 6x48 | on_cast_technique_finished | 技能释放完毕 |
| 6x49 | forward (entity_targets_transcode) | 发动光子爆发（命中目标） |
| 6x89 | forward (entity_id_transcode) | 设置击杀实体 ID |
| 6x8F | forward (entity_id_transcode) | 增加战斗伤害得分 |
| 6x91 | on_update_attackable_col_state | 更新可攻击碰撞状态 |
| 6xE4 | on_incr_enemy_damage | 累计敌方伤害（扩展） |

---

## Boss 行为

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6x10 | forward (entity_id_transcode) | Dragon Boss 行为 |
| 6x11 | forward (entity_id_transcode) | Dragon Boss 行为（备用） |
| 6x12 | on_dragon_actions | Dragon 特殊行为 |
| 6x13 | forward (entity_id_transcode) | De Rol Le Boss 行为 |
| 6x14 | forward (entity_id_transcode) | De Rol Le Boss 含目标行为 |
| 6x15 | forward (entity_id_transcode) | Vol Opt Boss 行为 |
| 6x16 | on_vol_opt_actions | Vol Opt Boss 特殊行为 |
| 6x18 | forward (entity_id_transcode) | Vol Opt 第二阶段 Boss 行为 |
| 6x19 | forward (entity_id_transcode) | Dark Falz 行为 |
| 6x84 | on_vol_opt_actions | Vol Opt Boss 行为（V2+） |
| 6x9F | forward (entity_id_transcode) | Gal Gryphon Boss 行为 |
| 6xA0 | forward (entity_id_transcode) | Gal Gryphon Boss 行为（备用） |
| 6xA3 | forward (entity_id_transcode) | Olga Flow Boss 行为 |
| 6xA4 | forward (entity_id_transcode) | Olga Flow Boss 行为（备用） |
| 6xA5 | forward (entity_id_transcode) | Olga Flow Boss 行为（备用 2） |
| 6xA8 | on_gol_dragon_actions | Gol Dragon 行为 |
| 6xA9 | forward (entity_id_transcode) | Barba Ray Boss 行为 |
| 6xAA | forward (entity_id_transcode) | Barba Ray Boss 行为（备用） |

---

## 敌人与物体状态

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6x0A | on_update_enemy_state | 更新敌人状态 |
| 6x0B | on_update_object_state | 更新物体状态 |
| 6x76 | on_set_entity_set_flag | 设置实体集合标志 |
| 6x86 | on_update_object_state | 击中可破坏物体 |
| 6x9C | on_set_enemy_low_game_flags_ultimate | 设置敌人标志（究极难度） |

---

## 游戏同步与加入

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6x6B | on_sync_joining_player_compressed_state | 同步加入玩家状态（压缩，玩家 0） |
| 6x6C | on_sync_joining_player_compressed_state | 同步加入玩家状态（压缩，玩家 1） |
| 6x6D | on_sync_joining_player_compressed_state | 同步加入玩家状态（压缩，玩家 2） |
| 6x6E | on_sync_joining_player_compressed_state | 同步加入玩家状态（压缩，玩家 3） |
| 6x6F | on_sync_joining_player_quest_flags | 同步加入玩家的任务标志 |
| 6x70 | on_sync_joining_player_disp_and_inventory | 同步加入玩家的显示数据和背包 |

---

## 事件与地图触发器

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6x67 | on_trigger_set_event | 触发设置事件 |
| 6x68 | on_update_telepipe_state | 更新传送管道状态 |
| 6x69 | on_npc_control | NPC 控制 |
| 6x6A | on_set_boss_warp_flags | 设置 Boss 传送标志 |
| 6x75 | on_set_quest_flag | 设置任务标志 |
| 6x77 | on_sync_quest_register | 同步任务寄存器 |
| 6x93 | on_activate_timed_switch | 激活计时开关 |

---

## 通信

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6x06 | on_send_guild_card | 向其他玩家发送公会卡 |
| 6x07 | on_symbol_chat | 符号聊天 |
| 6x74 | on_word_select | 词语选择（预设短语） |
| 6xBD | on_ep3_private_word_select_bb_bank_action | EP3 私聊词语选择 / BB 银行操作 |
| 6xB2 | on_play_sound_from_player | 从玩家处播放音效 |

---

## 挑战与对战模式

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6x7C | on_challenge_update_records | 更新挑战模式记录 |
| 6x7D | on_update_battle_data | 更新对战模式数据 |
| 6x7F | on_battle_scores | 对战模式得分 |
| 6x97 | on_challenge_mode_retry_or_quit | 挑战模式重试或退出 |
| 6xCF | on_battle_restart_bb | 对战模式重新开始（BB） |
| 6xD0 | on_battle_level_up_bb | 对战模式升级（BB） |
| 6xD1 | on_request_challenge_grave_recovery_item_bb | 挑战遗物恢复物品（BB） |

---

## BB 专属子命令

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6xB5 | on_open_shop_bb_or_ep3_battle_subs | 打开商店（BB）/ EP3 对战子命令 |
| 6xB7 | on_buy_shop_item_bb | 购买商店物品（BB） |
| 6xB8 | on_identify_item_bb | 鉴定物品（鉴定师） |
| 6xBA | on_accept_identify_item_bb | 接受已鉴定物品 |
| 6xBB | on_open_bank_bb_or_card_trade_counter_ep3 | 打开银行（BB）/ 卡牌交易柜台（EP3） |
| 6xC0 | on_sell_item_at_shop_bb | 在商店出售物品 |
| 6xC3 | on_drop_partial_stack_bb | 丢弃部分叠加物品 |
| 6xC4 | on_sort_inventory_bb | 整理背包 |
| 6xC5 | on_medical_center_bb | 医疗中心（治疗） |
| 6xC6 | on_steal_exp_bb | 偷取经验（武器特殊效果） |
| 6xC7 | on_charge_attack_bb | 蓄力攻击（武器特殊效果） |
| 6xC8 | on_enemy_exp_request_bb | 请求敌人经验值 |
| 6xC9 | on_adjust_player_meseta_bb | 调整玩家 Meseta |
| 6xCA | on_quest_create_item_bb | 任务创建物品 |
| 6xCB | on_transfer_item_via_mail_message_bb | 通过邮件转移物品 |
| 6xCC | on_exchange_item_for_team_points_bb | 兑换物品为团队积分 |
| 6xD2 | on_write_quest_counter_bb | 写入任务计数器 |
| 6xD5 | on_quest_exchange_item_bb | 任务兑换物品 |
| 6xD6 | on_wrap_item_bb | 包装物品（礼物） |
| 6xD7 | on_photon_drop_exchange_for_item_bb | 光子液兑换物品 |
| 6xD8 | on_photon_drop_exchange_for_s_rank_special_bb | 光子液兑换 S 级特殊 |
| 6xD9 | on_momoka_item_exchange_bb | Momoka 物品兑换 |
| 6xDA | on_upgrade_weapon_attribute_bb | 升级武器属性 |
| 6xDE | on_secret_lottery_ticket_exchange_bb | 秘密抽奖券兑换 |
| 6xDF | on_photon_crystal_exchange_bb | 光子晶体兑换 |
| 6xE0 | on_quest_F95E_result_bb | 任务 F95E 结果 |
| 6xE1 | on_quest_F95F_result_bb | 任务 F95F 结果 |
| 6xE2 | on_quest_F960_result_bb | 任务 F960 结果 |

---

## EP3 卡牌对战子命令

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6xBC | on_ep3_trade_card_counts | EP3 交易卡牌数量 |
| 6xBF | on_forward_check_ep3_lobby | EP3 大厅转发 |

---

## Xbox 专属

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6xB3 | on_xbox_voice_chat_control | Xbox 语音聊天控制 |
| 6xB4 | on_xbox_voice_chat_control | Xbox 语音聊天控制 |

---

## 调试

| 子操作码 | 处理函数 | 说明 |
|----------|---------|------|
| 6xFF | on_debug_info | 调试信息（扩展子命令，用于调试补丁） |

---

## 汇总

已定义子命令总数：**256**（0x00–0xFF）
- 有效处理函数（非 `on_invalid`）：约 **160** 个
- 仅转发（无服务器端逻辑）：约 **60** 个
- 服务器端处理：约 **100** 个

