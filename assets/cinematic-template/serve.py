#!/usr/bin/env python3
"""Local-only portable workspace server with audio byte-range support."""
import argparse,errno,http.server,json,mimetypes,re,socketserver,urllib.request,webbrowser
from pathlib import Path
ROOT=Path(__file__).resolve().parent
mimetypes.add_type('text/javascript','.mjs')
mimetypes.add_type('application/octet-stream','.pak')
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def log_message(self,*args):pass
 def send_head(self):
  path=Path(self.translate_path(self.path))
  if path.is_file() and 'Range' in self.headers:
   match=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers['Range'])
   if match:
    size=path.stat().st_size;start=int(match[1]);end=min(int(match[2]) if match[2] else size-1,size-1)
    if start>=size or end<start:self.send_error(416);return None
    f=path.open('rb');f.seek(start);self.range=(start,end);self.send_response(206);self.send_header('Content-Type',self.guess_type(str(path)));self.send_header('Accept-Ranges','bytes');self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(end-start+1));self.end_headers();return f
  self.range=None
  return super().send_head()
 def copyfile(self,source,outputfile):
  if getattr(self,'range',None):
   remaining=self.range[1]-self.range[0]+1
   while remaining:
    chunk=source.read(min(1024*256,remaining))
    if not chunk:break
    outputfile.write(chunk);remaining-=len(chunk)
  else:super().copyfile(source,outputfile)
 def end_headers(self):
  self.send_header('Cache-Control','no-cache');super().end_headers()
class Server(socketserver.ThreadingMixIn,http.server.HTTPServer):daemon_threads=True;allow_reuse_address=True
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8778);p.add_argument('--open',action='store_true');a=p.parse_args();url=f'http://127.0.0.1:{a.port}/'
 try:server=Server(('127.0.0.1',a.port),Handler)
 except OSError as e:
  if e.errno==errno.EADDRINUSE:
   try:
    with urllib.request.urlopen(url+'episode.json',timeout=2) as response:existing=json.load(response)
    own=json.loads((ROOT/'episode.json').read_text())
    if existing==own:
     print(f'工作台已在运行：{url}')
     if a.open:webbrowser.open(url)
     raise SystemExit(0)
   except (OSError,ValueError):pass
   print(f'端口 {a.port} 被其他程序占用。请运行 python3 serve.py --port 8779 --open。')
  else:print(f'无法创建本地服务：{e}. 请在正常终端中启动本工程。')
  raise SystemExit(1)
 print(f'粗像素电影式讲解片 · 本地预览\n{url}\nCtrl+C stops only this local server.',flush=True)
 if a.open:webbrowser.open(url)
 try:server.serve_forever()
 except KeyboardInterrupt:server.server_close()
