"""Local-only OCR bridge. No school credentials or user data are needed."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import subprocess, json, hmac, threading
root=Path(__file__).resolve().parents[2]
settings=dict(line.split('=',1) for line in (root/'.dev.vars').read_text().splitlines() if '=' in line and not line.startswith('#'))
token=settings['POSTER_OCR_TOKEN'].strip().strip('"')
slots=threading.BoundedSemaphore(2)
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def setup(self):
  super().setup();self.connection.settimeout(35)
 def reply(self,status,body):
  self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def do_POST(self):
  if self.path!='/recognize' or not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+token):return self.reply(403,b'{}')
  try:size=int(self.headers.get('Content-Length','0'))
  except ValueError:return self.reply(400,b'{}')
  if not 0<size<=8000000:return self.reply(413,b'{}')
  if not slots.acquire(blocking=False):return self.reply(429,b'{}')
  try:
   data=self.rfile.read(size)
   if len(data)!=size:return self.reply(400,b'{}')
   result=subprocess.run([str(root/'.local-ocr/recognize')],input=data,capture_output=True,timeout=30)
   if result.returncode:return self.reply(422,b'{}')
   self.reply(200,result.stdout)
  except (subprocess.TimeoutExpired,TimeoutError):self.reply(504,b'{}')
  finally:slots.release()
print('Local poster OCR listening on 127.0.0.1:4318',flush=True)
ThreadingHTTPServer(('127.0.0.1',4318),Handler).serve_forever()
