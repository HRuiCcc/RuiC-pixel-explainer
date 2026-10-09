// 静帧质检：抽几个时间点的画面出来看（版式/字幕/元素有没有压住、有没有空场）。
//
// 用法（dev server 起着）：
//   node stills.mjs --url http://127.0.0.1:5274/ --out <目录> [--ep hallucination] [--times 2,3,6,8,11.5,14] [--dsf 2]
//
// 产物：<目录>/t-<秒>.png —— 逐张看，确认后再整片渲染（render_episode.mjs）。
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (n, d = '') => {const i = argv.indexOf(`--${n}`); return i >= 0 ? (argv[i + 1] ?? '') : d};
const url = arg('url', 'http://127.0.0.1:5273/');
const outDir = path.resolve(arg('out', 'stills'));
const ep = arg('ep');
const dsf = Number(arg('dsf', '1'));
const times = arg('times', '0').split(',').map(Number).filter((x) => Number.isFinite(x));

const home = homedir();
const candidates = [arg('playwright'), process.env.PLAYWRIGHT_PATH,
  path.join(process.cwd(), 'node_modules/playwright/index.mjs'),
  path.join(home, 'Desktop/zcode/ai-explain-game/game/node_modules/playwright/index.mjs')].filter(Boolean);
let chromium;
for (const c of candidates) {try {({chromium} = await import(pathToFileURL(c).href)); break} catch {}}
if (!chromium) {try {({chromium} = await import('playwright'))} catch {}}
if (!chromium) {console.error('找不到 playwright：在游戏工程目录里跑，或 --playwright <playwright/index.mjs>'); process.exit(2);}

await mkdir(outDir, {recursive: true});
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1280, height: 720}, deviceScaleFactor: dsf});
const params = new URLSearchParams({t: '0', play: '0', rec: '1', subs: '1'});
if (ep) params.set('ep', ep);
await page.goto(`${url.replace(/\/$/, '')}/?${params}`, {waitUntil: 'load'});
await page.waitForFunction(() => window.__player && !document.querySelector('.loading'), null, {timeout: 60000});
for (const s of times) {
  await page.evaluate((ms) => window.__player.set(ms), s * 1000);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const file = path.join(outDir, `t-${String(s).replace('.', '_')}.png`);
  await page.locator('.frame').screenshot({path: file});
  console.log('→', file);
}
await browser.close();
