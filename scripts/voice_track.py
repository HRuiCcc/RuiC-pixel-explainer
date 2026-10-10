#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""口播配音 → 一条对齐时间轴的音轨（配音后端由你自己提供）。

干三件事：
  1) 逐句 TTS —— 调**你自己的**接口（HTTP API 或本地命令行），本脚本不带任何内置音色；
  2) 量出每句真实时长；
  3) 按给定时间码把句子摆到该在的位置（前面补静音），拼成一条 wav。

为什么要量：这个流派「一句口播一个场景」，场景时长必须由**真实语速**决定，
不能按 4.5 字/秒拍脑袋估——估出来的时间轴渲染完必对不上嘴。

用法：
    python3 voice_track.py --check                                    # 合成一句试听，确认后端接好
    python3 voice_track.py --lines lines.json --work <目录> --tts-only # 逐句合成 + 报时长（定时间轴用）
    python3 voice_track.py --lines lines.json --work <目录> --out voice.wav  # 按 at 拼成整轨

lines.json（at = 该句在**整片**时间轴上的毫秒位置）：
    [{"at": 600, "text": "它答得越顺，你越当真。"}, {"at": 2900, "text": "…"}]

配音后端三种给法（优先级：命令行 > 环境变量 > 配置文件）：
  · HTTP API   --tts-api https://your-tts/api [--tts-api-key sk-…] [--voice 音色]
  · 本地命令   --tts-cmd "your-tts --out {out} --text {text} --voice {voice}"
  · 配置文件   tts.config.json（--tts-config 指定；否则按 $TTS_CONFIG → <work>/ → 当前目录
               → ~/.config/ruic-pixel-explainer/tts.json 顺序找）
               环境变量 TTS_API_URL / TTS_CMD / TTS_API_KEY / TTS_VOICE 同样生效。

HTTP 约定：POST JSON（默认 {"text": …, "voice": …}，可用配置里的 body 改模板），
返回音频字节，或 JSON 里的音频直链 / base64（字段名可用 audio_field 指定）。
命令行约定：模板含 {text} {out} {voice} 占位符就按模板跑；不含占位符时按
`<cmd> <文本> --out <文件>` 追加。完整说明见 references/pipeline.md「配音与时间轴」。
"""
import argparse, base64, hashlib, json, os, shlex, subprocess, sys, tempfile, urllib.parse
from pathlib import Path

CONFIG_NAME = 'tts.config.json'
LOCAL_CONFIG = Path.home() / '.config' / 'ruic-pixel-explainer' / 'tts.json'
AUDIO_FIELDS = ('audio_url', 'audio_base64', 'audio', 'url', 'base64', 'data', 'result')

NO_BACKEND = """没有可用的配音后端：本技能不带内置 TTS，口播要接你自己的接口。
任选一种（详见 references/pipeline.md 的「配音与时间轴」）：
  · HTTP API：  --tts-api https://your-tts/api [--tts-api-key sk-…]
                或 tts.config.json 里 {"type": "http", "url": "…", "key": "…"}
  · 本地命令：  --tts-cmd "your-tts --out {out} --text {text}"
                或 tts.config.json 里 {"type": "command", "cmd": "…"}
  · 环境变量：  TTS_API_URL / TTS_CMD / TTS_API_KEY / TTS_VOICE
配置文件按 --tts-config → $TTS_CONFIG → <work>/ → 当前目录 → ~/.config/ruic-pixel-explainer/ 顺序找。
已经有成品音轨？不用合成：直接把 --audio 指给 render_episode.mjs。"""


def sniff_ext(head, fallback='mp3'):
    """按文件头认音频容器（各家 TTS 返回的格式不一，别按扩展名猜）。"""
    if head[:4] == b'RIFF':
        return 'wav'
    if head[:4] == b'OggS':
        return 'ogg'
    if head[:4] == b'fLaC':
        return 'flac'
    if head[:3] == b'ID3':
        return 'mp3'
    if len(head) > 1 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0:
        return 'aac' if (head[1] & 0xF6) == 0xF0 else 'mp3'
    if head[4:8] == b'ftyp':
        return 'm4a'
    return fallback


def load_config(explicit, work):
    candidates = []
    if explicit:
        candidates.append(Path(explicit).expanduser())
    if os.environ.get('TTS_CONFIG'):
        candidates.append(Path(os.environ['TTS_CONFIG']).expanduser())
    candidates += [work / CONFIG_NAME, Path.cwd() / CONFIG_NAME, LOCAL_CONFIG]
    for path in candidates:
        if path.is_file():
            try:
                return json.loads(path.read_text(encoding='utf-8')), path
            except ValueError as exc:
                sys.exit(f'配音配置不是合法 JSON：{path}（{exc}）')
    return {}, None


def resolve_backend(a, work):
    cfg, src = load_config(a.tts_config, work)
    env = os.environ
    cmd = a.tts_cmd or env.get('TTS_CMD') or cfg.get('cmd') or ''
    url = a.tts_api or env.get('TTS_API_URL') or cfg.get('url') or ''
    voice = a.voice or env.get('TTS_VOICE') or cfg.get('voice') or ''
    key = a.tts_api_key or env.get('TTS_API_KEY') or cfg.get('key') or ''
    if a.tts_cmd:
        kind = 'command'
    elif a.tts_api:
        kind = 'http'
    else:
        kind = (cfg.get('type') or '').lower()
    if not kind:
        kind = 'command' if cmd else ('http' if url else '')
    if not kind or (kind == 'command' and not cmd) or (kind == 'http' and not url):
        sys.exit(NO_BACKEND)
    if kind not in ('command', 'http'):
        sys.exit(f'不认识的配音后端类型：{kind}（只认 command / http）')
    return {'type': kind, 'cmd': cmd, 'url': url, 'key': key, 'voice': voice,
            'config': cfg, 'source': str(src) if src else '命令行 / 环境变量'}


def curl(url, out, method='GET', headers=None, key='', data=None, proxy='', insecure=False, timeout=120):
    """用 curl 走 HTTP（比 urllib 少踩 SSL/代理的坑）。返回响应体字节。"""
    argv = ['curl', '-sS', '--max-time', str(timeout), '-o', str(out), '-w', '%{http_code}', '-X', method, url]
    for k, v in (headers or {}).items():
        argv += ['-H', f'{k}: {v}']
    if key:
        argv += ['-H', f'Authorization: Bearer {key}']
    if proxy:
        argv += ['--proxy', proxy]
    if insecure:
        argv += ['--insecure']
    if data is not None:
        argv += ['--data-binary', '@-']
    proc = subprocess.run(argv, input=data, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f'curl 调用失败（退出码 {proc.returncode}）：{proc.stderr.decode("utf-8", "replace").strip()[:300]}')
    code = int(proc.stdout.decode().strip() or 0)
    if not 200 <= code < 300:
        body = out.read_bytes()[:200].decode('utf-8', 'replace') if out.is_file() else ''
        raise RuntimeError(f'配音接口返回 HTTP {code}：{body}')
    return out.read_bytes()


def extract_audio(doc, prefer='', depth=0):
    """在接口返回的 JSON 里找音频：返回 ('url', 直链/相对路径) / ('base64', 字节) / (None, None)。"""
    if not isinstance(doc, dict) or depth > 1:
        return None, None
    fields = ((prefer,) if prefer else ()) + tuple(f for f in AUDIO_FIELDS if f != prefer)
    for field in fields:
        if field not in doc:
            continue
        value = doc[field]
        if isinstance(value, dict):
            got = extract_audio(value, '', depth + 1)
            if got[0]:
                return got
        elif isinstance(value, str) and value:
            if value.startswith('http'):
                return 'url', value
            text = value.split(',', 1)[1] if value.startswith('data:') and ',' in value else value
            try:
                blob = base64.b64decode(text, validate=False)
            except Exception:
                blob = b''
            if len(blob) > 256 and sniff_ext(blob[:8], '') != '':
                return 'base64', blob
            if value.startswith('/'):          # 相对路径，用接口地址补全
                return 'url', value
    return None, None


def synth(backend, text, tmp):
    """让用户的后端把 text 合成到 tmp，返回音频文件头字节（用于认格式）。"""
    cfg = backend['config']
    if backend['type'] == 'http':
        body = cfg.get('body') or {'text': '{text}', 'voice': '{voice}'}
        payload = {}
        for k, v in body.items():
            if isinstance(v, str):
                v = v.replace('{text}', text).replace('{voice}', backend['voice'])
                if v == '' and k in ('voice', 'speaker'):
                    continue
            payload[k] = v
        headers = dict(cfg.get('headers') or {})
        headers.setdefault('Content-Type', 'application/json')
        proxy, insecure = cfg.get('proxy', ''), bool(cfg.get('insecure'))
        timeout = int(cfg.get('timeout', 120))
        raw = curl(backend['url'], tmp, method='POST', headers=headers, key=backend['key'],
                   data=json.dumps(payload, ensure_ascii=False).encode(),
                   proxy=proxy, insecure=insecure, timeout=timeout)
        if raw.lstrip()[:1] in (b'{', b'['):
            try:
                doc = json.loads(raw.decode('utf-8'))
            except ValueError:
                raise RuntimeError('配音接口返回的既不是音频也不是合法 JSON：' + raw[:200].decode('utf-8', 'replace'))
            kind, value = extract_audio(doc, cfg.get('audio_field', ''))
            if kind == 'url':
                target = value if value.startswith('http') else urllib.parse.urljoin(backend['url'], value)
                raw = curl(target, tmp, headers={k: v for k, v in headers.items() if k.lower() != 'content-type'},
                           key=backend['key'], proxy=proxy, insecure=insecure, timeout=timeout)
            elif kind == 'base64':
                tmp.write_bytes(value)
                raw = value
            else:
                raise RuntimeError('配音接口的 JSON 里没找到音频（audio_url / audio_base64 / audio，'
                                   '或用配置 audio_field 指定）：' + json.dumps(doc, ensure_ascii=False)[:200])
        return raw[:512]

    tokens = [os.path.expanduser(t) for t in shlex.split(backend['cmd'])]
    if tokens and tokens[0].endswith('.py') and Path(tokens[0]).is_file():
        tokens = ['python3'] + tokens
    if any('{text}' in t or '{out}' in t or '{voice}' in t for t in tokens):
        if not any('{out}' in t for t in tokens):
            sys.exit('--tts-cmd 的模板里必须有 {out}，否则不知道音频写到哪（例：your-tts {text} --out {out}）')
        argv = [t.replace('{text}', text).replace('{out}', str(tmp)).replace('{voice}', backend['voice']) for t in tokens]
    else:
        argv = tokens + [text, '--out', str(tmp)]
        if backend['voice']:
            argv += ['--voice', backend['voice']]
    proc = subprocess.run(argv, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f'配音命令失败（退出码 {proc.returncode}）：{argv[0]} …\n'
                           + proc.stderr.decode('utf-8', 'replace').strip()[:400])
    if not tmp.is_file() or tmp.stat().st_size == 0:
        raise RuntimeError(f'配音命令没有产出音频：{" ".join(argv[:3])} …')
    return tmp.read_bytes()[:512]


def tts_one(backend, text, work, index):
    """合成一句（带缓存：同文本同后端不重复调用）。返回音频文件路径。"""
    mark = hashlib.sha256(json.dumps(
        {'backend': {k: backend[k] for k in ('type', 'cmd', 'url', 'voice', 'config')}, 'text': text},
        ensure_ascii=False, sort_keys=True, default=str).encode()).hexdigest()
    for old in sorted(work.glob(f'line-{index:02d}.*')):
        if old.suffix == '.json':
            continue
        meta = Path(str(old) + '.cache.json')
        if meta.is_file():
            try:
                if json.loads(meta.read_text(encoding='utf-8')).get('identity') == mark:
                    return old
            except (ValueError, OSError):
                pass
    fallback = backend['config'].get('format') or 'mp3'
    for stale in work.glob(f'tmp-line-{index:02d}.*'):
        stale.unlink(missing_ok=True)
    tmp = work / f'tmp-line-{index:02d}.{fallback}'   # 临时名带个扩展名，给按后缀判断格式的 CLI 兜底
    head = synth(backend, text, tmp)
    out = work / f'line-{index:02d}.{sniff_ext(head, fallback)}'
    for old in work.glob(f'line-{index:02d}.*'):
        if old.suffix == '.json' or old == out:
            continue
        old.unlink(missing_ok=True)
        Path(str(old) + '.cache.json').unlink(missing_ok=True)
    tmp.replace(out)
    Path(str(out) + '.cache.json').write_text(json.dumps({'identity': mark}, ensure_ascii=False), encoding='utf-8')
    return out


def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                          '-of', 'csv=p=0', str(path)]).strip())


def main():
    ap = argparse.ArgumentParser(description='逐句 TTS（后端自带）→ 量真实时长 → 按时间码拼一条音轨')
    ap.add_argument('--lines', default='', help='JSON：[{"at": 毫秒, "text": "…"}]')
    ap.add_argument('--work', default='', help='逐句音频与中间产物目录（--check 时可省）')
    ap.add_argument('--out', default='', help='拼好的音轨输出（wav）')
    ap.add_argument('--voice', '--speaker', dest='voice', default='', help='音色标识（传给配音后端；不传就用后端的默认）')
    ap.add_argument('--tts-cmd', default='', help='本地 TTS 命令；模板可含 {text} {out} {voice}')
    ap.add_argument('--tts-api', default='', help='TTS HTTP 接口地址（POST JSON，约定见 references/pipeline.md）')
    ap.add_argument('--tts-api-key', default='', help='HTTP 接口的 key（作 Authorization: Bearer 发送）')
    ap.add_argument('--tts-config', default='', help=f'配置文件路径（默认按 {CONFIG_NAME} 的搜索顺序找）')
    ap.add_argument('--check', action='store_true', help='合成一句测试音并报时长，验证后端接好没有')
    ap.add_argument('--tts-only', action='store_true', help='只合成 + 报时长，不拼轨')
    ap.add_argument('--allow-overlap', action='store_true', help='仅在明确需要叠声时允许段落重叠')
    ap.add_argument('--tail', type=int, default=1000, help='最后一句之后留的余量（毫秒）；宁可长一点，渲片时会按画面补齐')
    a = ap.parse_args()

    work = Path(a.work).expanduser().resolve() if a.work else Path(tempfile.mkdtemp(prefix='voice-track-'))
    work.mkdir(parents=True, exist_ok=True)
    backend = resolve_backend(a, work)

    if a.check:
        audio = tts_one(backend, '这是一条配音测试，用来确认后端已经接好。', work, 99)
        print(json.dumps({'backend': {k: backend[k] for k in ('type', 'cmd', 'url', 'voice') if backend[k]},
                          '配置来源': backend['source'], '测试音频': str(audio),
                          'durMs': round(duration(audio) * 1000)}, ensure_ascii=False, indent=2))
        print(f'✅ 后端接好了：试听 {audio}（确认语速与音色合适，再开始逐句合成）')
        return

    if not a.lines:
        sys.exit('要合成口播就得给 --lines（或先用 --check 验证后端）')
    lines = json.loads(Path(a.lines).read_text(encoding='utf-8'))

    rows, problems = [], []
    for i, line in enumerate(lines):
        f = tts_one(backend, line['text'], work, i)
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
    if problems and not a.allow_overlap:
        sys.exit('句子重叠，已停止拼轨。按 overlaps 调整时间码；明确需要叠声时才使用 --allow-overlap。')
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
