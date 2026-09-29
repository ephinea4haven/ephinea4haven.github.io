# Destiny 道具独立外观缺口

按当前图库清单生成：246 个掉落名称仍使用共用类别图。这不表示道具在游戏中一定没有独立外观。

| 下一步 | 数量 |
| --- | ---: |
| 需要确认道具身份 | 9 |
| 当前 ItemKT／模型路径无单件图 | 215 |
| 候选模型或纹理槽不可用 | 22 |

模型档案有 450 个条目，纹理档案有 546 个条目。逐项候选代码、槽位、可用性、哈希和拒绝原因见 `remaining-appearance-audit.json`。

## 需要还原运行时特效



现有静态图被拒绝：不透明平面无法呈现戒指光效。

## 候选模型或纹理槽不可用

ASSIST BARRIER, ATTRIBUTE WALL, BLUE BARRIER, CHAOS HALO, COMBAT GEAR, DIVINE BLADE, GOLDEN HALO, INVISIBLE GUARD, LIGHT RELIEF, PROTO REGENE GEAR, RECOVERY BARRIER, RED BARRIER, REGENE GEAR ADV., REGENERATE GEAR, S-PARTS ver1.16, S-PARTS ver2.01, SACRED GUARD, Star Eulogy, STINK SHIELD, TWIN RIKA'S CLAW, VENUS BOW, YELLOW BARRIER

其中部分代码仅由官网参数匹配得到，仍需确认道具身份。

## 需要确认道具身份

Administrator's Core, Blue Crystal, Cladding of Manipulator III, Darkness Photon Sphere, Hallowed Jack-O-Lantern, Millennium Photon Core, Primal Photon Sphere, RADIANT RING, Red Crystal

另外 215 项属于工具、插件或防具；当前 ItemKT／模型路径没有单件图，需要寻找其他可核验的图像来源。
