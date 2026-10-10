# ✦ RuiC Pixel Explainer

> 一条**粗像素电影式讲解片**生成产线（Agent Skill）：给一段口播文案，产出带配音的 **1920×1080 / 30fps** 横屏像素讲解片（MP4）+ 一份可改的工程。
> 知识点被演成像素世界里的动作：资料卡飞进收藏栏、检索槽查不到内容、合上笔记答题、卡点被标记、答案对照、经验条与钥匙奖励。

源流派：像《刻意练习》＝"神"的武器那一类**像素游戏风读书讲解片**。
本仓库把这种风格做成**可复现的产线**：画面是**时间的纯函数**，逐帧导出、逐帧确定（同一帧重截两次字节必须一致），不靠录屏。

---

## 🎬 演示 ·《收藏不等于学会》20 秒

**deepseek flash生成**

<https://github.com/user-attachments/assets/522644ab-0875-4d18-8994-306fc1beb279>

> **大人物 0–10 秒**：收藏了一堆干货，真要用时，却想不起来。／ 存下来，不等于学会了。／ 你缺的，是一次提取。
> **小人物 10–20 秒**：合上笔记，先答一道题。／ 卡住做标记，马上对答案。／ 答出来，钥匙才真正属于你。

## 🎬 演示 · 双角色样片（橙发 / 蓝发）

**GPT6.1Sol 生成**

<https://github.com/user-attachments/assets/7ae16020-a06b-488a-8e5e-c2cc143761b7>

<https://github.com/user-attachments/assets/6ca09ced-0c1f-48b1-8515-1868c6ef87c6>

同一套产线换两名角色与两套场景：半身开场 4 个表情 ＋ 4×4 小人格 16 个姿态，各 20 秒。

> **橙发角色 · 排练室**：别急着从头开始。
> **蓝发角色 · 月窗工坊**：先动手，再等灵感。

---

## 这是什么

- **输入**：一段口播文案（一句一行）。
- **输出**：一条 20 秒级的成品 MP4（1920×1080 / 30fps / 带配音）+ 可继续修改的工程 + 关键静帧 + 真实规格。
- **做法**：把文案拆成**语义拍**，给每一拍设计一个看得见的动作（进入、检索、答题、标记、对照、奖励），再用代码把人物、场景、道具画出来，逐帧导出。

**它不是什么：**

- 不是文生视频模型 —— 没有一帧是"生成"的，全部由代码按时间绘制，因此**可复现、可回退、可改一个字重出**。
- 不做精细插画。粗像素是**故意的**：块面要大、纹理要少、脸要清楚；密集纹理、发丝、亮晶晶大眼、满屏花纹都是反方向。
- 不把整片画面包当成可编辑骨骼 —— 逐帧恢复原片像素是另一条口径，详见 [references/reference-modes.md](references/reference-modes.md)。

---

## ✨ 它能做什么

### 1. 两档人物，一套身份

| 档 | 尺度（1080p 里） | 用途 |
|---|---|---|
| **半身人物** | 主体约 400–620 px 高，脸 280–400 px，色块 12–20 px | 情绪与开场 |
| **Q 版小人** | 主体约 130–220 px 高，色块 4–8 px | 在世界里演步骤 |

半身人物是**独立的腰线以上设计**（从完整帽子或头盔到腰线：肩、胸、袖子、手臂与方手，腿脚不入镜）；Q 版小人是**同一个人的大头行动版**（约 24×31，大头短身、厚的阶梯轮廓，站立 / 走路 / 庆祝）。
**脸上不额外画鼻子** —— 无突出侧鼻、鼻梁、中央鼻影或鼻尖高光，用眼睛、小嘴和少量腮红表达表情。

人物资源按宿主能力分两条路线（详见 [references/imagegen-route.md](references/imagegen-route.md) 与 [references/code-route.md](references/code-route.md)）：

- **A · 生图角色**：参考图 → 每角色一张 **4×4 透明动作表（16 格）**＋一张 **半身表情表** → `register_actor_sheet.py` 按 alpha 间隔注册 → `SpriteActor` 在 Canvas 里绘制；
- **B · 代码角色**：不依赖任何生图能力，用升级后的 `frontActor` / `sideActor` 直接绘制，可通过 `hairStyle` / `headwear` / 眼色 / 眼罩等字段配置。

⚠️ 旧线索里那套 14×21 小精灵不符合当前规范，**不能只换色或放大继续用**。

### 2. 八个可复用讲解组件（`assets/cinematic-template/components.mjs`）

坐标是原生 1920×1080，值 / 状态 / 标签 / 透明度都由该期时间轴决定：

| 组件 | 主要参数 | 何时用 |
|---|---|---|
| `drawPaper` | x / y / w / h / mark / alpha | 内容卡进入、移出、被标记 |
| `drawInventory` | x / y / w / count / title / state / alpha | 收藏、装备、资源、学习库存 |
| `drawRecallPanel` | x / y / w / title / state / alpha | 查询 / 检索 / 缺失结果（empty / failed / success） |
| `drawOpenBook` | x / y / w / h / closed / mark | 看资料、合上资料、闭卷、卡点 |
| `drawQuizBoard` | x / y / w / prompt / answer / reference / reveal / correct / mark / alpha | 问题 → 尝试回答 → 展开参考答案 → 对照与修正 |
| `drawMarkerFlag` | x / y / label / alpha | 错误、路上的卡点、待练项目 |
| `drawFeedback` | x / y / w / progress / state / alpha | 即时对错、经验变化（correct / pending） |
| `drawRewardBadge` | x / y / label / alpha | 获得能力、通过验证、解锁道具 |

它们都是**世界里的道具或 HUD**，不是整页截图；标签从当期 episode 数据传入 —— 库本身不绑定任何一期的口播、音色或语速。

### 3. 语义事件时间轴（`visualBeats`）

在 `episode.json` 里给一条时间轴，`scene.mjs` 的增强分支就会按事件把组件一个个开出来（不写就是简版）：

```json
{
  "visualBeats": {
    "collectAt": 500, "queryAt": 2000, "contrastAt": 4500, "retrieveAt": 7000,
    "testAt": 11000, "closeAt": 11000, "markAt": 13500, "checkAt": 14500,
    "correctAt": 16500, "rewardAt": 17300, "unlockAt": 18200, "walkAt": 15400
  },
  "componentLabels": {
    "inventoryTitle": "收藏栏", "queryTitle": "调取记忆", "contrast": "存下 ≠ 学会",
    "taskTitle": "当前任务", "prompt": "本次问题", "wrongAnswer": "尝试回答",
    "rightAnswer": "参考答案", "reward": "能力已解锁"
  }
}
```

**一拍一个因果变化**：资料飞入时看库存，检索失败时看结果，核对时看回答与参考答案，成功后才给奖励。
面板与角色行动分开编排（角色初始站位 / 行走经过区域 / 终点都要考虑）；绘制顺序是背景 → 人物与手持道具 → 奖励与 HUD，别让开门的矩形把奖章抹掉。

### 4. 逐帧确定（这条产线的硬门槛）

`CinematicScene.draw(canvas, ms)` 是纯时间函数；表面纹理用固定随机种子；`window.__player.set(ms)` 单点定位。
出片时逐帧截图喂 ffmpeg —— **同一帧截两次必须字节一致**，不一致就停下修，不许把 CSS 墙钟动画或 `Math.random()` 放进录制画面。

---

## 🧩 它怎么工作

```mermaid
flowchart LR
  A[口播文案] --> B[拆成语义拍<br/>每拍一个动作]
  B --> C[人物与场景分别设计<br/>先锁身份特征，再做半身与小人]
  C --> D[逐句配音 · 后端自带<br/>量真实时长 → 排字幕与动作]
  D --> E[纯时间函数绘制<br/>先静帧查比例与遮挡]
  E --> F[逐帧导出<br/>t 定点截图 → ffmpeg]
  F --> G[MP4 + 可改工程<br/>+ 关键静帧 + 真实规格]
```

## 🛣 工程路由（按宿主生图能力选）

| 路由 | 适合 | 说明 |
|---|---|---|
| **A · 生图角色**（`assets/imagegen-template/`） | 宿主能调用图片生成（img2 / 内置 imagegen / 使用者已授权的生图后端） | 参考图 → 4×4 透明动作表 ＋ 半身表情表 → `scripts/register_actor_sheet.py` 注册（按 alpha 间隔切图、统一缩放与脚底/腰线锚点）→ `sprite-actor.mjs` 适配器在场景里绘制。模板是**静音资产检查页与适配器**，不带角色 PNG，缺图会报错。接法见其 `INTEGRATION.md` |
| **B · 代码角色**（`assets/cinematic-template/`） | 没有生图能力，或用户选择纯代码 | 原生 1920×1080 Canvas 粗像素样板；升级后的 `frontActor`（半身）/ `sideActor`（Q 版小人）直接绘制，人物 / 后景 / 道具 / 前景 / 灯光 / HUD / 字幕各自独立；**自包含**（含 pixel 字体与 20 秒示范配音），复制走再改 |
| **③ 已有的 React 工程** | 完整地图、选择题、评分、通关流程 | 沿用它的 `SceneDef` / `Pack` 接口；仅对新一期选它，保留已验收的旧期。接法见 [references/pipeline.md](references/pipeline.md) |

无论哪条路，都复用同一套字幕、讲解组件与导出器；四条视觉锚点在 `assets/reference-frames/`（只用于定标，不当作所有主题的默认角色与场景）。

**自带样板里有什么**（`assets/cinematic-template/`）：

- `scene.mjs` —— 画人物（`frontActor` / `sideActor`）、后景、道具、前景、灯光、HUD、字幕；内置零件：吊灯、座钟、书架、椅子、地板、聚光锥、暗角、金边面板、问号、钥匙
- `episode.json` —— 主题 / 作者 / 时长 / 帧率 / 切点 / 角色配色（`actor`：发色、发亮部、外套、外套亮部、围巾、肤色三档、配件）、章节、说话区间（`voice`）、字幕（`lines`）、事件层（`visualBeats` 可选）
- `components.mjs` —— 上面那八个组件
- `index.html` —— 播放器 + `window.__player.set(ms)/total`（导出器认这个钩子）
- `serve.py` —— 本机 HTTP 服务，支持音频 byte-range
- `assets/fonts/` —— Fusion Pixel 12px（OFL-1.1，含许可证）；`assets/voice.wav` —— 20 秒示范配音，**新主题必须替换**（用自己的后端生成，或直接换成品音轨，见「配音与时间轴」）

## 🚀 快速开始

先按 [SKILL.md](SKILL.md) 确认宿主有没有可用的生图能力，再选路线：**有生图走 A**（见 [references/imagegen-route.md](references/imagegen-route.md)），**没有就走 B**（下面这套）。

```bash
# 0) B 路线：复制纯代码模板到本次项目（别直接改模板）
cp -R assets/cinematic-template <本次项目目录>
cd <本次项目目录>

# 1) 改 episode.json：主题、角色配色与可选字段（hairStyle / headwear / eye / eyePatch）、说话区间、字幕（以及可选的 visualBeats）
#    ⚠️ 改配色 ≠ 设计新角色；模板字段不足以表现新轮廓时，扩展 scene.mjs 的 frontActor / sideActor 与新场景代码

# 2) 起本机预览
python3 serve.py --port 8778 --open

# 3) 逐句配音 + 量真实时长（两步走；配音后端要你自己给，先 --check 验证）
python3 <技能目录>/scripts/voice_track.py --check
python3 <技能目录>/scripts/voice_track.py --lines lines.json     --work work --tts-only
python3 <技能目录>/scripts/voice_track.py --lines lines-abs.json --work work --out voice.wav

# 4) 静帧预检（先看比例、遮挡、字幕安全区）
node <技能目录>/scripts/stills.mjs --url http://127.0.0.1:8778/ --out stills --times 1.6,6.2,10.5,14.8,18.4 --dsf 1.5

# 5) 逐帧出片
node <技能目录>/scripts/render_episode.mjs --url http://127.0.0.1:8778/ --out sample.mp4 \
     --audio voice.wav --fps 30 --dsf 1.5 --size 1920x1080 --threads 2
```

**A 路线**先注册生成的角色资产，再把 `sprite-actor.mjs` 接到模板上（完整接法见 `assets/imagegen-template/INTEGRATION.md`）：

```bash
python3 <技能目录>/scripts/register_actor_sheet.py --sheet mini.png     --grid 4x4 --canvas 256 --baseline 240 --out assets/sprites
python3 <技能目录>/scripts/register_actor_sheet.py --sheet half-body.png --grid 2x2 --canvas 512 --baseline 500 --out assets/bust
```

> 🔊 配音后端由**你自己**提供（HTTP API 或本地 TTS 命令）；本技能不带内置音色，`--check` 先试听一句，接法与配置见 [references/pipeline.md](references/pipeline.md) 第 5 节。

`--dsf 1.5` 是用意的：**1280×720 视口 ×1.5 直接得到 1920×1080 截图**，避免先截 2560 再 Lanczos 下采样把像素边缘柔掉。要别的尺寸就自己核对输出。

## 🎨 视觉定标

| 层 | 1080p 里的建议尺度 | 用途 |
|---|---|---|
| 半身人物 | 主体 400–620 px 高，脸 280–400 px，色块 12–20 px | 情绪与开场 |
| Q 版小人 | 主体 130–220 px 高，色块 4–8 px | 在世界里演步骤 |
| 环境 | 建筑 60–180 px 的大体块；细线 2–8 px | 深度、位置、质感 |
| 字幕 / HUD | 原生 1920×1080 单独绘制 | 与镜头解耦 |
| 柔光 / 暗角 | 原生画布、低对比渐变 | 确立光源，但不柔化脸 |

- **脸**：约 18–28 格宽、20–24 格高；头发 2–3 个块面；肤色 3 层就够；**不要**细发丝、渐变脸、虹膜反光；**不画鼻子**（无侧鼻、鼻梁、中央鼻影、鼻尖高光），表情靠眼睛、小嘴与少量腮红。
- **手**：可与身体略分离，方块手势，有肩膀和衣领。
- **场景密度**：两三个识别物就能定地点（修理铺＝桌椅＋灯＋钟；记忆关卡＝书＋路＋锁门），且**场景要对应角色**（按角色气质与本期动作设计空间，不套同一个房间或只换背景色）；大部分处在暗部，纹理只用来辨认材质。
- **光与色**：暖主光约 `#d8c58c`；外围近黑棕或灰绿；皮肤 `#edc49c` / `#ddb18c` / `#bf926c`；轮廓 `#19221e`；金边与关键词 `#cfab57` / `#d9a13e`；青绿只给反馈或路径。每场一个主光源，前景桌边挡腿、道具不挡脸、字幕占最后层。
- **字幕**：本地 Fusion Pixel，通常 60–72 px，纸白外描边＋暗内描边＋**一个金色关键词**；单行居中、底部暗区；超宽按语义拆拍，不强行缩小。
- **HUD**：半身开场可以先不给章节轨；进小人物关卡后再出现导航、署名、计数或反馈 —— 不是每镜都塞满导航＋地点卡＋进度＋状态卡。

## 🔊 配音与时间轴

- 中文口播约 **4.5 字/秒**，但句读、数字、英文都会拉长 —— 所以**先 TTS 量真实时长，再排字幕与动作**，不靠极端变速迁就拍脑袋的时间轴。
- `voice_track.py` 默认**拒绝段落重叠**（要叠声才传 `--allow-overlap`）；**不裁句尾凑预算**；拼轨时把每句摆到它的 `at`（前面补静音），所以画面时间轴与配音天然对齐。
- 出片端按画面长度**补静音**，不用 `-shortest`（音频短一点会把画面尾巴吃掉）。
- **配音后端由你自己提供**（本技能不带任何内置音色）：HTTP API 或本地 TTS 命令两种接法、请求/响应约定与配置优先级见 [references/pipeline.md](references/pipeline.md) 第 5 节；`--check` 一句话验证接好没有。
- 已经有成品音轨（真人录音、别的工具合成）就跳过合成，把 `render_episode.mjs --audio` 指过去；但字幕与动作仍要按它的真实时长排。

## ✅ 验收清单

- [ ] **同一帧重截两次字节一致**（`render_episode.mjs` 自带抽帧自检）；确定性问题先修再渲。
- [ ] 关键静帧逐张看：半身脸的表情结构、半身与小人比例、前景遮挡、字幕字形与安全区。
- [ ] `ffprobe` 核对：时长、帧数、帧率、音轨。
- [ ] 文字：单行、不压字幕带、不盖脸；数字有出处、示意读数不伪装成真实统计。
- [ ] 交付：MP4 + 可改工程 + 关键静帧 + 口播文本 + 真实规格；**渲完直接给用户审**，不派代理重复整片审片。

**原创片没有逐帧 RGB 一致性承诺** —— 视觉参考只作风格与规格依据；只有实际采用恢复像素并完成校验时，才可以报告像素一致性。

## 📦 目录

```
RuiC-pixel-explainer/
├─ SKILL.md                     技能主文件（放进 ~/.agents/skills/ 就能被 Agent 调用）
├─ references/
│  ├─ imagegen-route.md         A 路线：生图角色的两套资源（4×4 动作表＋半身表情表）与提示词约束
│  ├─ code-route.md             B 路线：升级后的代码角色函数与可配置字段
│  ├─ style-dna.md              视觉定标：三档分辨率 / 人物 / 场景密度 / 光色 / 字幕字体
│  ├─ cinematic-profile.md      B 样板配方（人物参数、镜头切点、说话区间、验证重点）
│  ├─ teaching-components.md    讲解组件与语义事件（怎么做"有东西在演"）
│  ├─ reference-modes.md        原创参考 vs 素材恢复两条口径
│  └─ pipeline.md               工程接法（旧 React 工程 + 配音后端 + 导出器）
├─ scripts/
│  ├─ voice_track.py            逐句 TTS（后端自带：HTTP API / 本地命令，带缓存）→ 量时长 → 按时间轴拼一条音轨
│  ├─ register_actor_sheet.py   角色图集注册：按 alpha 间隔切分、统一缩放、脚底/腰线锚点
│  ├─ render_episode.mjs        逐帧导出（自带同帧重截一致性检查）
│  └─ stills.mjs                静帧质检（渲片前必跑）
├─ assets/
│  ├─ imagegen-template/        A 路线的静音资产检查页与 SpriteActor 适配器（不含角色 PNG）
│  ├─ reference-frames/         最新样片的四张视觉锚点（定标用）
│  ├─ cinematic-template/       B 路线的自包含粗像素样板（原生 1920×1080 + 字体 + 20s 示范配音）
│  └─ wechat-donate.png
└─ demo-20s.mov                 示范成片（20 秒 / 1920×1080 / 30fps / 带配音）
```

## 🔧 装到本机

```bash
cp -R RuiC-pixel-explainer ~/.agents/skills/ruic-pixel-explainer     # 技能权威源
python3 ~/.agents/registry/deploy_skills.py --sync                   # 软链给 claude / codex
python3 ~/.agents/registry/gen_registry.py                           # 刷新能力注册表
```

依赖：`node`（导出器用 playwright 驱动浏览器）、`ffmpeg`、`python3`（配音、拼轨与 `register_actor_sheet.py`，后者另需 Pillow + numpy）。

## ❓ 常见问题

**为什么"粗"？能不能更精细？**
不能 —— 粗像素是这个流派的本体。用户原话是"场景、人物都不要这么精细"：块面要大、纹理要少、脸的对比要高于背景。精细插画会让它变成另一个东西。

**为什么不录屏，非要逐帧导出？**
录屏受机器负载影响会丢帧、抖动，且不可复现。逐帧导出把 `t` 钉在 `n/30` 秒上，同样的代码永远出同样的帧 —— 改一个字重出，只差那一处。

**为什么字幕要先预载中文字形？**
只传拉丁字符的 `fonts.load()` 不会触发中文字形包，首帧可能临时用系统字（看起来"字幕变了"）。预载要传**完整中文文本**，并等 `document.fonts.ready`。

**配音为什么不带 TTS？**
各家 TTS 的音色、语言与合规要求都不同，所以仓库只保留"逐句合成 → 量时长 → 拼轨"的骨架：接你自己的 HTTP 接口或本地命令（见 [references/pipeline.md](references/pipeline.md) 第 5 节）。样板里的示例配音只是占位音轨，换成你自己的即可。

**字体授权？**
样板用 Fusion Pixel 12px（OFL-1.1），许可证随字体一起放在 `assets/cinematic-template/assets/fonts/`。

## 声明

- 本产线交付的是**原创绘制**：人物、场景、道具、字幕全部由代码画出；参考片只用于风格与规格定标。
- 示范成片使用样板自带的预置示例配音（`assets/cinematic-template/assets/voice.wav`），未使用任何真人录音；本技能不带内置 TTS，配音后端由使用者自己接入。

## 赞赏支持

<div align="center">
  <img src="assets/wechat-donate.png" width="300" alt="微信赞赏码" />
  <p><strong>微信扫码赞赏</strong></p>
</div>
