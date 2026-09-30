# NPC 头像来源与本轮处理结果

核对日期：2026-10-01。对应 48 个条目：8 个本地模型渲染、33 个保留的外部游戏画面、5 个缺原始图片出处记录的旧游戏画面、2 个无本人头像的资料条目。

**不是全页已经转为本地渲染。** 下表完整列出保留来源，避免把修好的少数人物当成整页所有素材均已替换。保留图片的宽高比仍受整页浏览器回归检查。

## 用户已指出的项目

| 项目 | 本轮结果 |
|---|---|
| Flowen 屏摄不干净 | 本地 plT 模型/原始贴图，平视正面渲染 |
| Ult 角度不对 | Soul of Steel 对应模板 50，本地 RAcaseal 头型 2；脸槽顺序已修正 |
| Rico 图来源及纵向压缩 | 本地 plX 独立模型；移除改材质截图，900×900 等比例显示 |
| Tyrell 图来源及纵向压缩 | 本地 data.gsl 中总督 BML 模型；等比例显示 |
| Zoke 不是任务人物画面 | Seek my Master 对应模板 34；改成本地角色模型渲染，不再使用黑白截图 |
| Kroe 双胞胎来源 | Kroe 模板 30、Anna 模板 20 分别渲染，保留各自发型与 Section ID |
| Coren 身份与房间 ID | 保留流浪鉴定师身份、房间 Section ID 变化说明；图片改成本地鉴定师外观的一例，不声称固定外貌 |
| Osto 没有图 | 核对本地任务及模板，未确认本人模型；保留资料条目，不用其他研究员代替 |
| Blant 没有图 | 核对本地任务：留言胶囊叙事；未确认本人模型，保留资料条目 |
| 排版与头像比例 | 保留紧凑卡片、关系图和时间线；三语页同时更新，全部头像检查显示比例 |

## 本地任务核对的范围

输入来自用户任务库的 EP1/V4/Side Story，均为 `[BB-E].qst`：
Soul of Steel、Waterfall Tears、Seek my Master、The Grave’s Butler、Dr. Osto’s Research、Unsealed Door。
QST、解出的 BIN/DAT 哈希见 [任务证据](../content/npc-quest-evidence.json)。

- Kroe：Waterfall Tears 的 BIN `0x00B2` 将模板 30 放入 r65，`0x00BE` 调用 `npc_crptalk_id`。
- Zoke：Seek my Master 的 BIN `0x01A4/0x01B0` 使用模板 34；另在 `0x42E0/0x42E6` 通过 `npc_crp_id` 生成。
- Ult：Soul of Steel 的 `0x111F/0x1125` 和 `0x1534/0x153A` 使用模板 50。
- Blant：The Grave’s Butler 的脚本生成模板是 Matha 19、Hopkins 28、Valletta 48；没有 NPC 外观覆盖指令。DAT 的 19 个静态友好 NPC 均在 Pioneer 2，洞窟层无静态友好 NPC。BIN `0x0ECD` 的留言自称 Blant，`0x0D4E` 明确提到装有信息的胶囊。以上并不证明所有版本或自制任务都没有 Blant 模型。
- Osto：Dr. Osto’s Research / Unsealed Door 的静态友好 NPC 分别有 20 / 19 个，均在 Pioneer 2；地下区域没有静态友好 NPC。脚本生成的是其他已知模板，包含 Montague 17；研究所文字标记不能据此认作 Osto 实体。64 条本地模板中无 Osto 或 Blant 条目。这里的结论是本轮未确认本人模型，不是宣称游戏所有资源里绝对不存在。

Coren 本轮渲染 `data.gsl/bm_n_kanteib_i_body.bml` 的第 0 项。
同一 GSL 还含 b/b2、f/f2、fs/fs2、o/o2、t/t2 十种鉴定师资源。图片只显示一种；本轮没有把十种模型逐一断言对应某个 Section ID。

## 全部条目

| 人物 | 头像状态 | 来源 |
|---|---|---|
| tyrell · 柯林·泰瑞尔（Colin Tyrell） | 本地原始模型渲染；已替换 | [模型配置与哈希](../assets/img/npc/model-renders.json) |
| irene · 艾琳（Irene） | 沿用旧游戏画面；缺原始图片来源记录 | Irene、Momoka、Calus、Tobokke、Paganini 为此类 |
| momoka · 莫莫卡（Momoka） | 沿用旧游戏画面；缺原始图片来源记录 | Irene、Momoka、Calus、Tobokke、Paganini 为此类 |
| natasha · 娜塔莎·米拉萝丝（Natasha Milarose） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Natasha_milarose_ep2.png) |
| nol · 诺尔·莉奈尔（Nol Rinale） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Nolep2.png) |
| elly · Elly Person | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Ellyep2.png) |
| rico · 红环莉可（Red Ring Rico） | 本地原始模型渲染；已替换 | [模型配置与哈希](../assets/img/npc/model-renders.json) |
| flowen · 希斯克利夫·弗洛文（Heathcliff Flowen） | 本地原始模型渲染；已替换 | [模型配置与哈希](../assets/img/npc/model-renders.json) |
| donoph · Donoph Baz | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Pso_donoph_with_zanba.png) |
| zoke · 佐克·美山（Zoke Miyama） | 本地原始模型渲染；已替换 | [模型配置与哈希](../assets/img/npc/model-renders.json) |
| ash · 阿修（Ash） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://sageoshow.blog.fc2.com/blog-entry-580.html) |
| bernie · 伯尼（Bernie） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://sageoshow.blog.fc2.com/blog-entry-580.html) |
| alicia · 艾莉西亚·巴兹（Alicia Baz） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://garudo.ni-3.net/Entry/801/) |
| shino · 希诺（Shino） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://sageoshow.blog.fc2.com/blog-entry-580.html) |
| montague · 吉恩·卡洛·蒙塔古博士（Dr. Jean Carlo Montague） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://sageoshow.blog.fc2.com/blog-entry-580.html) |
| elenor · 艾尔诺亚·卡缪（Elenor Camuel） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://sageoshow.blog.fc2.com/blog-entry-580.html) |
| ult · Ult | 本地原始模型渲染；已替换 | [模型配置与哈希](../assets/img/npc/model-renders.json) |
| osto · 奥斯托·海尔博士（Dr. Osto Hyle） | 资料条目；本轮核对的任务中未确认本人模型 | 见下方本地任务证据 |
| mome · Mome | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Mome.png) |
| calus · 卡鲁斯（Calus） | 沿用旧游戏画面；缺原始图片来源记录 | Irene、Momoka、Calus、Tobokke、Paganini 为此类 |
| kireek · 基里克（Kireek） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://sageoshow.blog.fc2.com/blog-entry-580.html) |
| sue · 苏（Sue） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://garudo.ni-3.net/Entry/786/) |
| kroe · Kroe Waynes | 本地原始模型渲染；已替换 | [模型配置与哈希](../assets/img/npc/model-renders.json) |
| anna · Anna Waynes | 本地原始模型渲染；已替换 | [模型配置与哈希](../assets/img/npc/model-renders.json) |
| tobokke · 托波克（Tobokke） | 沿用旧游戏画面；缺原始图片来源记录 | Irene、Momoka、Calus、Tobokke、Paganini 为此类 |
| tonzlar · 通兹拉（Tonzlar） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Tonzlar.png) |
| gekigasky · 盖基加斯基（Gekigasky） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Gekigasky.png) |
| rupika · 鲁毕卡（Rupika） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://sageoshow.blog.fc2.com/blog-entry-580.html) |
| leo · Leo Grahart | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Leo_grahart_face.png) |
| karen · Karen Grahart | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://sageoshow.blog.fc2.com/blog-entry-580.html) |
| gilliam · Gilliam | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://sageoshow.blog.fc2.com/blog-entry-580.html) |
| sakon-ukon · Sakon / Ukon | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://garudo.ni-3.net/Entry/803/) |
| zidd · Zidd | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Pso_battletrainingmain.png) |
| racton · Racton | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Racton.png) |
| guls · Dr. Guls | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Fakeyellowquest.png) |
| trekka · Trekka | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://garudo.ni-3.net/Entry/767/) |
| cicil · Cicil | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Cicil1.png) |
| albert · Albert | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://garudo.ni-3.net/Entry/769/) |
| matha · Matha Grave | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Matha_grave.png) |
| blant · Blant | 资料条目；本轮核对的任务中未确认本人模型 | 见下方本地任务证据 |
| lionel · Lionel | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Lionel.png) |
| gizel · 吉泽尔（Gizel） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://garudo.ni-3.net/Entry/771/) |
| gallon · Gallon | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://phantasystar.fandom.com/wiki/File:Pso_generiman3.png) |
| paganini · 帕加尼尼（Paganini） | 沿用旧游戏画面；缺原始图片来源记录 | Irene、Momoka、Calus、Tobokke、Paganini 为此类 |
| hopkins · Hopkins | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://sageoshow.blog.fc2.com/blog-entry-580.html) |
| coren · Coren | 本地原始模型渲染；已替换 | [模型配置与哈希](../assets/img/npc/model-renders.json) |
| claire · Claire | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://www.4gamer.net/games/019/G001924/20061128165313/) |
| naura · Naura 三姐妹（Naura sisters） | 沿用外部游戏画面；未做本地重渲染 | [原来源](https://garudo.ni-3.net/Entry/767/) |
