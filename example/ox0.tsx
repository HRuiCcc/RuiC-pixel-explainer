import { camAt, p } from '../engine/anim';
import type { Buf } from '../pixel/draw';
import type { Light, SceneDef } from '../engine/types';
import { ItemCard, StatPanel } from '../ui/elements';
import { SKINS } from '../pixel/character';
import { SCRIPT } from '../content/episode-opening';
import { hero, hold } from './kit';

/** 本期主角：深夜电台主持（紫发 + 黑皮夹克 + 荧光青耳机）—— 同一剪影，换皮换配饰就是另一个人 */
const star = (x: number, y: number, pose: 'idle' | 'talk' | 'point' = 'talk', after = 600) =>
  (t: number) => ({ x, y, pose: t > after ? pose : ('idle' as const), skin: SKINS.host, acc: 'headset' as const });

/** 前景：插在地里的巨剑（占画面右侧，剑尖朝下）+ 上升的灵气光带 + 顶部光柱 */
function bigSword(b: Buf, t: number) {
  const X = 236;
  // 顶部光柱（抖动锥形，向下打；从署名带下方起，别盖住右上角）
  b.dither(X - 24, 30, 48, 34, '#7ff0e0', 4, Math.floor(t / 160), 0);
  b.dither(X - 16, 30, 32, 34, '#39d8c8', 3, 0, Math.floor(t / 120));
  // 剑身
  b.rect(X - 6, 62, 12, 88, '#8a93a8');
  b.rect(X - 6, 62, 4, 88, '#5a6274');
  b.rect(X + 2, 62, 3, 88, '#e8e4da');
  // 剑尖（插进地面）
  b.rect(X - 5, 150, 10, 6, '#8a93a8');
  b.rect(X - 3, 156, 6, 6, '#5a6274');
  b.rect(X - 1, 162, 2, 5, '#3a4152');
  // 护手 + 握把 + 剑首
  b.rect(X - 16, 56, 32, 7, '#c9a24a');
  b.rect(X - 16, 56, 32, 2, '#ffd9a0');
  b.rect(X - 3, 40, 6, 17, '#4a3a2c');
  b.rect(X - 3, 44, 6, 2, '#6b5535');
  b.rect(X - 3, 50, 6, 2, '#6b5535');
  b.rect(X - 5, 34, 10, 6, '#c9a24a');
  b.rect(X - 5, 34, 10, 2, '#ffd9a0');
  // 灵气：一条沿剑身上升的光带 + 环绕光点
  const k = (t % 2400) / 2400;
  const gy = 150 - k * 88;
  b.rect(X - 6, gy, 12, 3, '#7ff0e0');
  b.dither(X - 9, gy - 7, 18, 14, '#39d8c8', 3, 0, Math.floor(t / 110));
  for (let i = 0; i < 6; i++) {
    const a = t / 700 + i * 1.05;
    b.px(X + Math.sin(a) * 17, 96 + Math.cos(a * 0.8) * 34 + (i % 3) * 6, i % 2 ? '#ffd9a0' : '#7ff0e0');
  }
}

const lights: (t: number) => Light[] = (t) => [
  { x: 240, y: 96, r: 78, c: '#7ff0e0', a: 0.2 + 0.06 * Math.sin(t / 520) },
  { x: 62, y: 112, r: 48, c: '#ffbc6b', a: 0.2 },
];

/* ── O01 开局：巨剑登场 + 属性面板（等级 1 / 只有一把旧剑） ── */
export const o01: SceneDef = {
  id: 'o01',
  dur: 4300,
  bg: 'armory',
  script: SCRIPT.o01,
  lights,
  cam: hold(150, 100, 1.0),
  hero: star(58, 106, 'idle'),
  fg: (b, t) => bigSword(b, t),
  build: (t) => (
    <StatPanel
      p={p(t, 200, 700)}
      name="你"
      rows={[
        ['等级', '1'],
        ['装备', '旧剑'],
        ['进度', '第 1 天'],
      ]}
      style={{ left: 96, top: 132 }}
    />
  ),
};

/* ── O02 大人物：推成大特写，光环落定收尾 ── */
export const o02: SceneDef = {
  id: 'o02',
  dur: 6100,
  bg: 'armory',
  script: SCRIPT.o02,
  lights: (t) => [
    { x: 66, y: 116, r: 54, c: '#ffbc6b', a: 0.26 },
    { x: 240, y: 96, r: 70, c: '#7ff0e0', a: 0.14 },
  ],
  cam: (t) =>
    camAt(t, [
      { at: 0, x: 96, y: 104, z: 1.9 },
      { at: 1900, x: 68, y: 124, z: 3.0 },
    ]),
  hero: (t) => ({ ...star(60, 106)(t), halo: t > 3800 }),
  fg: (b, t) => bigSword(b, t),
  build: (t) => (
    <ItemCard p={p(t, 1000, 700)} icon="⚔" name="旧剑" desc="随身装备 · 第 1 天" lit={t > 3800} style={{ right: 150, top: 250 }} />
  ),
};
