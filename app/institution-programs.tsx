'use client';
import { useEffect, useState } from 'react';
import { assessEvent, type CampusEvent } from '@/lib/campus-events';

type Program = { id:string;title:string;description:string;eligibility:string;place:string;event_date:string|null;start_minute:number|null;end_minute:number|null;capacity:number;accepted_count:number;absence_confirmed:number;absence_evidence:string;source_url:string|null;my_status:string|null;my_acknowledged_at:number|null };
const labels:Record<string,string>={applied:'신청 접수',accepted:'기관 수락',declined:'기관 미선발',cancelled_by_student:'신청 취소',cancelled_by_institution:'기관 취소'};
export default function InstitutionPrograms({courses,year,semester}:{courses:{day:number;start:number;end:number}[];year:number;semester:number}) {
 const [programs,setPrograms]=useState<Program[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(''),[shareProfile,setShareProfile]=useState(false);
 async function load(){const r=await fetch('/api/programs',{cache:'no-store'});if(!r.ok)throw new Error('기관 프로그램을 불러오지 못했어요.');const data=await r.json() as {programs:Program[]};setPrograms(data.programs);}
 useEffect(()=>{void Promise.resolve().then(load).catch(e=>setError(e.message));const timer=setInterval(()=>{void load().catch(()=>{});},30000);return()=>clearInterval(timer);},[]);
 async function act(programId:string,action:'apply'|'cancel'|'acknowledge'){
  setBusy(programId);setError('');
  try{const r=await fetch('/api/applications',{method:action==='apply'?'POST':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({programId,action,shareProfile})});
   if(!r.ok){const data=await r.json() as {message?:string};throw new Error(data.message||'처리하지 못했어요.');}await load();
  }catch(e){setError(e instanceof Error?e.message:'처리하지 못했어요.');}finally{setBusy('');}
 }
 return <section className="campus-events institution-programs"><div className="section-heading"><h2>기관 신청 프로그램 <span className="live-label">실제 접수</span></h2><button type="button" onClick={()=>void load().catch(e=>setError(e.message))} aria-label="기관 프로그램 새로고침">↻</button></div>
  <p className="section-caption">기관이 직접 등록·확인한 프로그램입니다. 신청과 처리 상태는 서버에 저장됩니다. 기관의 수락 후 이 화면에서 확인 버튼을 눌러 참여 의사를 알려주세요.</p>
  {programs.length>0&&<label className="program-consent"><input type="checkbox" checked={shareProfile} onChange={e=>setShareProfile(e.target.checked)}/> 신청 시 내 프로필의 이름·닉네임을 해당 기관 담당자에게 제공하는 데 동의합니다. 이름은 학교가 확인한 값이 아닙니다.</label>}
  {error&&<p role="alert" className="auth-message">{error}</p>}
  {programs.length===0&&<p className="sample-note">현재 기관이 공개한 신청 프로그램이 없습니다.</p>}
  {programs.map(p=>{
   const event={id:p.id,title:p.title,url:p.source_url||'',category:'기관 프로그램',schedule:null,application:null,audience:p.eligibility,place:p.place,date:p.event_date,start:p.start_minute,end:p.end_minute,deadline:null,posters:[],needsAttachment:false,fetchedAt:new Date().toISOString()} satisfies CampusEvent;
   const fit=assessEvent(event,courses,year,semester);
   return <article className="campus-event-card" key={p.id}><div className="event-meta"><span>기관 직접 등록</span><b className={`fit-badge fit-${fit.code}`}>{fit.label}</b>{p.absence_confirmed===1&&<b className="absence-badge">공결 가능 · 기관 확인</b>}</div>
    <h3>{p.title}</h3><p>{p.description}</p><dl className="event-facts"><div><dt>대상</dt><dd>{p.eligibility}</dd></div><div><dt>일시</dt><dd>{p.event_date||'기관 안내 확인'} {p.start_minute!==null&&p.end_minute!==null?`${String(Math.floor(p.start_minute/60)).padStart(2,'0')}:${String(p.start_minute%60).padStart(2,'0')}–${String(Math.floor(p.end_minute/60)).padStart(2,'0')}:${String(p.end_minute%60).padStart(2,'0')}`:''}</dd></div><div><dt>장소</dt><dd>{p.place||'기관 안내 확인'}</dd></div><div><dt>확정</dt><dd>{p.accepted_count}/{p.capacity}명</dd></div></dl>
    <p className="fit-reason">{fit.reason}</p>{p.absence_confirmed===1&&<p className="event-review-note">공결 근거: {p.absence_evidence} · 실제 인정 여부는 수업 담당자에게 확인하세요.</p>}
    <div className="event-actions">{!p.my_status||p.my_status==='cancelled_by_student'?<button type="button" className="event-save" disabled={busy===p.id||fit.code==='closed'||p.accepted_count>=p.capacity||!shareProfile} onClick={()=>void act(p.id,'apply')}>{p.accepted_count>=p.capacity?'정원 마감':'신청하기'}</button>:<><strong>{labels[p.my_status]||p.my_status}{p.my_acknowledged_at?' · 확인 완료':''}</strong>{p.my_status==='accepted'&&!p.my_acknowledged_at&&<button type="button" className="event-save" disabled={busy===p.id} onClick={()=>void act(p.id,'acknowledge')}>수락 확인</button>}{['applied','accepted'].includes(p.my_status)&&<button type="button" className="event-save" disabled={busy===p.id} onClick={()=>void act(p.id,'cancel')}>신청 취소</button>}</>}{p.source_url&&<a href={p.source_url} target="_blank" rel="noopener noreferrer">학교 원문 ↗</a>}</div>
   </article>;
  })}
 </section>;
}
