import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {issueSchoolSession,readSchoolSession} from '../../lib/school-session.ts';
const secret=readFileSync('.dev.vars','utf8').match(/SCHOOL_SESSION_SECRET=["']?([^\s"']+)/)[1];
const token=issueSchoolSession('history-test-only',secret),session=readSchoolSession(token,secret);
function db(action){return execFileSync('python3',['-c',`
import sqlite3,glob,sys,json,time
s=json.loads(sys.argv[2])
for path in glob.glob('.wrangler/state/v3/d1/**/*.sqlite',recursive=True):
 c=sqlite3.connect(path)
 if not c.execute("select name from sqlite_master where name='school_login_events'").fetchone():c.close();continue
 if sys.argv[1]=='insert':c.execute('INSERT INTO school_login_events (id,school,subject,logged_at,expires_at) VALUES (?,?,?,?,?)',(s['nonce'],s['school'],s['subject'],int(time.time()*1000),s['expiresAt']*1000))
 if sys.argv[1]=='read':print(bool(c.execute('SELECT logged_out_at FROM school_login_events WHERE id=?',(s['nonce'],)).fetchone()[0]))
 if sys.argv[1]=='delete':c.execute('DELETE FROM school_login_events WHERE id=?',(s['nonce'],))
 c.commit();c.close()
`,action,JSON.stringify(session)],{encoding:'utf8'}).trim();}
db('insert');try{const response=await fetch('http://localhost:3000/api/school-auth',{method:'DELETE',headers:{Origin:'http://localhost:3000',Cookie:'school_session='+token}});assert.equal(response.status,200);assert.equal(db('read'),'True');console.log('PASS: running app records logout for the matching session');}finally{db('delete');}
