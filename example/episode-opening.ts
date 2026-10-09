import type { Chapter, Script } from '../engine/types';

/**
 * 第 4 期 · 10 秒样片《开局 · 大人物登场》
 * 口径：不出现金额数字（属性面板只列等级/装备/进度）；不出现产品名。
 */

export const TITLE = '开局 · 大人物登场';
export const AUTHOR = 'RuiC · 像素讲堂';

export const CHAPTERS: Chapter[] = [
  { num: 0, name: '开局' },
  { num: 1, name: '你的剑' },
];

export const TAKEAWAYS = ['开局只有一把旧剑', '有件东西从第一天起归你管', '你练什么，就长成什么样'];

export const SCRIPT: Record<string, Script> = {
  o01: {
    chapter: 0,
    location: '像素讲堂 · 武器库',
    lines: [{ at: 300, text: '开局都一样：等级 1，装备栏里只有一把[[旧剑]]。' }],
  },
  o02: {
    chapter: 1,
    location: '像素讲堂 · 武器库',
    lines: [
      { at: 150, text: '但有一件东西，从第一天起就归[[你管]]。' },
      { at: 3600, text: '你[[练]]什么，就长成什么样。' },
    ],
  },
};
