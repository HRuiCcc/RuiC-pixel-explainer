---
name: ruic-pixel-explainer
description: 「像素游戏化讲解片」生成产线（16:9 横屏）：给一段口播文案，产出像素 RPG 风格的讲解短片 —— 顶部章节轨 + 底部单行字幕（每句 1 个橙色关键词）+ 地点卡 + 右上署名 + 像素小人演知识 + 相机推近停稳；自动播放像视频，可动手像小游戏（关卡地图 / 选项卡 / 评分 / 通关徽章）。流程：文案 → 事实核查 → 分镜（一句一场景）→ 场景代码 → 逐句配音定时间轴 → 逐帧导出 MP4。触发词：像素讲解片、像素游戏讲解、像素讲堂、游戏化讲解、像素风视频、把这段文案做成像素视频、像素 RPG 讲解、读书讲解片、像《刻意练习》那种视频、pixel explainer。
user-invocable: true
metadata:
  dsh:
    compatibility: native
    requires:
      - node
      - ffmpeg
      - python3
---

# ruic-pixel-explainer —— 像素游戏化讲解片

**他给口播文案，你交一条 16:9 像素 RPG 讲解片**（MP4 / 1920×1080 / 30fps / 带配音）。

引擎与权威规格都在 `~/Desktop/zcode/ai-explain-game/`：
- **母提示词**（视觉与内容的完整规格，做新期先照它）：`prompt/AI知识讲解·像素游戏演示台-母提示词.md`
- **工程**（React 18 + Vite + TS，已跑通三期）：`game/`
- **详细施工细节** → [references/pipeline.md](references/pipeline.md)（SceneDef API / 元素库 / 配音定轴 / 出片脚本 / 10 条坑）
- **风格速查** → [references/style-dna.md](references/style-dna.md)（调色板 / 三件套 / 光源 / 叙事骨架 / 硬规矩）

## 五步 + 两道门

| 步 | 做什么 | 交付物 |
|---|---|---|
| 1 | 文案整理：一句一行，字幕＝口播，每句 ≤22 汉字、只 1 个 `[[关键词]]` | 口播稿 |
| 2 | 事实核查：数字/术语/年份/人名逐个找出处，核不到就删或标"示意" | 出处清单 |
| 3 | 分镜：一句一场景（背景 / 主角 / 主元素 + 出场口播词 / 字幕 / 运镜 / 光源） | **门一：分镜表先发他确认** |
| 4 | 场景代码：`src/content/episode-<slug>.ts` + `src/scenes/<slug>0.tsx` + 注册 pack | 可跑的工程 |
| 5 | 配音定轴 → 逐帧导出 | **门二：静帧逐场发他看 → 渲完成片直接进对话框由他审** |

## 命令（都在 `~/Desktop/zcode/ai-explain-game/game/` 下跑，都是实测过的）

```bash
npm run dev                                   # 起页面（端口被占时 Vite 会换到 5274，以终端打印为准）
npx tsc --noEmit                              # 类型门

# 配音：① 先量真实时长  ② 再按时间码拼整轨
python3 <技能>/scripts/voice_track.py --lines lines.json --work <工作目录> --tts-only
python3 <技能>/scripts/voice_track.py --lines lines-abs.json --work <工作目录> --out voice.wav

# 出片：① 静帧预检  ② 整片导出（30fps / 1080p / 混配音）
node <技能>/scripts/stills.mjs       --url http://127.0.0.1:5274/ --ep <slug> --out stills --times 1.2,3.9,7.6,11.2,14
node <技能>/scripts/render_episode.mjs --url http://127.0.0.1:5274/ --ep <slug> \
     --out "<片名>.mp4" --audio voice.wav --fps 30 --dsf 2 --size 1920x1080
```

出片原理：画面是**时间 t 的纯函数** → 把 t 定到每帧、截图、按序喂 ffmpeg。逐帧确定（脚本自带"同帧截两次字节一致"的自检），与实时录屏无关。耗时约 **0.22 秒/帧**（15 秒片 ≈ 1.6 分钟）。

## 视觉与内容（速查，细节见 style-dna.md）

- **三件套**：顶部章节轨（当前章亮字）· 底部单行字幕（≤22 汉字，每句 1 个橙色 `#ffb347` 关键词）· 右上署名；外加地点卡（字幕上方胶囊）。
- **像素规格**：艺术坐标 320×180 → 缓冲 640×360 → 最近邻放大；成片 1920×1080 = 艺术格 ×6（整数倍不畸变）。
- **调色板**：夜空 `#141a2e`/`#1d2540`、暖光 `#ffbc6b`、霓虹青 `#7ff0e0`、重点橙 `#ffb347`、危险红 `#e0533f`、纸 `#e8e2d0`。
- **字体**：场景内 Fusion Pixel 12px（只允许整数倍字号）；**字幕用系统粗体 + 描边**（不像素化）。
- **光源**：每场景一个主光源 + 暗角，主角站在光里；禁止无光平铺。
- **主角**：`pixel/character.ts` 的 `SKINS`（`classic` / `archivist` 夜班档案员 / `host` 深夜电台）× 配饰 `acc`（`glasses` / `headset` / `cap`）—— **每期换皮换配饰就是"新角色"**，要更狠就加一套 12 色键的新皮。
- **背景**：8 个成品背景 `city` `worldmap` `library` `terminal` `starfield` `warning` `lab` `workshop`。
- **讲解元素**：`ui/elements.tsx` 的 B1–B21（打字机 / 大数字 / 算式黑板 / 金边面板 / 填空猜词 / 选项卡 / 星级 / A-B 双卡 / 道具卡 / 节点连线 / 聊天气泡 / 警示面板 / 进度条 / 折线图 / 清单 / 徽章 / 关卡牌 / 参数旋钮 / 工具调用…）。
- **叙事骨架**：数字钩子 → 上地图 → 每关"是什么/为什么/怎么起作用"（一个可画的贯穿比喻）→ 通关三件事 → 金句收尾（结尾单独设计）。

## 硬规矩（违反即打回）

1. 一句口播一个场景（6–14 秒，15 秒短片可 4–6 秒/场）；30 秒 8–10 刀是上限，别切快。
2. 元素出场**锚定口播词**（说到哪个词才动），不许抢跑、不许演完就静止；每句都要有一处可察觉的变化。
3. 镜头**动完要停稳**，不许整段慢漂移。
4. 画面三忌：不空（≥2 秒无变化不行）/ 不挤（主元素 ≤1）/ 要丝滑。
5. 结尾单独设计，别用中段套路、别一直停住。
6. 字幕**永远单行 ≤22 汉字**，每句只高亮 1 个橙色关键词。
7. 画面不出现网址后缀、不出现金额数字、"爬取"字样；用词替换：免费→白嫖、token→代币、供应商→大模型；不出现 Claude/Codex/GPT 等产品名。
8. 数字/术语/年份/人名必须有出处；估算值画面标"示意"。
9. **样式每期必须换款**（标题条与底部轨道至少换一处）—— 多账号共用素材，连着几期一样会被看出同源。
10. 交付：成片 + 每场景静帧 + 口播稿 + 规格，给**绝对路径**（默认落 `~/Desktop/zcode/`）；**渲完直接进对话框由他审**，不要先自审。

## 实例（照它抄最快）

**第 3 期 · 15 秒样片《它答得像，不等于答得对》**（2026-10-09 本技能实测产物）：
- 内容文件 `game/src/content/episode-hallucination.ts`，分镜 `game/src/scenes/mx0.tsx`，注册在 `game/src/scenes/index.ts` 的 `EPISODES`。
- 3 场 / 15.0s / 1080p30 / 6 句配音（剪映音色，时间轴 `450, 2650, 5450, 7400, 10400, 12500` ms）。
- 新主角：`SKINS.archivist`（青灰短发 + 墨绿工装 + 砖红围巾）+ `acc: 'glasses'`。
- 三场主元素：`ChatMock`+`NeonSelect`（答得太顺）→ `FillBlank`（只学像不像）→ `CompareCards`（当打字机）。

## 文件

| 文件 | 用途 |
|---|---|
| `references/pipeline.md` | 施工细节：分镜表字段 / SceneDef 与元素 API / 配音定轴 / 出片参数与耗时 / 质检表 / 10 条坑 |
| `references/style-dna.md` | 视觉 DNA：三件套 / 调色板 / 字体 / 光源 / 常驻 HUD / 叙事骨架 / 元素库 / 硬规矩 |
| `scripts/voice_track.py` | 逐句 TTS（剪映音色）→ 量真实时长 → 按时间轴拼一条音轨 |
| `scripts/render_episode.mjs` | 逐帧导出成片（`--fps/--dsf/--size/--audio`，自带确定性自检） |
| `scripts/stills.mjs` | 静帧质检：抽若干时间点的画面出来看（渲片前必跑） |
