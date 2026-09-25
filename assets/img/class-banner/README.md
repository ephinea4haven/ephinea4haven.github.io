# 职业 banner

12 个职业的 HD 横幅，与 `../class/` 的全身立绘同名。来源是 2026-09-25 提供的 `Character HD.zip`（SHA-256 `d10f46d6f419b1fddce686e21790e64a337eda8400d7fbad5e02fc200d1fb5ac`），原图为 4352 × 544 的 RGB PNG，职业英文名和背景色印在图上。压缩包没有附作者或授权信息。

原图的彩色面板外有一圈浅灰底和银色斜边，放在页面上像白边。`scripts/make_class_banners.py` 在每张图里单独找出面板深色外框的外沿（各职业的灰底宽度相差几个像素），按外框裁剪，圆角外透明，同一变体的 12 张统一缩放到相同尺寸，方便切换职业时原位替换：

| 目录 | 内容 | 尺寸 |
|---|---|---|
| `framed/` | 保留深色外框和斜边高光 | 1600 × 172 |
| `borderless/` | 从外框再向内裁 14 px（原图像素），色块直达边缘 | 1600 × 162 |

两种变体都只有圆角外透明，面板本身不透明。统一尺寸时宽高比最多拉伸约 2%。原图不入库，重新生成：

```bash
python3 scripts/make_class_banners.py ~/Downloads/"Character HD.zip"
```

| 文件 | `framed/` SHA-256 | `borderless/` SHA-256 |
|---|---|---|
| HUmar.webp | `d2e3f8c8f0dfeb0def09070071b440b1248f0ffebedd4b6ba43d23d0900062a5` | `a542f2d4446edafdad00aef41ebb94aaa394c5aac288ea24e021e4ba43bf424b` |
| HUnewearl.webp | `b466e0efb0f259d6818bf7e80fcd8233dbce2c8b50579ecdc79cbeccb6d956b2` | `2f4aa4373d0a737ea922305136307a0165f6e12ef1a71f61f0e97235c6786ebf` |
| HUcast.webp | `27c135d4a42c2c19780c22052d5dc240bbe38c04487efdc98bdcb8199e3b50ac` | `5f5dbc097383eb7dbcb7b1f238a5e4e6209dd101f88db7e9406cbcb01028af2c` |
| HUcaseal.webp | `ae5739c033c46f546ee3ef79af583232735baaae6386d37f36c9aab884be0c01` | `b42d649df58f468880bd66f5e5b99b36c3054ab073d2e07002c643a13dcba0d8` |
| RAmar.webp | `9adcbca77f4a17f8296c774996b1f8d1bc13a3e4a6139f837f3c9b899ad51923` | `31d366c8e2817972600367c2551c5e27ca394cb01921cdb9d8029534ddfaff15` |
| RAmarl.webp | `c751e994383514a2d08d1213453bd2a523a1f422c19933cb1a7a7407db1dece2` | `06bcd5e6dc11d5cd8f2e3efaa9e0c14ba37d07552e1ecdefa3955c636c223858` |
| RAcast.webp | `6b47c9d1c242fd9f382d509520010d9f91142191536ff729d79a4ab048dac647` | `11618f5a2933bc9c58ce6decf39e7a3b5b9cb798ca946b5d4a244d74a735947e` |
| RAcaseal.webp | `30638d27e77d380ad7c2cf3620c73f0f602bb6b8768e932cf5cc5690f6e6807e` | `0cff14e939aad037698b81432985d263a71bf57c8138d2ee1aa4c6a94dd26bef` |
| FOmar.webp | `83a16db3072d4c627997376fe506bf021518469a54b672c0786f0d9d7152db9a` | `5a4ae9e033c1dd631562cfe83b54457a9b95eb3bdfa1d171062ed706f8e4bacd` |
| FOmarl.webp | `0f4cc72cb25358922fd12192fdffdd01ad058f51bbc046e8aa2c13a0624e6b7b` | `12f29ff8ffb0ec1f0232fa5a729a55eab3ae53aa2f345d0f8c0c1ae052eef162` |
| FOnewm.webp | `a6be3aa68dc32105fad86551ba992bd1cb9f82eb0ae1ca71ccbe330665c08c36` | `b8d44f007aa067723a00ae4955e7aaa2ef6d9b5e776831b3dba8952c6c57c0be` |
| FOnewearl.webp | `86893d58fe3f8994492e2147436dc33a80d300a65ef3bf2e1bc8221351c56db7` | `2287ad75fe9cba15e1672bf5c28e48bf07e67c46b5faecaafdeedeb24da1deec` |
