from pathlib import Path
import subprocess,os,time,urllib.request
ROOT=Path(__file__).resolve().parents[2];STATE=ROOT/'.local-host';STATE.mkdir(exist_ok=True)
def ready():
 try:
  token=(STATE/'admin-token').read_text().strip()
  req=urllib.request.Request('http://127.0.0.1:4320/api/health',headers={'X-Admin-Token':token})
  with urllib.request.urlopen(req,timeout=2) as r:return r.status==200
 except Exception:return False
if not ready():
 fd=os.open(STATE/'admin.log',os.O_CREAT|os.O_APPEND|os.O_WRONLY,0o600)
 subprocess.Popen([os.sys.executable,str(ROOT/'scripts/admin/server.py')],cwd=ROOT,stdin=subprocess.DEVNULL,stdout=fd,stderr=fd,start_new_session=True);os.close(fd)
 for _ in range(30):
  if ready():break
  time.sleep(.3)
 else:raise RuntimeError('관리 서버를 시작하지 못했습니다. .local-host/admin.log를 확인해 주세요.')
url='http://127.0.0.1:4320/#'+(STATE/'admin-token').read_text().strip()
subprocess.run(['/usr/bin/open',url],check=True)
