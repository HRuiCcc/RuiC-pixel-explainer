// 像素游戏讲解片 · 逐帧导出成片
//
// 原理：这个播放器的一切画面都是「时间 t 的纯函数」（Stage 每帧重画，字幕/章节轨/HUD 都吃 t），
//       所以把 t 定点到每一帧、截图、顺序喂给 ffmpeg，就能得到与实时录制无关的、逐帧确定的成片。
//
// 用法（先在工程里 npm run dev，页面起在 5273）：
//   node render_episode.mjs --url http://127.0.0.1:5273/ --out <成片.mp4>
//        [--ep practice] [--from 0] [--to 0] [--fps 30] [--dsf 2] [--size 1920x1080]
//        [--audio <口播.m4a>] [--crf 16] [--verify-repeat 5] [--playwright <路径>]
//
// 说明：
//   · --dsf 2 让截图落在 2560×1440（像素块正好是艺术格 ×8，等比不畸变），再按 --size 下采样；
//     要 720p 原样就 --dsf 1 --size 1280x720。
//   · 交互点在 ?rec=1 下自动取第 0 项（纯观看形态），控制条不出画；章节轨/署名/地点卡/字幕照常。
//   · --verify-repeat 会抽几帧各截两次比对，确认渲染是确定的（差异应为 0）。
//   · 有音轨时按画面长度补齐静音（不用 -shortest），片子不会被音频截短。
import {spawn} from 'node:child_process';
import {stat, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (n, d = '') => {const i = argv.indexOf(`--${n}`); return i >= 0 ? (argv[i + 1] ?? '') : d};
const url = arg('url', 'http://127.0.0.1:5273/');
const out = path.resolve(arg('out', 'episode.mp4'));
const ep = arg('ep');
const fps = Number(arg('fps', '30'));
const dsf = Number(arg('dsf', '1.5'));
const threads = Number(arg('threads', '2'));
if(!Number.isInteger(threads)||threads<1||threads>4)throw new Error('--threads must be an integer from 1 to 4');
const size = arg('size', '1920x1080');
const audio = arg('audio');
const crf = arg('crf', '16');
const from = Number(arg('from', '0'));
const to = Number(arg('to', '0'));
const verifyRepeat = Number(arg('verify-repeat', '5'));

// playwright：优先本工程，其次常见位置
const home = homedir();
const candidates = [arg('playwright'), process.env.PLAYWRIGHT_PATH,
  path.join(process.cwd(), 'node_modules/playwright/index.mjs'),
  path.join(home, 'Desktop/zcode/ai-explain-game/game/node_modules/playwright/index.mjs')].filter(Boolean);
let chromium;
for (const c of candidates) {try {({chromium} = await import(pathToFileURL(c).href)); break} catch {}}
if (!chromium) {try {({chromium} = await import('playwright'))} catch {}}
if (!chromium) {
  console.error('找不到 playwright：在游戏工程目录里跑本脚本，或用 --playwright <playwright/index.mjs> 指定。');
  process.exit(2);
}
await mkdir(path.dirname(out), {recursive: true});

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 720}, deviceScaleFactor: dsf});
const params = new URLSearchParams({t: String(Math.round(from * 1000)), play: '0', rec: '1', subs: '1'});
if (ep) params.set('ep', ep);
await page.goto(`${url.replace(/\/$/, '')}/?${params}`, {waitUntil: 'load'});
await page.waitForFunction(() => window.__player && !document.querySelector('.loading'), null, {timeout: 60000});

const total = await page.evaluate(() => window.__player.total);
const startFrame = Math.round(from * fps);
const endFrame = to > 0 ? Math.round(to * fps) : Math.floor(total / 1000 * fps);
const frameCount = Math.max(0, endFrame - startFrame);
if (frameCount === 0) {console.error('帧数为 0：检查 --from / --to'); process.exit(2);}
console.log(`导出 ${frameCount} 帧（${(frameCount / fps).toFixed(1)}s @${fps}fps，${size}）→ ${out}`);

const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
const shoot = async (frame) => {
  await page.evaluate((ms) => window.__player.set(ms), (frame / fps) * 1000);
  await settle();
  if(await page.evaluate(()=>document.fonts.status==='loading')){
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate((ms)=>window.__player.set(ms+0.001),(frame/fps)*1000);
    await settle();
    await page.evaluate((ms)=>window.__player.set(ms),(frame/fps)*1000);
    await settle();
  }
  return page.locator('.frame').screenshot({type: 'png'});
};

// 确定性自检：同一帧截两次，字节应一致
if (verifyRepeat > 0) {
  const picks = Array.from({length: Math.min(verifyRepeat, frameCount)}, (_, i) => startFrame + Math.floor((i + 0.5) * frameCount / Math.min(verifyRepeat, frameCount)));
  let worst = 0;
  for (const f of picks) {
    const a = createHash('sha256').update(await shoot(f)).digest('hex');
    const b = createHash('sha256').update(await shoot(f)).digest('hex');
    if (a !== b) worst++;
  }
  if(worst>0) {await browser.close();throw new Error(`Deterministic rendering failed on ${worst} sampled frames; fix wall-clock/CSS animations before exporting`);}
  console.log(worst === 0 ? `确定性自检通过（${picks.length} 帧各截两次，字节一致）` : `⚠️ 确定性自检失败：${worst}/${picks.length} 帧两次截得不一样`);
}

const probeSize = await page.evaluate(() => {
  const el = document.querySelector('.frame');
  return el ? {w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height} : null;
});
const shotW = Math.round((probeSize?.w ?? 1280) * dsf), shotH = Math.round((probeSize?.h ?? 720) * dsf);
const [wantW, wantH] = size.split('x').map(Number);

const args = ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(fps), '-i', '-'];
if (audio) args.push('-i', audio);
args.push('-c:v', 'libx264', '-threads', String(threads), '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p');
if (wantW !== shotW || wantH !== shotH) args.push('-vf', `scale=${wantW}:${wantH}:flags=neighbor`);
if (audio) {
  // 音轨比画面短时不许吃掉画面尾巴：补齐静音到画面长度（音轨自己长一点也行）
  args.push('-af', 'apad', '-c:a', 'aac', '-b:a', '192k', '-t', (frameCount / fps).toFixed(3));
}
args.push('-movflags', '+faststart', '-y', out);
const ff = spawn('ffmpeg', args);

let failed = null;
ff.on('error', (e) => {failed = e;});
ff.stderr.on('data', (d) => process.stderr.write(d));
const write = (buf) => new Promise((resolve, reject) => {
  if (!ff.stdin.write(buf)) ff.stdin.once('drain', resolve); else resolve();
});

const t0 = Date.now();
for (let i = 0; i < frameCount; i++) {
  if (failed) break;
  await write(await shoot(startFrame + i));
  if ((i + 1) % fps === 0) {
    const done = i + 1;
    const eta = (Date.now() - t0) / done * (frameCount - done) / 1000;
    console.log(`${done}/${frameCount} 帧（${(done / fps).toFixed(1)}s）｜剩余约 ${eta.toFixed(0)}s`);
  }
}
ff.stdin.end();
const code = await new Promise((r) => ff.on('close', r));
await browser.close();
if (failed) throw failed;
if (code !== 0) {console.error(`ffmpeg 退出码 ${code}`); process.exit(1);}
console.log(`${await stat(out).then((s) => (s.size / 1024 ** 2).toFixed(1))} MiB → ${out}`);
