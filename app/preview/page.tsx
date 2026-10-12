'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Check, Clock3, GraduationCap, MessageSquare, Search, ShieldCheck, UserRound } from 'lucide-react';
import type { ExperimentEvent } from '@/lib/experiment-catalog';
import SemesterTimetable, { type SemesterCourse } from '../semester-timetable';
import './preview.css';

type Feed = { items: ExperimentEvent[]; asOf: number | null; supplyStatus: 'ready' | 'empty' | 'stale' };
type Tab = 'activities' | 'timetable' | 'reviews' | 'account';
const clock = (value: number) => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
const modeLabel = (item: ExperimentEvent) => item.activityMode === 'flexible' ? '기간 중 참여'
  : item.activityMode === 'series' ? '여러 회차' : item.activityMode === 'single' ? '일시 확정' : '일정 확인 필요';
const sampleCourses: SemesterCourse[] = [
  { id: 'sample-1', name: '예시 수업 1', day: 0, start: 540, end: 660 },
  { id: 'sample-2', name: '예시 수업 2', day: 2, start: 600, end: 720 },
  { id: 'sample-3', name: '예시 수업 3', day: 4, start: 780, end: 900 },
];

export default function PreviewPage() {
  const [tab, setTab] = useState<Tab>('activities');
  const [academicYear, setAcademicYear] = useState(2026);
  const [semester, setSemester] = useState(2);
  const [courses, setCourses] = useState<SemesterCourse[]>(sampleCourses);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [score, setScore] = useState(5);
  const [displayName, setDisplayName] = useState<'nickname' | 'name'>('nickname');
  const [reviewText, setReviewText] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    void fetch('/api/preview/events', { cache: 'no-store', signal: abort.signal })
      .then(async response => {
        if (!response.ok) throw new Error('행사 조회 실패');
        return response.json() as Promise<Feed>;
      })
      .then(data => { if (!abort.signal.aborted) setFeed(data); })
      .catch(() => { if (!abort.signal.aborted) setError('학교 활동을 불러오지 못했어요. 잠시 후 다시 열어 주세요.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, []);

  const items = feed?.items || [];
  const single = items.filter(item => item.activityMode === 'single');
  const flexible = items.filter(item => item.activityMode === 'flexible');
  const remaining = items.filter(item => item.activityMode !== 'single' && item.activityMode !== 'flexible');

  return <div className="pre-shell">
    <header className="pre-header"><span className="pre-brand">대대일모<span>.</span></span><span className="pre-badge">앱 미리보기</span></header>
    <main className="pre-main">
      {tab === 'activities' && <>
        <section className="pre-hero"><p className="pre-eyebrow">배재대학교 · 실제 학교 소식</p><h1>비는 시간을<br/>새로운 기회로.</h1><p>시간표를 직접 입력하고, 학교 활동을 발견해 원문에서 신청 정보를 확인하는 앱입니다.</p><button type="button" onClick={() => setTab('timetable')}>시간표 기능 보기 <ArrowUpRight size={17}/></button></section>
        <div className="pre-flow"><div><CalendarDays size={19}/><b>시간표 입력</b></div><span>→</span><div><Search size={19}/><b>활동 발견</b></div><span>→</span><div><ArrowUpRight size={19}/><b>학교 원문</b></div></div>
        <div className="pre-heading"><div><p>OFFICIAL NOTICE</p><h2>지금 확인된 학교 활동</h2></div><span>{items.length}건</span></div>
        <p className="pre-description">배재대 공식 공지를 운영자가 대조한 항목입니다. 모집 대상과 신청 상태는 원문에서 최종 확인해 주세요.</p>
        {loading && <p className="pre-state">학교 공지를 불러오는 중이에요…</p>}
        {error && <p className="pre-state pre-error" role="alert">{error}</p>}
        {!loading && !error && feed?.supplyStatus === 'stale' && <p className="pre-state">학교 공지 갱신이 지연되고 있어요. 최신 정보는 원문에서 확인해 주세요.</p>}
        {!loading && !error && items.length === 0 && <p className="pre-state">현재 확인된 학교 활동이 없어요. 공지 검수 후 다시 표시됩니다.</p>}
        {single.map(item => <ActivityCard key={item.id} item={item}/>)}
        {flexible.map(item => <ActivityCard key={item.id} item={item}/>)}
        {remaining.map(item => <ActivityCard key={item.id} item={item}/>)}
        {feed?.asOf && <p className="pre-updated">마지막 수집 {new Date(feed.asOf).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>}
        <div className="pre-explainer"><Clock3 size={19}/><div><b>공강 비교는 이렇게 작동해요</b><p>행사 날짜·시작·종료가 모두 확인된 단일 일정만 입력한 시간과 비교합니다. 기간형·복수 회차 활동을 임의로 ‘시간이 맞음’으로 표시하지 않습니다.</p></div></div>
      </>}
      {tab === 'timetable' && <>
        <div className="pre-page-head"><p>01 · MY SCHEDULE</p><span>실제 앱과 같은 입력 화면입니다. 예시 수업을 수정하거나 새 수업을 추가해 보세요.</span></div>
        <div className="pre-schedule-note">예시 시간표 · 이 브라우저에서만 바뀌고 서버에 저장되지 않습니다.</div>
        <div className="pre-schedule-demo"><SemesterTimetable courses={courses} year={academicYear} semester={semester} onTerm={(year, term) => { setAcademicYear(year); setSemester(term); setCourses([]); }} onChanged={async () => {}} onDemoChange={setCourses} authenticated={false} onboarding={false} onFinish={() => {}}/></div>
        <section className="pre-panel"><div className="pre-panel-title"><Clock3 size={21}/><h2>활동과 시간표 비교</h2></div><p className="pre-description">공식 공지에 단일 행사 날짜·시작·종료 시간이 확인되면 등록한 수업과 충돌하는지 비교합니다. 현재 검수된 단일 일정은 {single.length}건이며, 기간형·복수 회차 활동은 임의로 공강에 맞는다고 표시하지 않습니다.</p></section>
        <section className="pre-panel pre-feature"><h2>정식 앱의 시간표 기능</h2><div><Check size={17}/> 학기별 수업 이름·요일·시간 직접 등록</div><div><Check size={17}/> 언제든 수업 수정·삭제</div><div><Check size={17}/> 행사 날짜와 수업 충돌·이동 여유 비교</div><p>학교 사이트에서 시간표를 자동으로 가져오지 않습니다.</p></section>
      </>}
      {tab === 'reviews' && <>
        <div className="pre-page-head"><p>02 · CAMPUS REVIEWS</p><h1>공간 리뷰</h1><span>학교 안의 공간을 경험한 학생이 평가와 후기를 나누도록 설계한 기능입니다.</span></div>
        <section className="pre-panel"><div className="pre-panel-title"><MessageSquare size={21}/><h2>계획 중인 작성 화면</h2></div><p className="pre-description">공간 목록 연결 전이라 현재 앱에서는 리뷰를 게시할 수 없습니다. 아래 입력은 화면 시연용이며 저장되지 않습니다.</p>
          <div className="pre-review-field"><b>별점</b><fieldset className="pre-stars" aria-label="별점 선택">{[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={value + '점'} aria-pressed={score === value} onClick={() => setScore(value)} className={value <= score ? 'active' : ''}>★</button>)}</fieldset></div>
          <div className="pre-review-field"><b>표시 이름</b><div className="pre-choice"><button type="button" className={displayName === 'nickname' ? 'active' : ''} aria-pressed={displayName === 'nickname'} onClick={() => setDisplayName('nickname')}>닉네임</button><button type="button" className={displayName === 'name' ? 'active' : ''} aria-pressed={displayName === 'name'} onClick={() => setDisplayName('name')}>실명</button></div></div>
          <label className="pre-review-field"><b>이용 후기</b><textarea value={reviewText} onChange={event => setReviewText(event.target.value)} maxLength={500} placeholder="공간에서 느낀 점을 적는 자리입니다."/></label>
          <div className="pre-review-note">{score}점 · {displayName === 'nickname' ? '닉네임' : '실명'}으로 표시 · {reviewText.length}/500자</div><button type="button" className="pre-disabled-action" disabled>공간 정보 연결 후 제공 예정</button>
        </section>
      </>}
      {tab === 'account' && <>
        <div className="pre-page-head"><p>03 · SCHOOL ACCOUNT</p><h1>학교 인증과 프로필</h1><span>실제 앱은 배재대 계정으로 로그인할 수 있는 사용자를 확인합니다.</span></div>
        <section className="pre-panel pre-account"><ShieldCheck size={34}/><h2>학교 로그인 확인</h2><p>학교 계정 확인 후 회원 프로필을 설정하고 시간표와 리뷰를 이용합니다. 미리보기에서는 학번이나 비밀번호를 입력받지 않아요.</p></section>
        <section className="pre-panel pre-feature"><div className="pre-panel-title"><UserRound size={20}/><h2>프로필 설정</h2></div><div><Check size={17}/> 실제 이름과 자유로운 닉네임 분리</div><div><Check size={17}/> 사진 업로드 또는 기본 아바타</div><div><Check size={17}/> 리뷰 작성 시 표시 이름 선택</div></section>
        <Link className="pre-login-link" href="/">배재대 계정으로 실제 앱 열기 <ArrowUpRight size={17}/></Link>
      </>}
    </main>
    <nav className="pre-nav" aria-label="앱 미리보기 메뉴">{[
      { id: 'activities' as Tab, label: '활동', icon: Search }, { id: 'timetable' as Tab, label: '시간표', icon: CalendarDays },
      { id: 'reviews' as Tab, label: '리뷰', icon: MessageSquare }, { id: 'account' as Tab, label: '내 정보', icon: GraduationCap },
    ].map(item => <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} aria-current={tab === item.id ? 'page' : undefined} onClick={() => { setTab(item.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><item.icon size={20}/><span>{item.label}</span></button>)}</nav>
  </div>;
}

function ActivityCard({ item }: { item: ExperimentEvent }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const date = item.date ? item.date + (item.start !== null && item.end !== null ? ' · ' + clock(item.start) + '–' + clock(item.end) : '') : item.schedule || '일정은 원문 확인 필요';
  return <article className="pre-card">
    {item.posterUrl && !posterFailed && <div className="pre-poster"><Image unoptimized src={item.posterUrl} width={800} height={500} alt={item.title + ' 포스터'} loading="lazy" referrerPolicy="no-referrer" onError={() => setPosterFailed(true)}/></div>}
    <div className="pre-card-body"><div className="pre-card-meta"><span>{item.category}</span><b>{modeLabel(item)}</b></div><h3>{item.title}</h3><p>{date}</p>{item.place && <p>장소 · {item.place}</p>}{item.audience && <p>대상 · {item.audience}</p>}<a href={item.officialUrl} target="_blank" rel="noopener noreferrer">배재대 공식 공지 보기 <ArrowUpRight size={17}/></a></div>
  </article>;
}
