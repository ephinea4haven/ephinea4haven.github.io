# Mag 默认图谱素材

46 张 900 × 900 透明 WebP（质量 90）；原始 PNG 保存在验收素材包中，使用 PSOBB 原始模型与贴图，未叠加玩家的 Mag 配色。每张相机独立参照现有图谱校准，使用 Blender 灯光；不等同于游戏内截图，也不表示游戏中名为 White 的配色。原始贴图的分辨率没有提升。

Agastya 使用内嵌动画第 26 帧的展开姿态。Agastya、Garuda、Marica、Rati 与参考轮廓仍有差异；本批预览已由维护者接受。模型、纹理槽位与哈希、相机设置、输出哈希见 manifest.json。

此目录用于图谱默认显示与“原色”重置。`../wiki/` 的天青色图仍是现有颜色预览算法的输入；选色预览是近似效果，不是这些原始贴图渲染的重新着色。`scripts/download_wiki_mag_assets.py` 仅更新 Wiki 配色输入和颜色参考，不会覆盖此目录。

独立 `magfeeder` 项目使用同一套 46 张 WebP 和相同 manifest，文件须保持字节一致。以后更新验收素材时同步两边的 `assets/img/mag/default/`；数据同步命令不负责图片同步。magfeeder 不使用图谱的选色算法，因此不保留天青色输入。

本机完整对照、提取与渲染脚本位于 `artifacts/hd-gallery/mag-default/`（不入库）；其依赖和复现顺序见该目录 README.md。新素材替换需重新核对图谱名称全集、图片尺寸/透明通道/边缘裁切及默认→选色→原色的页面流程。
