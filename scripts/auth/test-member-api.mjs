import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { issueSchoolSession } from '../../lib/school-session.ts';
const base = 'http://localhost:3000';
const secret = readFileSync('.dev.vars', 'utf8').match(/SCHOOL_SESSION_SECRET=["']?([^\s"']+)/)[1];
const tokens = ['integration-test-a', 'integration-test-b'].map(id => issueSchoolSession(id, secret));
async function request(path, who = 0, method = 'GET', body, origin = base) {
 const r = await fetch(base + '/api/' + path, {method, headers: {'Content-Type':'application/json', Origin: origin, ...(who === null ? {} : {cookie:'school_session=' + tokens[who]})}, ...(body ? {body:JSON.stringify(body)} : {})});
 const text = await r.text(); let data; try { data=JSON.parse(text); } catch { data={}; } return {status:r.status,data};
}
for (const path of ['profile','reviews','timetable?year=2026&semester=1']) assert.equal((await request(path,null)).status,401);
assert.equal((await request('profile',0,'POST',{},'https://invalid.test')).status,403);
for (let who=0;who<2;who++) {
 const before = await request('profile',who); assert.equal(before.status,200);
 assert.equal((await request('profile',who)).data.member.id,before.data.member.id);
 assert.equal((await request('profile',who,'POST',{name:'검증이름'+who,nickname:'검증닉네임'+who,avatar:'star'})).status,200);
}
const course={year:2026,semester:1,name:'자동검증 수업',day:0,start:540,end:600};
assert.equal((await request('timetable',0,'POST',course)).status,200);
assert.equal((await request('timetable',0,'POST',course)).status,409);
const list=await request('timetable?year=2026&semester=1'); assert.equal(list.data.courses.length,1);
const id=list.data.courses[0].id;
assert.equal((await request('timetable?year=2026&semester=2')).data.courses.length,0);
assert.equal((await request('timetable?year=2026&semester=1',1)).data.courses.length,0);
assert.equal((await request('timetable',1,'POST',{...course,id})).status,409);
assert.equal((await request('timetable?id='+id,1,'DELETE')).status,404);
assert.equal((await request('timetable',0,'POST',{...course,id,name:'수정 검증'})).status,200);
assert.equal((await request('timetable?id='+id,0,'DELETE')).status,200);
assert.equal((await request('reviews',0,'POST',{place:1,score:5,text:'자동 검증 리뷰입니다',displayMode:'nickname'})).status,200);
const reviews=(await request('reviews',1)).data.reviews;
const review=reviews.find(r=>r.author==='검증닉네임0'); assert.ok(review); assert.equal(review.mine,false);
assert.ok(!JSON.stringify(review).includes('검증이름0')); assert.ok(!('member_id' in review));
assert.equal((await request('reviews?id='+review.id,1,'DELETE')).status,404);
assert.equal((await request('reviews?id='+review.id,0,'DELETE')).status,200);
console.log('PASS: profile persistence, auth/origin guards, semester isolation, overlap, ownership, review identity');
