'use client';
import { useState, type SyntheticEvent } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export type SemesterCourse = { id: string | number; name: string; day: number; start: number; end: number };
const days = ['월','화','수','목','금'];
const time = (m: number) => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
export default function SemesterTimetable({ courses, year, semester, onTerm, onChanged, onDemoChange, authenticated, onboarding, onFinish }: {
  courses: SemesterCourse[]; year: number; semester: number; onTerm: (year: number, semester: number) => void; onChanged: () => Promise<void>;
  onDemoChange: (courses: SemesterCourse[]) => void; authenticated: boolean; onboarding: boolean; onFinish: () => void;
}) {
  const [open,setOpen] = useState(false), [editing,setEditing] = useState<SemesterCourse | null>(null), [name,setName] = useState(''), [day,setDay] = useState(0), [start,setStart] = useState('09:00'), [end,setEnd] = useState('10:00'), [message,setMessage] = useState(''), [pending,setPending] = useState(false);
  function edit(course: SemesterCourse | null) { setEditing(course); setName(course?.name || ''); setDay(course?.day || 0); setStart(time(course?.start ?? 540)); setEnd(time(course?.end ?? 600)); setMessage(''); setOpen(true); }
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); const minutes = (s: string) => Number(s.split(':')[0])*60+Number(s.split(':')[1]);
    const s = minutes(start), e = minutes(end);
    if (!name.trim() || s < 540 || e > 1080 || e <= s) { setMessage('09:00–18:00 사이의 시작·종료 시간을 확인해 주세요.'); return; }
    if (courses.some(c => c.id !== editing?.id && c.day === day && s < c.end && e > c.start)) { setMessage('다른 수업과 시간이 겹쳐요.'); return; }
    setMessage('');
    if (!authenticated) { onDemoChange([...courses.filter(c => c.id !== editing?.id), { id: editing?.id ?? Date.now(), name: name.trim(), day, start:s, end:e }]); setOpen(false); return; }
    setPending(true);
    try {
      const r = await fetch('/api/timetable', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:editing?.id, year, semester, name, day, start:s, end:e }) });
      const result = await r.json() as {message?:string}; if (!r.ok) throw new Error(result.message || '저장하지 못했어요.');
      await onChanged(); setOpen(false);
    } catch(error) { setMessage(error instanceof Error ? error.message : '저장하지 못했어요.'); } finally { setPending(false); }
  }
  async function remove(course: SemesterCourse) {
    if (!authenticated) { onDemoChange(courses.filter(c => c.id !== course.id)); return; }
    setPending(true); try { const r = await fetch('/api/timetable?id='+encodeURIComponent(course.id),{method:'DELETE'}); if(!r.ok) throw new Error(); await onChanged(); }
    catch { setMessage('수업을 삭제하지 못했어요.'); } finally { setPending(false); }
  }
  return <>
    {onboarding && <div className="onboarding-note"><b>마지막으로, 이번 학기 시간표를 넣어 주세요.</b><p>나중에도 설정에서 학기와 수업을 수정할 수 있어요.</p></div>}
    <div className="page-heading inline"><div><p className="date-label">{authenticated ? '학기별로 저장되는 내 시간표' : '직접 입력 체험 · 데모'}</p><h1>내 시간표</h1></div><button className="primary compact" onClick={() => edit(null)}><Plus size={17}/> 수업 추가</button></div>
    <div className="semester-selector"><label>학년도<select value={year} onChange={e => onTerm(Number(e.target.value),semester)}>{Array.from({length:11},(_,i)=>new Date().getFullYear()-5+i).map(y=><option key={y} value={y}>{y}년</option>)}</select></label><label>학기<select value={semester} onChange={e=>onTerm(year,Number(e.target.value))}><option value={1}>1학기</option><option value={2}>2학기</option></select></label></div>
    <div className="timetable"><div className="table-head"><span/>{days.map(d=><b key={d}>{d}</b>)}</div><div className="table-body"><div className="time-column">{Array.from({length:9},(_,i)=><span key={i}>{i+9}</span>)}</div>{days.map((d,index)=><div className="day-column" key={d}>{courses.filter(c=>c.day===index).map((c,i)=><button key={c.id} className={`course-block ${['blue','lime','pink'][i%3]}`} style={{top:`${((c.start-540)/540)*100}%`,height:`${((c.end-c.start)/540)*100}%`}} onClick={()=>edit(c)} aria-label={`${c.name} 수정`}><b>{c.name}</b><small>{time(c.start)}<br/>–{time(c.end)}</small></button>)}</div>)}</div></div>
    {!courses.length && <p className="sample-note">{year}년 {semester}학기 시간표가 비어 있어요. 수업을 직접 추가해 주세요.</p>}
    <div className="semester-course-list">{courses.map(c=><div key={c.id}><span><b>{c.name}</b><small>{days[c.day]} {time(c.start)}–{time(c.end)}</small></span><button aria-label={`${c.name} 수정`} onClick={()=>edit(c)} disabled={pending}><Pencil size={17}/></button><button aria-label={`${c.name} 삭제`} onClick={()=>void remove(c)} disabled={pending}><Trash2 size={17}/></button></div>)}</div>
    {message && !open && <output className="auth-message">{message}</output>}
    {onboarding && <button className="primary full" onClick={onFinish}>{courses.length ? '시간표 저장 완료 · 시작하기' : '나중에 입력하고 시작하기'}</button>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>{editing ? '수업 수정' : '수업 추가'}</DialogTitle><DialogDescription>{year}년 {semester}학기 · 직접 입력</DialogDescription><form onSubmit={save} className="course-form"><label>수업 이름<input value={name} onChange={e=>setName(e.target.value)} maxLength={30} required disabled={pending}/></label><label>요일<select value={day} onChange={e=>setDay(Number(e.target.value))} disabled={pending}>{days.map((d,i)=><option key={d} value={i}>{d}요일</option>)}</select></label><div className="time-fields"><label>시작<input type="time" value={start} onChange={e=>setStart(e.target.value)} min="09:00" max="18:00" required disabled={pending}/></label><label>종료<input type="time" value={end} onChange={e=>setEnd(e.target.value)} min="09:00" max="18:00" required disabled={pending}/></label></div>{message && <output className="auth-message">{message}</output>}<button className="primary full" disabled={pending}>{pending ? '저장 중…' : '수업 저장'}</button></form></DialogContent></Dialog>
  </>;
}
