'use client';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Search } from 'lucide-react';
import { assessEvent, type CampusEvent, type FitResult } from '@/lib/campus-events';

type Feed = {items:CampusEvent[];fetchedAt:string;mode:string;partial:boolean};
type Saved = {ids:string[];items:CampusEvent[]};
const syncEvent = 'daedaeilmo:event-saves-changed';

function Poster({src,title}:{src:string;title:string}) {
 const [failed,setFailed]=useState(false);
 return failed ? <span className="poster-unavailable">포스터는 학교 원문에서 확인해 주세요 ↗</span>
  : <Image unoptimized src={src} alt={title+' 포스터'} width={800} height={1100} className="campus-event-poster" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
}

function EventCard({event,fit,saved,onSave}:{event:CampusEvent;fit:FitResult;saved:boolean;onSave:(event:CampusEvent)=>void}) {
 const source = event.sourceBoard==='Event_1'?'교내행사':'일반공지';
 const opening = () => { void fetch('/api/event-opens',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:event.id}),keepalive:true}).catch(()=>{}); };
 return <article className="campus-event-card">
  <div className="event-meta"><span>{event.category}</span><span>배재대 {source}</span><b className={`fit-badge fit-${fit.code}`}>{fit.label}</b></div>
  <h3>{event.title}</h3>
  <dl className="event-facts">
   <div><dt>진행</dt><dd>{event.schedule || '일정은 학교 원문에서 확인'}</dd></div>
   <div><dt>장소</dt><dd>{event.place || '원문 확인 필요'}</dd></div>
   <div><dt>대상</dt><dd>{event.audience || '원문 확인 필요'}</dd></div>
   <div><dt>신청</dt><dd>{event.application || '마감·자격은 원문 확인 필요'}</dd></div>
  </dl>
  <p className="fit-reason">{fit.reason}</p>
  {event.reviewStatus !== 'verified' && <p className="event-review-note">자동으로 읽은 공지입니다. 날짜·대상·모집 상태는 학교 원문에서 다시 확인해 주세요.</p>}
  {event.ocr && <details className="ocr-evidence"><summary>{event.ocr.message}</summary>{event.ocr.evidence && <p>{event.ocr.evidence}</p>}<p>포스터에서 읽은 일정이므로 원본과 비교해 주세요.</p></details>}
  {event.posters?.length>0 && <a className="event-poster-link" href={event.url} onClick={opening} target="_blank" rel="noopener noreferrer" aria-label={event.title+' 학교 원문 열기'}>
   {event.posters.map(src=><Poster key={src} src={src} title={event.title}/>)}</a>}
  <div className="event-actions">
   <button type="button" className={`event-save ${saved?'is-saved':''}`} onClick={()=>onSave(event)} aria-pressed={saved}><Bookmark size={16} fill={saved?'currentColor':'none'}/>{saved?'저장됨':'저장'}</button>
   <a href={event.url} onClick={opening} target="_blank" rel="noopener noreferrer">학교 원문 보기 ↗</a>
  </div>
  <p className="event-updated">{event.postedAt?'학교 게시 '+event.postedAt+' · ':''}마지막 수집 {new Date(event.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}{event.reviewStatus==='verified'&&event.reviewedAt?' · 운영자 확인 '+new Date(event.reviewedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):''}</p>
 </article>;
}

export default function CampusEvents({courses,year,semester}:{courses:{day:number;start:number;end:number}[];year:number;semester:number}) {
 const [data,setData]=useState<Feed|null>(null),[saved,setSaved]=useState<Saved>({ids:[],items:[]}),[error,setError]=useState(''),[saveError,setSaveError]=useState(''),[attempt,setAttempt]=useState(0);
 const [now,setNow]=useState<Date>(()=>new Date());
 const [onlyFit,setOnlyFit]=useState(false),[onlySaved,setOnlySaved]=useState(false),[buffer,setBuffer]=useState(10),[query,setQuery]=useState(''),[category,setCategory]=useState('all');
 useEffect(()=>{const controller=new AbortController();fetch('/api/events',{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('학교 행사 연결이 지연되고 있어요.');return r.json() as Promise<Feed>;}).then(result=>{if(!controller.signal.aborted){setData(result);setError('');}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[attempt]);
 useEffect(()=>{const controller=new AbortController();const load=()=>{fetch('/api/event-saves',{signal:controller.signal}).then(r=>r.ok?r.json() as Promise<Saved>:Promise.reject()).then(result=>{if(!controller.signal.aborted)setSaved(result);}).catch(()=>{if(!controller.signal.aborted)setSaveError('저장 목록을 불러오지 못했어요.');});};load();window.addEventListener(syncEvent,load);return()=>{controller.abort();window.removeEventListener(syncEvent,load);};},[]);
 useEffect(()=>{const timer=setInterval(()=>{setNow(new Date());setAttempt(v=>v+1);},60000);return()=>clearInterval(timer);},[]);
 async function toggleSave(event:CampusEvent) {
  const exists=saved.ids.includes(event.id);
  setSaveError('');
  try {
   const r=await fetch(exists?'/api/event-saves?id='+encodeURIComponent(event.id):'/api/event-saves',{method:exists?'DELETE':'POST',...(exists?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({id:event.id})})});
   if(!r.ok)throw new Error();
   window.dispatchEvent(new Event(syncEvent));
  } catch {setSaveError('저장 상태를 바꾸지 못했어요. 다시 시도해 주세요.');}
 }
 const all=useMemo(()=>{
  const map=new Map<string,CampusEvent>();for(const event of data?.items || [])map.set(event.id,event);
  for(const event of saved.items)if(!map.has(event.id))map.set(event.id,event);
  return [...map.values()];
 },[data,saved]);
 const evaluated=all.map(event=>({event,fit:assessEvent(event,courses,year,semester,now,buffer,
  data?.mode==='stale' || !!data?.partial || !!error || now.getTime()-Date.parse(event.fetchedAt)>86400000)})).filter(item=>item.fit.code!=='closed');
 const freeCount=evaluated.filter(item=>item.fit.code==='free').length;
 const categories=[...new Set(all.map(event=>event.category))];
 const needle=query.trim().toLocaleLowerCase('ko-KR');
 const items=evaluated.filter(({event,fit})=>(!onlyFit||fit.code==='free')&&(!onlySaved||saved.ids.includes(event.id))
  &&(category==='all'||event.category===category)
  &&(!needle||[event.title,event.place,event.audience,event.category].some(value=>value?.toLocaleLowerCase('ko-KR').includes(needle))))
  .sort((a,b)=>Number(saved.ids.includes(b.event.id))-Number(saved.ids.includes(a.event.id)) || Number(b.fit.code==='free')-Number(a.fit.code==='free'));
 return <section className="campus-events"><div className="section-heading"><h2>학교 행사·모집 <span className="live-label">실제 공지</span></h2><button onClick={()=>{setError('');setData(null);setAttempt(v=>v+1);}} aria-label="행사 다시 불러오기">↻</button></div>
  <p className="section-caption">배재대 공식 공지 · 최대 10분 간격 갱신. 일정과 자격은 신청 전에 원문에서 확인해 주세요.</p>
  <div className="event-fit-summary" aria-live="polite">{data?`시간표상 여유 ${freeCount} · 겹침 ${evaluated.filter(i=>i.fit.code==='conflict').length} · 확인 필요 ${evaluated.filter(i=>i.fit.code==='unknown').length}`:'학교 행사 확인 중'}</div>
  <div className="event-controls"><label className="event-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="행사·장소·대상 검색" aria-label="행사 검색"/></label>
   <label className="event-filter">분야<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">전체</option>{categories.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
   <label className="event-filter">이동 여유<select aria-label="행사 전후 이동 여유" value={buffer} onChange={e=>setBuffer(Number(e.target.value))}>{[0,10,20,30].map(n=><option key={n} value={n}>{n}분</option>)}</select></label></div>
  <div className="event-toggles"><label className="event-filter"><input type="checkbox" checked={onlyFit} onChange={e=>setOnlyFit(e.target.checked)}/> 시간표상 여유</label><label className="event-filter"><input type="checkbox" checked={onlySaved} onChange={e=>setOnlySaved(e.target.checked)}/> 저장한 행사 ({saved.ids.length})</label></div>
  {!data&&!error&&<output>학교 행사 제목과 포스터를 불러오고 있어요…</output>}
  {error&&<p role="alert">{error}</p>}{saveError&&<p role="alert">{saveError}</p>}
  {data&&<><p className="sample-note">{data.mode==='stale'?'연결 지연 · 이전 수집 자료':'최근 수집'} · {new Date(data.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}{data.partial?' · 일부 본문 확인 지연':''}</p>
   {items.length===0&&<p className="sample-note">{onlySaved?'저장한 행사 중 현재 조건에 맞는 항목이 없어요.':onlyFit?'시간까지 확인된 여유 행사가 없어요. 필터를 끄고 원문을 확인해 주세요.':'검색 조건에 맞는 실제 공지가 없어요.'}</p>}
   {items.map(({event,fit})=><EventCard key={event.id} event={event} fit={fit} saved={saved.ids.includes(event.id)} onSave={toggleSave}/>)}</>}
 </section>;
}
