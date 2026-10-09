import { camAt, p } from '../engine/anim';
import type { SceneDef } from '../engine/types';
import { SKINS } from '../pixel/character';
import { ChatMock, CompareCards, FillBlank, NeonSelect, PanelBox, WarningPanel } from '../ui/elements';
import { SCRIPT } from '../content/episode-hallucination';
import { hero, hold, push } from './kit';

/** 本期新主角：夜班档案员（青灰短发 + 圆框眼镜 + 墨绿工装），换皮不换剪影 */
const who = (x: number, y: number, pose: 'idle' | 'talk' | 'point' = 'talk', after = 600) =>
  (t: number) => ({ x, y, pose: t > after ? pose : ('idle' as const), skin: SKINS.archivist, acc: 'glasses' as const });

/* ── M01 答得太顺：它答得越快越像真的 ── */
export const m01: SceneDef = {
  id: 'm01',
  dur: 5200,
  bg: 'terminal',
  script: SCRIPT.m01,
  cam: push(166, 96, 1.02, 1.24, 3600),
  hero: who(44, 100),
  build: (t) => (
    <>
      {t > 2900 && <WarningPanel t={t} text="它说得越来越顺" sub="顺，不等于对" style={{ left: 96, top: 132, width: 300 }} />}
      <ChatMock
        t={t}
        msgs={[
          { at: 500, from: 'me', text: '帮我写一句结论' },
          { at: 1500, from: 'ai', text: '当然，完全正确。', receipt: '已生成 · 一眨眼就好' },
        ]}
        style={{ left: 672, top: 96, width: 396 }}
      />
      <NeonSelect p={p(t, 2200, 900)} w={262} h={92} style={{ left: 700, top: 202 }} />
    </>
  ),
};

/* ── M02 只学像不像：它的全部功课就是挑"最像"的那个字 ── */
export const m02: SceneDef = {
  id: 'm02',
  dur: 4800,
  bg: 'library',
  script: SCRIPT.m02,
  cam: hold(160, 92, 1.14),
  hero: who(50, 122, 'point', 800),
  build: (t) => (
    <>
      <PanelBox p={p(t, 200, 700)} tone="paper" title="它正在做的事" style={{ left: 272, top: 150, width: 656 }}>
        <div style={{ height: 74 }} />
      </PanelBox>
      <FillBlank t={t} head="今天天气真" filled={t > 2500 ? '好' : undefined} style={{ left: 404, top: 228 }} />
      <PanelBox p={p(t, 3200, 600)} tone="gold" title="它不问对不对" style={{ left: 272, top: 356, width: 656 }}>
        <div className="px" style={{ fontSize: 18 }}>
          只挑最像的那个字，接着往下写。
        </div>
      </PanelBox>
    </>
  ),
};

/* ── M03 当打字机：结尾单独设计，光环落定 ── */
export const m03: SceneDef = {
  id: 'm03',
  dur: 5000,
  bg: 'city',
  script: SCRIPT.m03,
  cam: (t) =>
    camAt(t, [
      { at: 0, x: 160, y: 92, z: 1.34 },
      { at: 2800, x: 152, y: 96, z: 1.06 },
    ]),
  hero: (t) => ({ x: 132, y: 100, pose: t > 700 ? 'talk' : 'idle', halo: t > 4200, skin: SKINS.archivist, acc: 'glasses' }),
  build: (t) => (
    <CompareCards
      p={p(t, 800, 900)}
      left={{ tag: '当打字机', text: '帮你把话写顺写快，先把稿子铺出来' }}
      right={{ tag: '别当证人', text: '事实、数字和结论，都要你亲自过一遍' }}
      style={{ left: 262, top: 196 }}
    />
  ),
};
