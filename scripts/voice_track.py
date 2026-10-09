#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""口播配音 → 一条对齐时间轴的音轨。

两步一起干：
  1) 逐句 TTS（默认走剪映音色，`jianying-tts` 技能里的 jy_tts.py）；
  2) 量出每句真实时长，按给定时间码把句子摆到该在的位置（前面补静音），拼成一条 wav。

为什么要量：这个流派「一句口播一个场景」，场景时长必须由**真实语速**决定，
不能按 4.5 字/秒拍脑袋估——估出来的时间轴渲染完必对不上嘴。

用法：
    # 只 TTS + 报时长（定时间轴用）
    python3 voice_track.py --lines lines.json --work <目录> --tts-only
    # 定好时间码后拼音轨
    python3 voice_track.py --lines lines.json --work <目录> --out voice.wav [--tail 800]

lines.json 格式（at = 该句在**整片**时间轴上的毫秒位置）：
    [{"at": 600, "text": "它答得越顺，你越当真。"}, {"at": 2900, "text": "…"}]

换音色：--speaker 曼波讲故事 / 台湾腔甜妹 …（全表见 jianying-tts 技能）；
换 TTS 后端：--tts-cmd "python3 /path/to/your_tts.py"（约定：`<cmd> <文本> --out <文件>`）。
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path

DEFAULT_TTS = Path.home() / '.agents/skills/jianying-tts/scripts/jy_tts.py'


def tts(text, out, cmd, speaker):
    if out.exists():
        return
    args = ['python3', str(cmd), text, '--out', str(out)]
    if speaker:
        args += ['--speaker', speaker]
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                          '-of', 'csv=p=0', str(path)]).strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lines', required=True, help='JSON：[{"at": 毫秒, "text": "…"}]')
    ap.add_argument('--work', required=True, help='逐句音频与中间产物目录')
    ap.add_argument('--out', default='', help='拼好的音轨输出（wav）')
    ap.add_argument('--speaker', default='', help='TTS 音色名（默认剪映默认音色）')
    ap.add_argument('--tts-cmd', default=str(DEFAULT_TTS))
    ap.add_argument('--tts-only', action='store_true', help='只合成 + 报时长，不拼轨')
    ap.add_argument('--tail', type=int, default=1000, help='最后一句之后留的余量（毫秒）；宁可长一点，渲片时会按画面补齐')
    a = ap.parse_args()

    lines = json.loads(Path(a.lines).read_text())
    work = Path(a.work).expanduser().resolve()
    work.mkdir(parents=True, exist_ok=True)
    if not Path(a.tts_cmd).is_file() and a.tts_cmd == str(DEFAULT_TTS):
        sys.exit(f'找不到 TTS 脚本 {DEFAULT_TTS}（用 --tts-cmd 指定自己的）')

    rows, problems = [], []
    for i, line in enumerate(lines):
        f = work / f'line-{i:02d}.mp3'
        tts(line['text'], f, a.tts_cmd, a.speaker)
        rows.append({**line, 'file': str(f), 'dur': round(duration(f) * 1000)})
        if i + 1 < len(lines):
            end = line['at'] + rows[-1]['dur']
            if end > lines[i + 1]['at']:
                problems.append({'line': i + 1, 'overlapMs': end - lines[i + 1]['at'],
                                 'suggestNextAt': end + 250})
    print(json.dumps({'lines': rows,
                      'endMs': rows[-1]['at'] + rows[-1]['dur'] if rows else 0,
                      'overlaps': problems}, ensure_ascii=False, indent=2))
    if a.tts_only:
        return
    if problems:
        print('⚠️ 有句子压到下一句了，先按 overlaps 里的 suggestNextAt 调时间码再拼轨', file=sys.stderr)
    if not a.out:
        sys.exit('要拼轨就得给 --out')

    total = (rows[-1]['at'] + rows[-1]['dur'] + a.tail) if rows else 1000
    inputs, filters = [], []
    for i, r in enumerate(rows):
        inputs += ['-i', r['file']]
        filters.append(f'[{i + 1}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,'
                       f'adelay={int(r["at"])}|{int(r["at"])}[a{i}]')
    mix = ''.join(f'[a{i}]' for i in range(len(rows)))
    graph = ';'.join(filters) + f';[0:a]{mix}amix=inputs={len(rows) + 1}:normalize=0:duration=longest[m]'
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-t', str(total / 1000),
           '-i', 'anullsrc=r=44100:cl=stereo'] + inputs + \
          ['-filter_complex', graph, '-map', '[m]', '-t', str(total / 1000), '-y', str(Path(a.out).expanduser())]
    subprocess.run(cmd, check=True)
    print(f'音轨好了：{a.out}（{total / 1000:.2f}s）')


if __name__ == '__main__':
    main()
