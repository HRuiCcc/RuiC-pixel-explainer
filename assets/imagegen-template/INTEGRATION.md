# 透明角色接入

这个目录是角色资产适配器和静音检查页，不包含人物 PNG、主题场景、口播或音色。没有资产时会明确报错。不得用检查页充当成品场景。

## 注册图集

用 `scripts/register_actor_sheet.py` 将新生成的透明 4×4 小人动作表注册到 `assets/sprites/`，透明 2×2 独立半身表情表注册到 `assets/bust/`。脚底基线用 256 / 240，腰线用 512 / 500。

```bash
python3 scripts/register_actor_sheet.py --sheet /absolute/mini-atlas.png --grid 4x4 --canvas 256 --baseline 240 --out assets/sprites
python3 scripts/register_actor_sheet.py --sheet /absolute/portrait-atlas.png --grid 2x2 --canvas 512 --baseline 500 --out assets/bust
```

脚本按实质 alpha 的行列间隔分离，统一缩放系数、脚底或腰线；不按图片尺寸等分。生成图常含 alpha=1 的散点，默认 alpha>128 仅用于定位轮廓和网格，输出保留裁剪区域的原始 RGBA 与最近邻采样。默认裁图在实质轮廓四周保留 3 像素边界，忽略远离主体的 alpha=1 噪点，不抠白背景、不补画、不改色。若图集没有透明间隔，或同一表主体高度差超过 1.5 倍，明确失败并重新生成，不逐帧单独缩放来掩盖。已有非空输出目录不会被覆盖。输出 manifest 记录阈值、实际源区域、裁区、统一系数与每帧核心边界，必须检查没有发饰或道具被截掉。

## 接入已有 Stage / CinematicScene

先把已验证的 `assets/cinematic-template/` **本地复制**到本次工程，复用其字幕、HUD、组件与导出脚本；场景背景按新角色重新设计。将本目录 `sprite-actor.mjs` 复制到本次工程的根目录。

以下接法针对随技能提供的实际模板：`CinematicScene` 当前没有 `load()`，人物直接在 `bigLegacy`、`smallLegacy`、`big`、`small` 四处调用 `frontActor` / `sideActor`。必须替换这四处，并在播放器初始化时等待加载；只添加新方法不会让 PNG 被用到。不要在 PNG 上再画五官、鼻子、衣服或换肤滤镜。

### 1. 本期 JSON 明确写资产与已核对的帧序

在 `episode.json` 顶层增加 `actorAssets`，其它文案、声音与时间码维持本期内容。下面的帧序只是对应常用提示词的配置示例，须按**本次实际生成并目视核对**的图集修改。`visibleHeight` 是输出 1920×1080 画布中的角色可见高度；若省略，下面的接入方法使用旧调用的高度预算：半身 `35 × pixelScale`，小人 `31 × pixelScale`。

```json
"actorAssets": {
  "mini": {
    "manifest": "assets/sprites/manifest.json",
    "visibleHeight": 190,
    "frameMs": 170,
    "frames": {"idle": [0, 1], "walk": [4, 5, 6, 7], "celebrate": [14]}
  },
  "portrait": {
    "manifest": "assets/bust/manifest.json",
    "visibleHeight": 560,
    "frameMs": 160,
    "frames": {"idle": [0], "talk": [0, 1], "blink": [2], "gesture": [3]},
    "gestureRanges": []
  }
}
```

PNG 路线中 `episode.actor` 的头发、肤色、眼罩等绘图字段不再参与人物绘制，身份来自图片。仍保留 `episode.actor.name` 供姓名牌及字体预载使用。不得用代码色表覆盖 PNG 的身份特征。

### 2. 修改 scene.mjs 的 import、构造与加载

在现有 `components.mjs` import 下添加：

```javascript
import {SpriteActor} from './sprite-actor.mjs';
```

在 `export class CinematicScene` **之前**添加以下辅助函数。整组用最大已注册主体高度计算统一缩放，不能每帧分别缩放。新 manifest 用 `outputCoreBox`；旧已注册 manifest 若只有 `outputBox`，兼容使用其完整裁区高度，边界可能多出少量透明留白。

```javascript
function registeredActorHeight(group) {
  const m = group.manifest;
  const meta = Array.isArray(m.frames) ? m.frames : m.framesMeta;
  if (!Array.isArray(meta)) throw new Error('人物 manifest 缺少逐帧尺寸');
  const heights = meta.map(frame => frame.outputCoreBox
    ? frame.outputCoreBox[3] - frame.outputCoreBox[1]
    : frame.outputBox?.[3]);
  if (!heights.length || heights.some(h => !Number.isFinite(h) || h <= 0)) {
    throw new Error('人物 manifest 的可见高度无效；请重新注册图集');
  }
  return Math.max(...heights);
}

function actorFrame(config, state, t) {
  const frames = config.frames?.[state];
  if (!Array.isArray(frames) || !frames.length || frames.some(f => !Number.isInteger(f))) {
    throw new Error(`未配置并核对人物状态 ${state} 的帧序`);
  }
  const frameMs = config.frameMs ?? 170;
  if (!Number.isFinite(frameMs) || frameMs <= 0) throw new Error('人物 frameMs 必须为正数');
  return frames[Math.floor(Math.max(0, t) / frameMs) % frames.length];
}
```

在类中，把原构造函数这一行：

```javascript
constructor(episode){this.ep=episode;this.backgrounds={};this.buildBackgrounds()}
```

替换为下面的构造函数，并把 `load` / `paintPortrait` / `paintMini` 三个方法一起放在类内。原来的 `buildBackgrounds()`、字幕、HUD、组件等方法保留。

```javascript
constructor(episode) {
  this.ep = episode;
  const assets = episode.actorAssets;
  if (!assets?.mini?.manifest || !assets?.portrait?.manifest) {
    throw new Error('PNG 路线需要 episode.actorAssets 的小人及半身 manifest');
  }
  this.pngActor = new SpriteActor({
    mini: assets.mini.manifest,
    portrait: assets.portrait.manifest,
  });
  this.pngHeight = null;
  this.backgrounds = {};
  this.buildBackgrounds();
}

async load() {
  await this.pngActor.load();
  this.pngHeight = {
    mini: registeredActorHeight(this.pngActor.groups.mini),
    portrait: registeredActorHeight(this.pngActor.groups.portrait),
  };
}

paintPortrait(c, {x, y, pixelScale, t, speaking}) {
  const config = this.ep.actorAssets.portrait;
  const height = config.visibleHeight ?? 35 * pixelScale;
  const gesture = (config.gestureRanges || []).some(([at, end]) => t >= at && t < end);
  const blink = !speaking && Math.floor(t / 100) % 43 >= 40;
  const state = gesture ? 'gesture' : speaking ? 'talk' : blink ? 'blink' : 'idle';
  this.pngActor.portrait(c, {
    x: x + 16 * pixelScale,
    waist: y + 35 * pixelScale,
    scale: height / this.pngHeight.portrait,
    frame: actorFrame(config, state, t),
  });
}

paintMini(c, {x, foot, pixelScale, t, pose}) {
  const config = this.ep.actorAssets.mini;
  const height = config.visibleHeight ?? 31 * pixelScale;
  const state = typeof pose === 'string' ? pose : pose ? 'walk' : 'idle';
  this.pngActor.mini(c, {
    x: x + 12 * pixelScale,
    foot,
    scale: height / this.pngHeight.mini,
    frame: actorFrame(config, state, t),
  });
}
```

坐标转换依据实际模板：旧半身在 32×35 格中用左上角 `(x,y)` 绘制，因此中心转为 `x + 16s`，腰线转为 `y + 35s`；PNG 512×512 的锚点是 manifest 中的腰线（通常 500）。旧小人的 24×31 格用左边界 `x` 和脚底 `foot`，中心转为 `x + 12s`，脚底 `foot` 原样保留；PNG 256×256 的锚点通常 240。**不能直接将旧的 `s=16` / `s=6.1` 当作 PNG scale**，否则整张 512 / 256 画布会被放大到几千像素。上面的可见高度除以注册主体高度会得到新 PNG scale。

### 3. 精确替换四处实际绘制调用

在 `bigLegacy(c,t)` 与 `big(c,t)` 中，各有下面这一行；**两处都替换**：

```javascript
const talking=this.ep.voice.some(v=>t>=v.at&&t<v.end);frontActor(c,578,268+Math.round(Math.sin(t/1200)*1.5),16,t,this.ep.actor,talking);
```

替换为：

```javascript
const talking = this.ep.voice.some(v => t >= v.at && t < v.end);
this.paintPortrait(c, {
  x: 578, y: 268 + Math.round(Math.sin(t / 1200) * 1.5),
  pixelScale: 16, t, speaking: talking,
});
```

在 `smallLegacy(c,t)` 中，把：

```javascript
sideActor(c,x,foot,6.1,t,this.ep.actor,t>8400?'celebrate':walking);
```

替换为：

```javascript
this.paintMini(c, {x, foot, pixelScale: 6.1, t, pose: t > 8400 ? 'celebrate' : walking});
```

在 `small(c,t)` 的 `visualBeats` 分支中，把：

```javascript
sideActor(c,x,foot,6.1,t,this.ep.actor,ms>e.rewardAt?'celebrate':walking);
```

替换为：

```javascript
this.paintMini(c, {x, foot, pixelScale: 6.1, t, pose: ms > e.rewardAt ? 'celebrate' : walking});
```

之后 `frontActor` / `sideActor` 的旧绘制函数可以从本次工程删除；它们不能留在任何实际调用路径里。**验证搜索**：`rg 'frontActor\(|sideActor\(' scene.mjs` 若保留定义应仅命中定义，不能命中类的四个方法。`visualBeats` 有无都必须能使用同一套 PNG 身份与锚点。

### 4. 修改 index.html，先加载再发布播放器

原模板字体预载完成后，会立即执行下面这一行：

```javascript
const painter=new CinematicScene(ep),canvas=document.getElementById('stage'),audio=document.getElementById('audio');const params=new URLSearchParams(location.search);let ms=Math.min(ep.durationMs-1,Math.max(0,Number(params.get('t'))||0)),playing=false;
```

把这一行完整替换为：

```javascript
let painter;
try {
  painter = new CinematicScene(ep);
  await painter.load();
} catch (error) {
  document.querySelector('.loading').textContent = error.message;
  window.__renderError = error.message;
  throw error;
}
const canvas = document.getElementById('stage'), audio = document.getElementById('audio');
const params = new URLSearchParams(location.search);
let ms = Math.min(ep.durationMs - 1, Math.max(0, Number(params.get('t')) || 0)), playing = false;
```

随后把原模板中 `window.__player=...;set(ms);document.querySelector('.loading').remove();` 这一整行替换为以下顺序。首次绘制失败时保留明确错误；只有 16 小人和 4 半身全部加载、尺寸检查以及初始帧绘制通过，才发布成功播放器：

```javascript
try {
  set(ms);
} catch (error) {
  document.querySelector('.loading').textContent = error.message;
  window.__renderError = error.message;
  throw error;
}
window.__player = {
  set, get: () => ms, total: ep.durationMs,
  rec: params.get('rec') === '1', episode: ep,
  sprites: painter.pngActor.groups.mini.images.length,
  busts: painter.pngActor.groups.portrait.images.length,
};
document.querySelector('.loading').remove();
```

保留原播放、音轨、时间轴和键盘控制代码，不把这个资产适配修改当作更换本期口播的理由。

图集按行优先编号 `00…15` / `00…03`。状态名称和帧序要遵循本次生图约定并目视验证，不从头发颜色或图集位置猜角色语义。站立、说话、行走、交互、奖励的选帧和位置均用时间 `t` 的纯函数；不要依赖实时帧数、随机数或系统时钟。大人物必须独立生成半身图，不能把 256 小人放大冒充半身。

## 静音资产检查页

把已注册资产放入本目录的 `assets/sprites/` 和 `assets/bust/` 后，用本地静态 HTTP 服务打开 `index.html`。`config.json` 默认 20 秒仅用于逐帧检查：10 秒四种半身表情，10 秒十六种小人状态，没有配音或默认主题。它暴露 `.frame`、`window.__player.set(ms)`、`total`，可直接配合现有 `scripts/render_episode.mjs` 抽取检查帧。缺图时不挂成功的 `__player`，保留 `.loading` 的明确错误。
