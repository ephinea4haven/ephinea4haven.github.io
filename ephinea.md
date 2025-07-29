# 关于Ephinea
此页面用于说明`Ephinea`是什么，给玩家提供了什么，希望这篇文档能够说明清楚。

## 概述

`Ephinea`是一个PSOBB服务器，目标愿景是复刻SEGA官方的游戏体验，与此同时也添加了一些提升玩家体验的优化，为游戏带来更多现代化的体验。<br/>

* 经验维持不变。
* 掉率维持不变。
* 稀有怪率维持不变。
* 角色能力值维持不变。
* 道具参数维持不变，有几个特例。
* 没有增加任何装备。

掉落表来自于`SEGA`官方。EP1是一致的，EP2&4有一些平衡性调整。<br/>
但是那些具有标志性ID掉落，如：天青的`封印野太刀` 、 金黄的 `佛罗文大剑(3084)` 是没有任何调整的。<br/>
<br/>
`Ephinea`没有计划调整游戏的核心的东西，并希望提供给玩家一个无论何时都能体验到原汁原味游戏体验的环境。

<h2>平衡性调整和新特性</h2>

<h3>独立的掉落系统</h3>

当前玩家可以选择现代化的掉落系统，每位玩家的掉落物品都是独立存在的，代替了之前的共享的掉落模式。<br/>

<h3>共享经验系统</h3>

玩家创建房间的时候，可以选择现代化的共享经验系统，只要玩家在一个区域不用摸怪就可以获得到经验。<br/>

<h3>32个角色</h3>

`Ephinea`的每个游戏账号可以创建32个角色(8个slot)，而非标准的4个。如何在这8个slot之间切换呢？<br/>

* 登录器的右上角的slot下拉菜单
* 在游戏中可以输入 /cbank [1-8]

<h3>完整的服装间</h3>

`Ephinea`提供了完整的服装间，需要工会使用PT购买该权限，便可调整角色外观效果，注意不能在服装间内修改名字。<br/>

<h3>公共仓库</h3>

每个游戏账号的32个角色(8个slot，每个slot4个角色)有一个公共仓库。可以在游戏中使用/bank命令在角色仓库和共享仓库之间切换。<br/>

<h3>仓库MST上限调整</h3>

仓库的MST上限已经调整为999,999,999(10亿-1) 梅塞塔.<br/>

<h3>普通物品的`堆叠`</h3>

能力药和打磨石可以在道具和仓库里堆叠到99。<br/>

<h3>功能完整的挑战模式和战斗模式</h3>

完美实现了`挑战模式`和`战斗模式`，基本没有bug存在。<br/>

<h3>可调整的颜色ID</h3>

修改角色的颜色ID,仅可以在20级之前使用。

<h3>稀有掉落通知</h3>

当红盒掉落时，能够听到特殊音效，并且在mini地图上用红点标注了。

<h3>多种游戏账号模式</h3>

`Ephinea`支持多种游戏体验模式，如 Normal(常规)、Hardcore(硬核)、Sandbox(沙盘)、Purist Mode(传统)。<br/>

* **Normal(常规)**

**养老院模式。**


* 经验值: 100%  
* 掉宝率: 100%  
* 稀有怪率: 100%  

---

~~**Hardcore(硬核)**~~

~~**不要命模式，如果没有娃娃死亡会清空角色身上和银行所有道具，但不影响共享银行，
娃娃相对来说非常珍贵，此模式掉落有buff，具体参数如下:**~~


~~* 经验值: 200%~~  
~~* 掉宝率: 130%~~   
~~* 稀有怪率: 100%~~  
    

---    

**Sandbox(沙盘)**

**造物模式**

**命令:**

* /addmeseta – 提款机  
* /item – 造物  
* /levelup – 升级  
* /redbox – 红盒模式  
* /srank – 获取cm模式的s武  
* /warpall – 队长带大家飞到任意区域  
* /warpme – 自己飞到任意区域  
* /wipecmode – 清理cm模式数据  

---

**Purist Mode(传统)**

**算不上是一种账号模式, 在游戏中输入`/purist` 会进入此模式, 此模式的房间没有任何掉落加成。**

---

**拉古奥尔逐梦之路 - RBR**

每周服务器会选择一组任务用来提升掉落，每章一个任务，DAR、RDR和EXP提升19%，每增加一位玩家加成2%，最高加成25%。

---

<h3>排行榜</h3>

官方网站有达人排行榜，了解下大神成绩。。。

---

<h3>原创任务</h3>

服务器增加了一系列的原创任务，有些是独占的。

---

<h3>周提升系统RBS</h3>

每周特定掉率会被提升，包括掉率、稀有怪率、稀有掉率和经验，如果你不是特别感冒，  
可以使用`存粹模式`(如果感觉自己很牛逼，完全不需要享有服务器掉落加成，可通过输入`/purist`开启)。
实际的`掉率(DR)`= `掉物率(DAR)` * `掉宝率(RDR)`

* 第1周: 掉物率(DAR) +25%
* 第2周: 稀有怪出现率 +50%
* 第3周: 掉宝率(RDR) +25%
* 第4周: 经验 +50%

---
** 🎲 每日运势系统简介 **

Ephinea服特有的机制，通过每日随机选出的角色特征（职业、种族、性别），为符合条件的角色提供稀有掉率加成，鼓励玩家根据运势选择角色进行周回。

---

<h3>稳定的药物商店</h3>
药物商店显示全部的药物，小hp、小tp、魂之粉、星之粉等，也就是说不需要刷商店了就可以购买到。

---

<h3>SOLO模式畅玩多人任务</h3>

在任务地图中以往需要多人配合才能打开的，现在不需要了，solo当然没问题了。

---

<h3>丰富的活动</h3>

每年特定时间点会开启相应的活动，活动都是独一无二的， 相应的活动可更容易的获取道具。

* 情人节(Valentine's Day) - 2.14
* 白色情人节(White Day) - 3.14
* 复活节(Easter) - 3月~4月
* 夏季拾荒(Summer Scavenger Hunt) - 6月
* 周年(Anniversary) - 8月
* 万圣节(Halloween) - 10月~11月
* 圣诞节(Christmas) - 12月

---

<h3>大厅点唱机</h3>

大厅柜台增加了点唱机，可以调整大厅音乐。

<h3>可调节的背景音乐和特效音量</h3>

背景音乐和特效音量可在大厅中调节，可以替代游戏启动器相关的配置。

---

<h3>可下载的角色数据</h3>

如果你担心服务器挂掉丢失数据的话，不要担心，你可以随时下载角色数据，这些数据可以直接运行在任意的T端服务器上。

---

<h2>装备条件变化</h2>

* Mag没有职业限制。
* 兔耳和猫耳没有职业限制。
* `花瓶`可以使用`史神克莱奥之杖`。
* 吸经验装备仅仅能吸收固定经验。

---

# GMs
主GM: Sodaboy, Tofuman, Ender和Matt  
辅GM: anime, CARNAGE, MewPlushie, Ryan和Gori  
一般的问题咨询辅GM足够了，对于ban号申述需联系主GM。

---

## 原创任务
### Episode 1
#### – 夺回

* Lost Heat Sword - Sega
* Lost Ice Spinner - Sega
* Lost Soul Blade - Sega
* Lost Hell Pallasch - Sega
* Dark Research – by Namakemono
* Forsaken Friends – by Heloise/Aleron Ives/Lee
* Rescue from Ragol – by Tofuman

#### – 歼灭

* Sweep-Up Operation #1 (Forest) - by Ender
* Sweep-Up Operation #2 (Cave) - by Ender
* Sweep-Up Operation #3 (Mine) - by Ender
* Sweep-Up Operation #4 (Ruin) - by Ender

#### - VR

* Mine Offensive – by RikaPSO
* Random Attack Xrd Stage – by Namakemono
* Simulator – by RikaPSO
* Tyrell’s Ego (Eden’s Saviour) – by Tofuman


#### - 活动

* Maximum Attack E: Episode 1 – by Matt
* Christmas Fiasco – by Heloise/Lee (Event Only)
* Maximum Attack E: Forest – by Matt (Event Only)
* Maximum Attack E: Caves – by Matt (Event Only)
* Maximum Attack E: Mines – by Matt (Event Only)
* Maximum Attack E: Ruins – by Matt (Event Only)

#### – 单人

* Knight of Coral – by Namakemono
* Rescue from Ragol – by Tofuman

### Episode 2

#### – 歼灭

* Gal Da Val’s Darkness – by RikaPSO
* Sweep-Up Operation #5 (VR Temple) - by Ender
* Sweep-Up Operation #6 (VR Spaceship) - by Ender
* Sweep-Up Operation #7 (CCA) - by Ender
* Sweep-Up Operation #8 (Seabed) - by Ender
* Sweep-Up Operation #9 (Tower) - by Ender
* ~~Malicious Uprising #1 – by GuardianGirth/Yata~~
* ~~Malicious Uprising #2 – by GuardianGirth/Yata~~
* ~~Malicious Uprising #3 – by GuardianGirth/Yata~~
* ~~Malicious Uprising #4 – by GuardianGirth/Yata~~
* ~~Malicious Uprising #5 – by GuardianGirth/Yata~~
* Random Attack Xrd Stage – by Namakemono
* ~~Villainous Rift #1 – by GuardianGirth/Yata~~
* ~~Villainous Rift #2 – by GuardianGirth/Yata~~

#### – 夺回
* Lost SHOCK RIFLE (VR Temple) - by Ender
* Lost BIND ASSAULT (VR Spaceship) - by Ender
* ~~Lost SHOCK GUNGNIR – by GuardianGirth/Lee~~
* ~~Lost RIOT RAYGUN – by GuardianGirth/Lee~~
* ~~Lost DEVIL’S SCEPTER – by GuardianGirth/Lee~~
* ~~Lost CHAOS CALIBUR – by GuardianGirth/Yata~~
* ~~Lost HEART BREAKER – by GuardianGirth/Yata~~
* Revisiting Darkness – by Ilitsa/RikaPSO

#### – 塔

* Military Strikes Back – by Cry0
* Raid on Central Tower – by RikaPSO

#### – 活动

* Maximum Attack E: VR – by Matt
* Maximum Attack E: Gal Da Val – by Matt
* Christmas Fiasco – by Heloise/Lee (Event Only)
* Maximum Attack E: Temple – by Matt (Event Only)
* Maximum Attack E: Spaceship – by Matt (Event Only)
* Maximum Attack E: CCA – by Matt (Event Only)
* Maximum Attack E: Seabed – by Matt (Event Only)
* Maximum Attack E: Tower – by Matt (Event Only)

#### – 单人

* A New Hope – by Cry0
* Knight of Coral Advent – by Namakemono

### Episode 4
#### – 夺回

* ~~Lost MASTER’S BLASTER – by GuardianGirth/Yata~~
* Lost BERSERK BATON (Crater)- By Ender

#### – 活动

* Maximum Attack E: Episode 4 – by Matt
* Christmas Fiasco – by Heloise/Lee (Event Only)
* Maximum Attack E: Crater – by Matt (Event Only)
* Maximum Attack E: Desert – by Matt (Event Only)

#### - 歼灭

* Sweep-Up Operation #10 (Crater Exterior) - by Ender
* Sweep-Up Operation #11 (Crater Interior) - by Ender
* Sweep-Up Operation #12 (Sub. Desert 1) - by Ender
* Sweep-Up Operation #13 (Sub. Desert 2) - by Ender
* Sweep-Up Operation #14 (Sub. Desert 3) - by Ender
