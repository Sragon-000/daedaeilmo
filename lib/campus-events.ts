export type CampusEvent = {
 ocr?: {status:'read'|'review'|'unavailable';message:string;evidence?:string};
 id: string; title: string; url: string; category: string; postedAt?: string;
 schedule: string | null; application: string | null; audience: string | null; place: string | null;
 date: string | null; start: number | null; end: number | null; deadline: string | null;
 posters: string[]; needsAttachment: boolean; fetchedAt: string; contentHash?: string; sourceUnavailable?: boolean;
 sourceBoard?: string; reviewStatus?: 'unreviewed'|'verified'|'hidden'; reviewedAt?: number | null;
 activityMode?: 'single'|'series'|'flexible'|'unknown';
 activityEndDate?: string | null;
};
export function eventCandidate(title: string, year = new Date().getFullYear()) {
 const years=[...title.matchAll(/(?:^|[^\d])(20\d{2})(?!\d)/g)].map(m=>Number(m[1]));
 return /특강|워크숍|프로그램|이벤트|공모전|캠프|세미나|행사|참여자 모집|참가자 모집|교육.*모집/.test(title)
  && !/결과|선정|합격자|채용|수료|당첨|취소|종료|수상작.*공유|차량 통제|주차 통제|도로 통제/.test(title)
  && !years.some(value=>value<year);
}
function plain(html: string) {
 return html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
 .replace(/<br\s*\/?\s*>|<\/(?:p|div|tr|li|h[1-6])>/gi,'\n').replace(/<[^>]+>/g,' ')
 .replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function fullDates(text: string) {
 return [...text.matchAll(/(20\d{2})\s*[.년/-]\s*(\d{1,2})\s*[.월/-]\s*(\d{1,2})(?:일|\.)?/g)].flatMap(m=>{
 const y=+m[1],mo=+m[2],d=+m[3],date=new Date(Date.UTC(y,mo-1,d));
 return date.getUTCFullYear()===y && date.getUTCMonth()===mo-1 && date.getUTCDate()===d ? [`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`]:[];
 });
}
export function articleBody(html:string) { return /<li class="content no_title">([\s\S]*?)<\/li>/.exec(html)?.[1] || ''; }
export function parseEvent(html: string, notice: {id:string;title:string;url:string;sourceBoard?:string}, fetchedAt=new Date().toISOString()): CampusEvent {
 // Use only the article body, excluding menus, related posts, and publication dates.
 const body=articleBody(html);
 const posters = [...new Set([...body.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)].flatMap(match=>{
  try { const url=new URL(match[1].replace(/&amp;/g,'&'),notice.url);
   return url.protocol==='https:' && url.hostname==='www.pcu.ac.kr' && !url.username && !url.password && url.pathname.startsWith('/upload/') ? [url.href] : [];
  } catch {return [];}
 }))].slice(0,4);
 const lines=plain(body).split('\n').map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
 const field=(pattern:RegExp)=>{ const i=lines.findIndex(line=>pattern.test(line)); if(i<0)return null; const line=lines[i]; return (line.length<24 && !/\d{1,2}[.:]/.test(line.replace(/^\d+[.]\s*/,'')) ? line+' '+(lines[i+1] || '') : line).slice(0,300); };
 const schedule=field(/(?:행사|교육|운영|진행|특강|개최)\s*(?:일시|일정|기간|일자)|(?:^|[.ㆍ•○ -])일시\s*[:：]/);
 const application=field(/(?:신청|접수|모집)\s*(?:기간|마감|일시)/);
 const audience=field(/(?:참여|참가|신청|모집|교육)?\s*대상\s*[:：]/);
 const place=field(/(?:교육|행사|운영)?\s*장소\s*[:：]/);
 const dates=fullDates(schedule || '');
 const timeMatches=[...(schedule || '').matchAll(/(\d{1,2}):(\d{2})/g)];
 const times=timeMatches.map(m=>+m[1]<24 && +m[2]<60 ? +m[1]*60 + +m[2] : NaN);
 // Do not guess abbreviated years, multi-day schedules, or a range end omitted from the text.
 const singleDate=dates.length===1 && !/[~∼～]|부터|까지/.test((schedule || '').split(/\d{1,2}:\d{2}/)[0]);
 const exact=singleDate && times.length===2 && times[0]>=0 && times[1]<=1440 && times[1]>times[0];
 const deadlineDates=fullDates(application || '');
 const deadline=deadlineDates.length===1 && /마감/.test(application || '') && !/[~∼～]|부터/.test(application || '') ? deadlineDates[0] : null;
 return {...notice,category:/공모전/.test(notice.title)?'공모전':/특강|세미나|워크숍/.test(notice.title)?'특강·교육':/이벤트|행사/.test(notice.title)?'행사·이벤트':'프로그램·모집',schedule,application,audience,place,
 date:exact?dates[0]:null,start:exact?times[0]:null,end:exact?times[1]:null,deadline,posters,needsAttachment:/<img\b/i.test(body) || !body,fetchedAt};
}
export type FitCourse = { name?: string; day: number; start: number; end: number };
export type FitResult = { code: 'free'|'conflict'|'unknown'|'closed'; label: string; reason: string };
const clock = (m:number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export function assessEvent(event:CampusEvent,courses:FitCourse[],year:number,semester:number,now=new Date(),buffer=10,stale=false):FitResult {
 const result=(code:FitResult['code'],label:string,reason:string):FitResult=>({code,label,reason});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(stale)return result('unknown','최신 상태 확인 필요','학교 연결이 지연되어 이전 수집 정보로는 여유 여부를 확정하지 않아요.');
 if(event.deadline && event.deadline<today)return result('closed','신청 마감',`확인된 신청 마감일: ${event.deadline}`);
 if(!event.date || event.start===null || event.end===null) {
 const titleYear=event.title.match(/(?:^|[^\d])(20\d{2})(?:년|학년도|[- ]?[12]학기)/)?.[1];
 if(titleYear && Number(titleYear)<Number(today.slice(0,4)))return result('closed','이전 연도 공지 · 원문 확인','이전 연도의 행사입니다.');
 return result('unknown','일정 확인 필요','행사 날짜와 시작·종료 시간이 모두 확인되어야 비교할 수 있어요. 포스터 또는 학교 원문을 확인해 주세요.');
 }
 const ends=new Date(event.date+'T'+clock(event.end)+':00+09:00'),starts=new Date(event.date+'T'+clock(event.start)+':00+09:00');
 if(!Number.isFinite(ends.getTime()) || !Number.isFinite(starts.getTime()) || event.end<=event.start)return result('unknown','일정 확인 필요','행사 시간이 올바르지 않아 비교하지 않았어요.');
 if(ends<=now)return result('closed','행사 종료','행사 종료 시간이 지났어요.');
 if(starts<=now)return result('unknown','진행 중','이미 시작한 행사예요. 지금 참여할 수 있는지는 원문에서 확인해 주세요.');
 const [y,m]=event.date.split('-').map(Number);
 if(y!==year || (semester===1 ? m<3 || m>6 : m<9 || m>12))return result('unknown','해당 학기 시간표 필요','행사 날짜가 선택한 정규학기 범위(1학기 3~6월, 2학기 9~12월) 밖이에요.');
 if(!courses.length)return result('unknown','시간표 입력 필요','저장된 수업이 없어 비어 있는 시간표인지 아직 확인할 수 없어요.');
 const margin=Number.isFinite(buffer)?Math.max(0,Math.min(60,buffer)):10;
 const day=(new Date(event.date+'T12:00:00+09:00').getUTCDay()+6)%7;
 const clashes=courses.filter(c=>c.day===day && c.start<event.end!+margin && c.end>event.start!-margin);
 if(clashes.length)return result('conflict',`수업과 겹침 · 이동 ${margin}분 포함`,clashes.map(c=>`${c.name || '수업'} ${clock(c.start)}–${clock(c.end)}`).join(' · '));
 return result('free','시간표상 여유 있음',`${event.date} ${clock(event.start)}–${clock(event.end)} · 행사 전후 ${margin}분을 포함해 등록한 수업과 겹치지 않아요.`);
}
export function eventFit(event:CampusEvent,courses:FitCourse[],year:number,semester:number,now=new Date()) {
 return assessEvent(event,courses,year,semester,now).label;
}
