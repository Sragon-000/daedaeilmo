from pathlib import Path
import json,sqlite3,urllib.request,urllib.error,uuid,time
root=Path(__file__).resolve().parents[2]
token=(root/'.local-host/admin-token').read_text().strip()
def call(path,data=None,auth=True,origin='http://127.0.0.1:4320'):
 headers={'Origin':origin,'Content-Type':'application/json'}
 if auth:headers['X-Admin-Token']=token
 request=urllib.request.Request('http://127.0.0.1:4320/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(request) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
assert call('members',auth=False)[0]==403
assert call('profile',{},origin='https://invalid.example')[0]==403
assert call('status')[0]==200
paths=list((root/'.wrangler/state/v3/d1').glob('**/*.sqlite'))
c=None
for path in paths:
 db=sqlite3.connect(path)
 if db.execute("SELECT name FROM sqlite_master WHERE name='members'").fetchone():c=db;break
 db.close()
assert c is not None
member=str(uuid.uuid4());review=str(uuid.uuid4());course=str(uuid.uuid4());now=int(time.time()*1000)
try:
 c.execute('INSERT INTO members (id,school,subject,name,nickname,avatar,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',(member,'pcu','test-'+member,'관리검증회원','검증'+member[:10],'star',now,now))
 c.execute('INSERT INTO member_courses (id,member_id,year,semester,name,day,start,end) VALUES (?,?,?,?,?,?,?,?)',(course,member,2026,2,'검증 수업',0,540,600))
 c.execute('INSERT INTO member_reviews (id,member_id,school,place,score,body,display_mode,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',(review,member,'pcu',1,5,'검증용 리뷰','nickname',now,now));c.commit()
 assert call('profile',{'id':member,'name':'수정검증','nickname':'수정'+member[:10]})[0]==200
 status,data=call('member?id='+member);assert status==200 and len(data['courses'])==1
 assert call('delete-review',{'id':review,'memberId':member,'confirm':'no'})[0]==400
 assert call('delete-review',{'id':review,'memberId':'wrong','confirm':'삭제'})[0]==404
 assert call('delete-review',{'id':review,'memberId':member,'confirm':'삭제'})[0]==200
 assert call('delete-course',{'id':course,'memberId':member,'confirm':'삭제'})[0]==200
 assert call('logins')[0]==200
 print('PASS: local admin authentication, Origin guard, scoped profile edit, explicit deletion and read-only history')
finally:
 c.execute('DELETE FROM member_reviews WHERE member_id=?',(member,));c.execute('DELETE FROM member_courses WHERE member_id=?',(member,));c.execute('DELETE FROM members WHERE id=?',(member,));c.commit();c.close()
