const $=id=>document.getElementById(id);
const supplied=location.hash.slice(1);if(supplied){sessionStorage.setItem('admin-token',supplied);history.replaceState(null,'',location.pathname);}
const token=sessionStorage.getItem('admin-token') || '';
let members=[],selected=null,busy=false,events=[],selectedEvent=null,previewBusy=false,institutionPublicEnabled=true;
function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function message(text){$('message').textContent=text;}
async function api(path,data){const r=await fetch('/api/'+path,{method:data?'POST':'GET',headers:{'X-Admin-Token':token,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});const v=await r.json();if(!r.ok)throw new Error(v.error || '요청을 완료하지 못했어요.');return v;}
const date=value=>value?new Date(value).toLocaleString('ko-KR'):'—';
const clock=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
function stat(parent,label,value){const e=element('div',label,'stat');e.append(element('b',value));parent.append(e);}
function previewLink(parent,label,url){const link=element('a',label);link.href=url;link.target='_blank';link.rel='noopener noreferrer';parent.append(link);}
function renderPreviews(s){
 const previews=s.previews||{},publicOrigin=s.mode==='public'&&s.gateway&&/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(s.publicUrl||'')?s.publicUrl:null;
 institutionPublicEnabled=previews.institutionPublicEnabled===true;
 for(const [kind,ready,path] of [['student',previews.studentReady,'/preview'],['institution',previews.institutionReady,'/institution-preview']]){
  $(kind+'-preview-status').textContent=ready?'● 이 Mac에서 열 수 있음':'○ 서버가 꺼졌거나 화면을 열 수 없음';
  const links=$(kind+'-preview-links');links.replaceChildren();
  if(ready)previewLink(links,'이 Mac에서 열기 ↗','http://localhost:3000'+path);
  if(ready&&publicOrigin&&(kind==='student'||institutionPublicEnabled))previewLink(links,'외부 주소 열기 ↗',publicOrigin+path);
 }
 const loginReady=previews.schoolLoginPageReady===true&&previews.schoolLoginApiReady===true;
 $('student-login-status').textContent=loginReady?'● 배재대 로그인 화면·인증 API 준비됨':'○ 배재대 로그인 화면 또는 인증 API를 확인할 수 없음';
 $('student-login-history').textContent=previews.lastSchoolLoginAt?'마지막 실제 로그인 성공 기록: '+date(previews.lastSchoolLoginAt):'실제 로그인 성공 기록 없음';
 if(loginReady){
  previewLink($('student-preview-links'),'이 Mac에서 학교 로그인 확인 ↗','http://localhost:3000/');
  if(publicOrigin)previewLink($('student-preview-links'),'외부에서 학교 로그인 확인 ↗',publicOrigin+'/');
 }
 $('institution-preview-exposure').textContent=institutionPublicEnabled?(publicOrigin?'외부 시연 허용 · 주소 사용 가능':'외부 시연 허용 · 외부 서버를 켜면 접속 가능'):'외부 시연 차단 · Mac 내부에서만 사용 가능';
 $('institution-preview-toggle').textContent=institutionPublicEnabled?'기관 시안 외부 공개 끄기':'기관 시안 외부 공개 켜기';
 $('institution-preview-toggle').disabled=previewBusy;
}
async function loadStatus(){
 const s=await api('status');
 $('server-summary').textContent=s.mode==='public'?'● 외부 접속 중':s.mode==='local'?'● 이 Mac에서 실행 중':'○ 서버 꺼짐';
 $('server-summary').className='server-summary '+(s.running?'on':'off');
 $('status').replaceChildren();
 for(const [label,value] of [['앱 서버',s.app],['OCR',s.ocr],['외부 게이트웨이',s.gateway]])stat($('status'),label,value?'연결됨':'중지');
 $('counts').replaceChildren();
 for(const [key,label] of [['members','회원'],['member_courses','수업'],['member_reviews','리뷰'],['poster_ocr','OCR 결과'],['campus_events','수집 행사'],['member_event_saves','행사 저장'],['member_event_opens','원문 열기']])stat($('counts'),label,s.counts?.[key]??'—');
 if(!s.databaseReady)$('counts').prepend(element('p','DB를 아직 읽을 수 없습니다. 서버를 켠 뒤 다시 확인해 주세요.','hint'));
 $('address').replaceChildren();
 if(s.app){const local=element('a','이 Mac에서 앱 열기');local.href='http://localhost:3000/';local.target='_blank';local.rel='noopener noreferrer';$('address').append(local);}
 if(s.publicUrl && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(s.publicUrl)){
  const link=element('a',s.publicUrl);link.href=s.publicUrl;link.target='_blank';link.rel='noopener noreferrer';
  $('address').append(document.createElement('br'),'외부 접속 주소: ',link);
 }else if(s.mode==='public')$('address').append(document.createElement('br'),'외부 주소를 발급받는 중…');
 $('local').disabled=busy||s.running;$('public').disabled=busy||s.running;$('stop').disabled=busy||!s.running;
 renderPreviews(s);
}
function renderMembers(){const query=$('search').value.trim();$('members').replaceChildren();for(const m of members.filter(m=>m.name.includes(query)||m.nickname.includes(query))){const b=element('button',(m.name||'프로필 설정 전')+' · @'+m.nickname,'member'+(selected?.id===m.id?' selected':''));b.onclick=()=>selectMember(m);$('members').append(b);}if(!$('members').children.length)$('members').append(element('p','회원이 없습니다.'));}
async function loadMembers(){members=await api('members');renderMembers();}
async function selectMember(m){selected=m;renderMembers();$('selection').textContent='가입일 '+date(m.created_at);$('profile').hidden=false;$('name').value=m.name;$('nickname').value=m.nickname;await details();}
async function details(){if(!selected)return;const id=selected.id,data=await api('member?id='+encodeURIComponent(id));if(selected?.id!==id)return;$('detail').replaceChildren();for(const [key,title] of [['courses','시간표'],['reviews','리뷰']]){const heading=element('h3',title+' '+data[key].length+'건');$('detail').append(heading);for(const item of data[key]){const row=element('div',undefined,'record'),text=element('div');if(key==='courses'){text.append(element('p',`${item.year}년 ${item.semester}학기 · ${item.name}`),element('p',`${'월화수목금'[item.day]} ${clock(item.start)}–${clock(item.end)}`));}else{text.append(element('p',`공간 ID ${item.place} · ${item.score}점 · ${item.display_mode==='name'?'이름':'닉네임'} 표시`),element('p',item.body));}const b=element('button','삭제','danger');b.onclick=async()=>{if(prompt('이 데이터를 영구 삭제하려면 "삭제"를 입력해 주세요.')!=='삭제')return;try{await api(key==='courses'?'delete-course':'delete-review',{id:item.id,memberId:id,confirm:'삭제'});message('삭제했어요.');await details();await loadStatus();}catch(e){message(e.message);}};row.append(text,b);$('detail').append(row);}}}
async function logins(){const data=await api('logins');$('logins').replaceChildren();for(const l of data){const tr=element('tr');for(const text of [l.name+(l.nickname?' / @'+l.nickname:''),date(l.logged_at),date(l.expires_at),l.logged_out_at?'로그아웃':l.expires_at>Date.now()?'세션 만료 전':'만료'])tr.append(element('td',text));$('logins').append(tr);}if(!data.length){const tr=element('tr'),td=element('td','기록된 로그인이 아직 없습니다.');td.colSpan=4;tr.append(td);$('logins').append(tr);}}
async function control(action){if(action==='stop'&&!confirm('서버를 중지하면 외부 앱과 OCR 연결도 끊어집니다. 중지할까요?'))return;busy=true;for(const id of ['local','public','stop'])$(id).disabled=true;try{message((await api('control',{action})).message);}catch(e){message(e.message);}finally{busy=false;await loadStatus().catch(e=>message(e.message));}}
$('local').onclick=()=>control('start');$('public').onclick=()=>control('public');$('stop').onclick=()=>control('stop');$('search').oninput=renderMembers;
$('institution-preview-toggle').onclick=async()=>{previewBusy=true;$('institution-preview-toggle').disabled=true;try{message((await api('institution-preview',{publicEnabled:!institutionPublicEnabled})).message);}catch(e){message(e.message);}finally{previewBusy=false;await loadStatus().catch(e=>message(e.message));}};
$('backup').onclick=async()=>{try{message((await api('backup',{})).message);}catch(e){message(e.message);}};
$('profile').onsubmit=async e=>{e.preventDefault();if(!selected)return;try{message((await api('profile',{id:selected.id,name:$('name').value,nickname:$('nickname').value})).message);await loadMembers();selected=members.find(m=>m.id===selected.id);renderMembers();}catch(err){message(err.message);}};
function renderEvents(){const q=$('event-search').value.trim().toLocaleLowerCase('ko-KR');$('events').replaceChildren();for(const item of events.filter(e=>e.title.toLocaleLowerCase('ko-KR').includes(q))){const label=item.review_status==='verified'?'확인됨':item.review_status==='hidden'?'숨김':'확인 필요';const b=element('button',`${item.title} · ${label}`,'member'+(selectedEvent?.id===item.id?' selected':''));b.onclick=()=>selectEvent(item);$('events').append(b);}if(!$('events').children.length)$('events').append(element('p','수집한 행사가 없어요. 앱에서 행사를 새로고침해 주세요.'));}
async function loadEvents(){events=await api('events');if(selectedEvent)selectedEvent=events.find(e=>e.id===selectedEvent.id)||null;renderEvents();}
function selectEvent(item){selectedEvent=item;renderEvents();$('event-selection').textContent=`${item.title} · 마지막 수집 ${date(item.last_seen_at)}`;const link=$('event-original');link.hidden=!/^https:\/\/www\.pcu\.ac\.kr\/kor\/article\/(Notify_1|Event_1)\/[0-9]+$/.test(item.url);if(!link.hidden)link.href=item.url;$('event-review').hidden=false;$('event-status').value=item.review_status;$('event-activity-mode').value=item.fields.activityMode||'unknown';for(const key of ['schedule','application','audience','place','date','deadline'])$('event-'+key).value=item.fields[key]||'';$('event-activity-end-date').value=item.fields.activityEndDate||'';for(const key of ['start','end'])$('event-'+key).value=Number.isInteger(item.fields[key])?clock(item.fields[key]):'';}
function minutes(value){if(!value)return null;const m=/^([0-2][0-9]):([0-5][0-9])$/.exec(value);return m?Number(m[1])*60+Number(m[2]):null;}
$('event-search').oninput=renderEvents;
$('event-review').onsubmit=async e=>{e.preventDefault();if(!selectedEvent)return;const status=$('event-status').value;if(status==='verified'&&!confirm('학교 원문과 수정 내용을 직접 대조했나요? 확인됨 상태로 저장합니다.'))return;const fields={activityMode:$('event-activity-mode').value,activityEndDate:$('event-activity-end-date').value||null};for(const key of ['schedule','application','audience','place','date','deadline'])fields[key]=$('event-'+key).value.trim()||null;for(const key of ['start','end'])fields[key]=minutes($('event-'+key).value);try{message((await api('event-review',{id:selectedEvent.id,status,fields})).message);await loadEvents();if(selectedEvent)selectEvent(selectedEvent);await loadStatus();}catch(err){message(err.message);}};
async function refresh(){await Promise.all([loadStatus(),loadMembers(),logins(),loadEvents()]);}
$('refresh').onclick=()=>refresh().catch(e=>message(e.message));refresh().catch(e=>message(e.message));setInterval(()=>Promise.all([loadStatus(),logins()]).catch(e=>message(e.message)),5000);
