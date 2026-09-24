# Mag 配色遮罩

46 张 900 × 900 单通道无损 WebP，与 `../default/` 的同名渲染逐像素对齐。白色表示游戏客户端会用玩家所选 Mag 颜色着色的模型节点，黑色为固定颜色的节点；灰阶是抗锯齿边缘。图谱选色时，底图像素按 `像素 × (1 − m + m × 颜色)` 着色（`m` 为遮罩值），与客户端“贴图 × 常量材质颜色”的着色方式一致，其余像素不变。

着色节点来自 bb-psov4 `evidence/mag-color-nodes/mag-color-nodes.json`：Ephinea `ItemMagEdit.prs` 的每种 Mag 节点编号，加上 `Psobb.exe` 中按种类硬编码的补充节点；依据、节点与部位对照见 bb-psov4 `docs/psobb-mag-color-rendering.md`。

遮罩由本机 `artifacts/hd-gallery/mag-default/render-color-masks.py`（不入库）从重建的图谱渲染场景生成；重建场景的渲染与 `../default/` 的原始 PNG 逐像素一致。每个材质按客户端遍历顺序追溯到模型节点，保留贴图透明度与遮挡。Apsaras、Bhirava、Sita 的着色节点在图谱视角下被主体遮挡，选色后几乎看不到变化；Sato 的全部几何由着色节点绘制，因此整只着色。

遮罩只是在图谱视角下的静态对应，未与游戏内截图逐一比对；颜色值为页面色板的十六进制值。

| 文件 | SHA-256 |
|---|---|
| Agastya.webp | `dfc9de3a56d7a3207ef83e95673e2a956e8d3af0a7d3894a3baf13b1764bb0aa` |
| Andhaka.webp | `b65f032c082d02202213027cd3a25086c7cb38b03a160ae1e4b83d0f50a78b07` |
| Apsaras.webp | `e73e2a380fbade0bc3403cdc481ad8807d28f88f5da5f84fbec287d7789678f2` |
| Ashvinau.webp | `ea25ee595437953e57e17388bb9b9f4a40bd9c6f530cd8929c3442253d3af4ad` |
| Bana.webp | `cd14db9c2272e4c6c8b4e9e99fbc142e6e1d7d25b8d7fe50b26521adef40e742` |
| Bhima.webp | `a5ee058f0b2b21f42a0dcabc782287547ee39192e192c017f4b3394c2b9e6e87` |
| Bhirava.webp | `73315448fddc5b7c98efccfe4287f92083d97653989e7ab4212ed49699fdcc73` |
| Deva.webp | `3382994e68af4b24ea8b901f2ef1421c7d81a734f7ae9fd93bca60b995327f79` |
| Diwari.webp | `c20ba23672fe721230474b061d1484fedf4c78a9e9e53692f2bab80fb6e9521d` |
| Durga.webp | `e631f5e28cdf0777b5e9a8f798497a4a76fc3915f49cedc963f72d38bbf045f8` |
| Garuda.webp | `6cdee60412ecbfe2dce7de5173068e6f54a6d71cf2a3b3af69359c356592c8c3` |
| Ila.webp | `af4ee3f8a49bb6d6c72a31b1e8d1066694c5df0bed1e05352264016e093a9b9e` |
| Kabanda.webp | `af83384e9e29207390eae94cdfed51e0ccf0fa232cb3871f3c13654f392b2978` |
| Kaitabha.webp | `9c5a41c8fdbde43d9948c890d025d31c0c1fba2121e21f579724acb3db033a09` |
| Kalki.webp | `a49be5a70e31e0bdb0dbb9e244de66e2b5161a7babd3fc04b0f6cd39a8ee2285` |
| Kama.webp | `14fc0d902d15e1a18ca9c8ed04009480ef9043c931fc54ba4c38926d53a953b9` |
| Kumara.webp | `3a7cc9a9f90299d5e8f03c55818de4ac9137e764ad9d3de325a9efc986e8ea8e` |
| Madhu.webp | `1bc717882b9bb65ff422789e33cf5c799362e9dff20117e42f54cee0fb39a69f` |
| Mag.webp | `bcc7f1847b3809ad38ee38ea726a64e9b2bce56be402ad3db9ea712775ddc8dc` |
| Marica.webp | `b4897861ebecc234187031b9443540c44af1bb946f2c7eb6bc8595d9cab694ee` |
| Marutah.webp | `3ad79332896bc2e6bdef583c68b3e4b955ed63ebd9b6b35a34927a56d022034b` |
| Mitra.webp | `b83da78d960c06f1d09810f53abffd61024e50289cb55138594d971649df5532` |
| Naga.webp | `3693be7c728b2da3615c152255f27763af4b68c88bcd0674b4c32a0d19952c08` |
| Namuci.webp | `a2e1b4dc0ea2707829dda6d3a95b339b1d605ecfcbfba94ba66b0a1e4f3ca492` |
| Nandin.webp | `f291c73e2907a366e40f48cae19b5c8aa85df4ee2105feea2f577fb5497ac3de` |
| Naraka.webp | `99adf86a0dd92846657f20bc9ad0c8d12fdec54f0b5ddf73d96fab1e7eff2fc4` |
| Nidra.webp | `43002aa1a6ca591e498ce7cc2aef232b57c3b50bc95470be7d1e9ca5ee80fde8` |
| Pushan.webp | `cb5a555b2af3f3bce6bc784bb7b49d5b50bd34583608c8fd51371fffb9f4dda5` |
| Rati.webp | `50c192a9b2651374fc24ed026c01cc245264453d4f6f9cb1404b6ba3cf44df71` |
| Ravana.webp | `1d7357afbc90fa39f1a4951578f774c5fca4767abdf0a6027ab6f96ed4d84f00` |
| Ribhava.webp | `031bffbfa795fcbdcf9c7d0bb9c86574c0c09afe7a310462887a0af82a1e748d` |
| Rudra.webp | `c40d2bea7cca1b89abb3f707f124406f19a9714ea147c648f8b24371ffbdc1e5` |
| Rukmin.webp | `38b01fa918c6c2603720b526aed1fefa5dc09228a18c9d9c452c2efdc34e9000` |
| Sato.webp | `1bd15fd45b02faba2d83abf82c68e220d50d6ac25eea71ce7b209f04a116c45f` |
| Savitri.webp | `552f743823f0594318d7882cc3edda288d613d084a1d39614ee3a56cf0c1c550` |
| Sita.webp | `5669b717786143a154f1ea74b307fb5b8c960b7335e94b11bfc19fc25bf73aae` |
| Soma.webp | `447cca316823e0a098b0ee4bb024e954b982dbb592d388534bd7eb4b1cf02aeb` |
| Sumba.webp | `319a9df70d6ca5da22f9d8ac694478823bc2b3cd4934e08c2aa7daba2d4eab56` |
| Surya.webp | `c4ff4e7cee4ef3f99530bb5e437bc6e477987d938d25a21d06fb2c893d445424` |
| Tapas.webp | `e11919adaab1635ac05d3c7108d4d9e79b10a8f7abfbc540ec4feee926c4179d` |
| Ushasu.webp | `98c2224625ec5e847147e799977815d47711dd0de9253e78f8bdb713edb0f280` |
| Varaha.webp | `10001198534b77233d8d87f8ab1bd2fdfc1eb8c6c8a85ecd38cb022fa8361dd1` |
| Varuna.webp | `d8ebaf5e1570c45b5d492639e693f0cc62e3deb5983ad1db68d331fd64c76974` |
| Vayu.webp | `d349cbd380e097c1b0bc9fdb9d0a4deb8303da238926ed9f16dbe7a46059cbd3` |
| Vritra.webp | `35e5918c0988398b258dd93504dd0df4097597ab89f8d117b739b677ab1fb0b2` |
| Yaksa.webp | `18a9f9e08fa379e1edec46538f86bc11498806055d6f7c441020af54083ead3a` |
