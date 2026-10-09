import type { Chapter, Script } from '../engine/types';

/**
 * 第 3 期 · 15 秒样片《它答得像，不等于答得对》
 * 字幕：[[词]] 会被橙色高亮；一行 ≤22 汉字，绝不折行。
 * 口径：全片不出现具体大模型产品名、不出现金额数字；不引用未核实的百分比。
 */

export const TITLE = '它答得像，不等于答得对';
export const AUTHOR = 'RuiC · 像素讲堂';

export const CHAPTERS: Chapter[] = [
  { num: 0, name: '答得太顺' },
  { num: 1, name: '只学像不像' },
  { num: 2, name: '当打字机' },
];

export const TAKEAWAYS = ['它练的是「下一个字最像什么」', '「像」和「对」是两件事', '当打字机用，事实自己核'];

export const SCRIPT: Record<string, Script> = {
  m01: {
    chapter: 0,
    location: '像素讲堂 · 书桌终端房',
    lines: [
      { at: 450, text: '它答得越顺，你越容易[[当真]]。' },
      { at: 2650, text: '可它学的不是[[对]]，是像。' },
    ],
  },
  m02: {
    chapter: 1,
    location: '像素讲堂 · 数据图书馆',
    lines: [
      { at: 250, text: '它的功课只有一道题：' },
      { at: 2200, text: '下一个字，最[[像]]什么。' },
    ],
  },
  m03: {
    chapter: 2,
    location: '像素讲堂 · 夜城街道',
    lines: [
      { at: 400, text: '当[[打字机]]，别当证人。' },
      { at: 2500, text: '数字，你自己[[核]]一遍。' },
    ],
  },
};
