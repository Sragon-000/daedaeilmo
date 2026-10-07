"""Mac-only management API. Never routed through the public gateway."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import sqlite3, json, secrets, hmac, os, subprocess, socket, time, urllib.parse, re, datetime
ROOT=Path(__file__).resolve().parents[2]
STATE=ROOT/'.local-host';STATE.mkdir(exist_ok=True)
TOKEN_FILE=STATE/'admin-token'
if not TOKEN_FILE.exists():
 fd=os.open(TOKEN_FILE,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
 with os.fdopen(fd,'w') as f:f.write(secrets.token_hex(32))
TOKEN=TOKEN_FILE.read_text().strip()
ENV={**os.environ,'PATH':'/opt/homebrew/bin:/usr/local/bin:/Library/Frameworks/Python.framework/Versions/3.14/bin:'+os.environ.get('PATH','')}
def database():
 matches=[]
 for path in (ROOT/'.wrangler/state/v3/d1').glob('**/*.sqlite'):
  c=sqlite3.connect(f'file:{path}?mode=ro',uri=True)
  try:
   if c.execute("SELECT name FROM sqlite_master WHERE name='members'").fetchone():matches.append(path)
  finally:c.close()
 if len(matches)!=1:raise RuntimeError('DB_UNAVAILABLE')
 c=sqlite3.connect(matches[0],timeout=5);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');return c

def rows(c,sql,args=()):return [dict(row) for row in c.execute(sql,args).fetchall()]
def host_running():
 try:
  pid=int((STATE/'host.pid').read_text());cmd=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True,stderr=subprocess.DEVNULL)
  return str(ROOT/'scripts/hosting/mac.mjs')+' run' in cmd
 except Exception:return False

def port_ready(port):
 try:
  with socket.create_connection(('localhost',port),timeout=.5):return True
 except OSError:return False

class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def respond(self,status,data):
  body=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def allowed(self,write=False):
  if self.headers.get('Host') not in ['127.0.0.1:4320','localhost:4320']:return False
  if not hmac.compare_digest(self.headers.get('X-Admin-Token',''),TOKEN):return False
  if write and self.headers.get('Origin') not in ['http://127.0.0.1:4320','http://localhost:4320']:return False
  return True
 def do_GET(self):
  url=urllib.parse.urlsplit(self.path)
  static={'/':('index.html','text/html'),'/admin.js':('admin.js','text/javascript'),'/admin.css':('admin.css','text/css')}
  if url.path in static:
   if self.headers.get('Host') not in ['127.0.0.1:4320','localhost:4320']:return self.respond(403,{})
   file,mime=static[url.path];data=(ROOT/'scripts/admin'/file).read_bytes();self.send_response(200);self.send_header('Content-Type',mime+'; charset=utf-8');self.send_header('Content-Security-Policy',"default-src 'self'; frame-ancestors 'none'; base-uri 'none'");self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data);return
  if not self.allowed():return self.respond(403,{'error':'실행기에서 관리 화면을 다시 열어 주세요.'})
  try:
   if url.path=='/api/health':return self.respond(200,{'ready':True})
   if url.path=='/api/status':
    running=host_running();public=(STATE/'public-url').read_text().strip() if running and (STATE/'public-url').exists() else None
    with database() as c:
     counts={table:c.execute('SELECT COUNT(*) FROM '+table).fetchone()[0] for table in ['members','member_courses','member_reviews','poster_ocr','campus_events','member_event_saves','member_event_opens']}
    return self.respond(200,{'running':running,'app':port_ready(3000),'ocr':port_ready(4318),'gateway':port_ready(3010),'publicUrl':public,'counts':counts})
   with database() as c:
    if url.path=='/api/members':data=rows(c,"SELECT id,name,nickname,avatar,created_at,updated_at FROM members ORDER BY created_at DESC LIMIT 500")
    elif url.path=='/api/logins':data=rows(c,"SELECT COALESCE(NULLIF(m.name,''),'프로필 설정 전') AS name, m.nickname, l.logged_at, l.expires_at, l.logged_out_at FROM school_login_events l LEFT JOIN members m ON m.subject=l.subject AND m.school=l.school ORDER BY l.logged_at DESC LIMIT 200")
    elif url.path=='/api/member':
     member_id=urllib.parse.parse_qs(url.query).get('id',[''])[0]
     data={'courses':rows(c,'SELECT id,year,semester,name,day,start,end FROM member_courses WHERE member_id=? ORDER BY year DESC,semester DESC,day,start',(member_id,)), 'reviews':rows(c,'SELECT id,place,score,body,display_mode,created_at FROM member_reviews WHERE member_id=? ORDER BY created_at DESC',(member_id,))}
    elif url.path=='/api/events':
     data=[]
     for row in rows(c,'SELECT id,title,url,source_board,payload,review_status,reviewed_at,first_seen_at,last_seen_at,override_json FROM campus_events ORDER BY last_seen_at DESC LIMIT 100'):
      source=json.loads(row.pop('payload'))
      override=json.loads(row.pop('override_json') or '{}')
      row['fields']={key:override.get(key,source.get(key)) for key in ['schedule','application','audience','place','date','start','end','deadline']}
      data.append(row)
    else:return self.respond(404,{})
   self.respond(200,data)
  except Exception:self.respond(503,{'error':'관리 데이터를 읽지 못했어요. 데이터베이스와 마이그레이션 상태를 확인해 주세요.'})
 def do_POST(self):
  if not self.allowed(True):return self.respond(403,{'error':'허용되지 않은 관리 요청입니다.'})
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 0<length<=4096:return self.respond(400,{})
   data=json.loads(self.rfile.read(length))
   if not isinstance(data,dict):return self.respond(400,{})
   if self.path=='/api/control':
    action=data.get('action');mapping={'start':'start','public':'public','stop':'stop'}
    if action not in mapping:return self.respond(400,{})
    if action!='stop' and host_running():return self.respond(409,{'error':'이미 실행 중입니다. 모드를 바꾸려면 먼저 중지해 주세요.'})
    r=subprocess.run(['node',str(ROOT/'scripts/hosting/mac.mjs'),mapping[action]],cwd=ROOT,env=ENV,capture_output=True,timeout=15)
    if r.returncode:return self.respond(409,{'error':'실행하지 못했어요. 사용 중인 포트와 빌드 상태를 확인해 주세요.'})
    return self.respond(200,{'message':'중지 요청을 보냈어요.' if action=='stop' else '서버를 시작합니다. 상태가 곧 갱신됩니다.'})
   if self.path=='/api/backup':
    folder=STATE/'backups';folder.mkdir(mode=0o700,exist_ok=True);path=folder/('database-'+time.strftime('%Y%m%d-%H%M%S')+'-'+secrets.token_hex(3)+'.sqlite')
    fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
    with database() as source,sqlite3.connect(path) as target:source.backup(target)
    return self.respond(200,{'message':'DB 백업 완료 (사진 파일 제외): '+str(path)})
   with database() as c:
    if self.path=='/api/profile':
     name=data.get('name','');nickname=data.get('nickname','')
     if not all(isinstance(v,str) and 2<=len(v.strip())<=24 and all(ord(ch)>=32 for ch in v) for v in [name,nickname]):return self.respond(400,{'error':'이름과 닉네임은 2~24자로 입력해 주세요.'})
     result=c.execute('UPDATE members SET name=?,nickname=?,updated_at=? WHERE id=?',(name.strip(),nickname.strip(),int(time.time()*1000),data.get('id')))
    elif self.path=='/api/event-review':
     event_id=data.get('id');status=data.get('status');fields=data.get('fields')
     if not isinstance(event_id,str) or not re.fullmatch(r'(Notify_1|Event_1):[0-9]{1,20}',event_id) or status not in ['unreviewed','verified','hidden'] or not isinstance(fields,dict):return self.respond(400,{'error':'행사 검수 입력을 확인해 주세요.'})
     if set(fields)!=set(['schedule','application','audience','place','date','start','end','deadline']):return self.respond(400,{'error':'행사 필드를 확인해 주세요.'})
     for key in ['schedule','application','audience','place']:
      if fields[key] is not None and (not isinstance(fields[key],str) or len(fields[key])>300):return self.respond(400,{'error':'텍스트 필드를 확인해 주세요.'})
     for key in ['date','deadline']:
      if fields[key] is not None:
       if not isinstance(fields[key],str) or not re.fullmatch(r'20[0-9]{2}-[0-9]{2}-[0-9]{2}',fields[key]):return self.respond(400,{'error':'날짜 형식은 YYYY-MM-DD입니다.'})
       try:datetime.date.fromisoformat(fields[key])
       except ValueError:return self.respond(400,{'error':'실제 달력 날짜를 입력해 주세요.'})
     for key in ['start','end']:
      if fields[key] is not None and (type(fields[key]) is not int or not 0<=fields[key]<=1440):return self.respond(400,{'error':'행사 시간을 확인해 주세요.'})
     if fields['start'] is not None or fields['end'] is not None:
      if fields['date'] is None or fields['start'] is None or fields['end'] is None or fields['end']<=fields['start']:return self.respond(400,{'error':'날짜와 시작·종료 시간을 함께 입력해 주세요.'})
     original=c.execute('SELECT payload FROM campus_events WHERE id=?',(event_id,)).fetchone()
     if not original:return self.respond(404,{'error':'행사를 찾지 못했어요.'})
     source=json.loads(original['payload']);override={key:value for key,value in fields.items() if value!=source.get(key)}
     result=c.execute('UPDATE campus_events SET review_status=?,reviewed_at=?,override_json=? WHERE id=?',(status,int(time.time()*1000) if status=='verified' else None,json.dumps(override,ensure_ascii=False) if override else None,event_id))
    elif self.path in ['/api/delete-review','/api/delete-course']:
     if data.get('confirm')!='삭제':return self.respond(400,{})
     table='member_reviews' if self.path=='/api/delete-review' else 'member_courses'
     result=c.execute('DELETE FROM '+table+' WHERE id=? AND member_id=?',(data.get('id'),data.get('memberId')))
    else:return self.respond(404,{})
    if result.rowcount!=1:return self.respond(404,{'error':'해당 데이터를 찾지 못했어요.'})
   self.respond(200,{'message':'변경사항을 저장했어요.'})
  except sqlite3.IntegrityError:self.respond(409,{'error':'이미 사용 중인 닉네임입니다.'})
  except Exception:self.respond(503,{'error':'요청을 완료하지 못했어요.'})
print('Mac management ready: http://127.0.0.1:4320',flush=True)
ThreadingHTTPServer(('127.0.0.1',4320),Handler).serve_forever()
