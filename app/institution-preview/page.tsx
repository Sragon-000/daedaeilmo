'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, Building2, Check, CheckCircle2, ChevronRight,
  ClipboardList, Clock3, FileText, ListTodo, RotateCcw, ShieldCheck, UsersRound,
} from 'lucide-react';
import './institution-preview.css';

type View = 'overview' | 'queue';
type Stage = 0 | 1 | 2;

const program = {
  title: '진로 설계 워크숍',
  category: '비교과 프로그램',
  capacity: 30,
  applicants: 34,
};

export default function InstitutionPreviewPage() {
  const [view, setView] = useState<View>('overview');
  const [stage, setStage] = useState<Stage>(0);
  const interacted = useRef(false);
  const cancelAction = useRef<HTMLButtonElement>(null);
  const promoteAction = useRef<HTMLButtonElement>(null);
  const undoAction = useRef<HTMLButtonElement>(null);
  const confirmed = stage === 1 ? 29 : 30;
  const waitlisted = stage === 2 ? 3 : 4;
  const cancelled = stage === 0 ? 0 : 1;
  const vacant = program.capacity - confirmed;
  const pending = stage === 2 ? 0 : 1;

  useEffect(() => {
    if (!interacted.current) { interacted.current = true; return; }
    if (view !== 'queue') return;
    if (stage === 0) cancelAction.current?.focus();
    else if (stage === 1) promoteAction.current?.focus();
    else undoAction.current?.focus();
  }, [stage, view]);

  function moveTo(next: Stage) {
    setStage(next);
  }

  function reset() {
    setStage(0);
    setView('overview');
  }

  return <div className="ip-shell">
    <header className="ip-topbar">
      <Link href="/" className="ip-brand" aria-label="대대일모 홈">대대일모<span>.</span></Link>
      <div className="ip-topbar-right"><span className="ip-demo-badge">가상 데이터 시연</span><Link href="/preview" className="ip-student-link">학생 앱 <ArrowUpRight size={15}/></Link></div>
    </header>

    <div className="ip-layout">
      <aside className="ip-sidebar" aria-label="기관 시연 메뉴">
        <div className="ip-org"><span className="ip-org-icon"><Building2 size={20}/></span><div><strong>기관 운영 시연</strong><small>실제 기관 계정 미연결</small></div></div>
        <div className="ip-side-heading">운영 메뉴</div>
        <nav className="ip-side-nav">
          <button type="button" className={view === 'overview' ? 'active' : ''} aria-current={view === 'overview' ? 'page' : undefined} onClick={() => setView('overview')}><ClipboardList size={18}/> 프로그램 현황 <ChevronRight size={16}/></button>
          <button type="button" className={view === 'queue' ? 'active' : ''} aria-current={view === 'queue' ? 'page' : undefined} onClick={() => setView('queue')}><ListTodo size={18}/> 처리할 일 <span className="ip-nav-count">{pending}</span></button>
        </nav>
        <div className="ip-side-note"><ShieldCheck size={17}/><p>학교 시스템·학생 명단과 연결되지 않은 화면입니다. 변경은 이 브라우저에서만 보입니다.</p></div>
      </aside>

      <main className="ip-main">
        <div className="ip-page-heading"><div><p>INSTITUTION WORKSPACE · CONCEPT PREVIEW</p><h1>프로그램 운영</h1><span>한 프로그램의 현재 상태와 다음 처리할 일을 확인하는 흐름</span></div><button type="button" className="ip-reset" onClick={reset}><RotateCcw size={16}/> 시나리오 다시 시작</button></div>
        <div className="ip-mobile-nav" aria-label="화면 선택"><button type="button" className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}>프로그램 현황</button><button type="button" className={view === 'queue' ? 'active' : ''} onClick={() => setView('queue')}>처리할 일 {pending}</button></div>

        <section className="ip-program-banner" aria-label="시연 프로그램">
          <div><span className="ip-program-type">{program.category} · 예시</span><h2>{program.title}</h2><p>모집 정원 {program.capacity}명 · 신청 {program.applicants}건</p><p>{stage === 0 ? '확정자 1명의 취소 요청이 아직 현황에 반영되지 않았습니다.' : stage === 1 ? '취소가 반영되어 빈자리 1석이 생겼습니다.' : '대기 1순위 충원을 반영해 정원이 다시 채워졌습니다.'}</p></div>
          <div className="ip-program-label"><span>운영 상태</span><strong>선발 후 관리 중</strong></div>
        </section>

        <div className="ip-data-note"><FileText size={18}/><span><strong>시연용 가상 자료</strong> · 수치는 이 화면에 반영된 상태입니다. 취소 요청은 반영 전까지 확정 인원에 포함됩니다. 학교 시스템·연락 발송과 연결되지 않습니다.</span></div>

        {view === 'overview' ? <div className="ip-content-grid">
          <section className="ip-panel ip-focus-panel"><div className="ip-section-title"><div><p>오늘의 작업</p><h2>{pending ? '확인이 필요한 변경이 있어요' : '처리할 변경이 없어요'}</h2></div><span className={pending ? 'ip-count-pill' : 'ip-count-pill done'}>{pending}건 대기</span></div>
            {pending ? <div className="ip-focus-task"><span className="ip-task-symbol">{stage === 0 ? '01' : '02'}</span><div><strong>{stage === 0 ? '취소 요청을 확인하고 상태 반영' : '대기 1순위 충원 결과 반영'}</strong><p>{stage === 0 ? '가상 코드 C-018의 취소를 반영하면 빈자리 1석이 생깁니다.' : '가상 코드 W-031의 충원 결과를 반영하면 정원이 다시 채워집니다.'}</p></div><ChevronRight size={18}/></div> : <div className="ip-empty"><CheckCircle2 size={25}/><span>이 시나리오의 상태 변경 2건을 모두 반영했습니다.</span></div>}
            <button type="button" className="ip-primary" onClick={() => setView('queue')}>{pending ? '처리 흐름 살펴보기' : '완료 내역 보기'} <ArrowRight size={17}/></button>
          </section>

          <section className="ip-panel"><div className="ip-section-title"><div><p>STATUS FLOW</p><h2>한눈에 보는 운영 상태</h2></div></div>
            <div className="ip-flow"><FlowRow label="신청 접수" count={program.applicants} unit="건" detail="가상 신청 건"/><FlowRow label="선발 확정" count={confirmed} unit="명" detail="반영된 현재 상태"/><FlowRow label="빈자리" count={vacant} unit="석" detail="정원에서 확정 인원 제외"/><FlowRow label="대기" count={waitlisted} unit="명" detail="다음 충원 후보"/><FlowRow label="취소" count={cancelled} unit="건" detail="확정 취소 반영"/></div>
            <p className="ip-panel-foot">상태별 수치는 서로 다른 단계입니다. 화면의 변경은 시연 중에만 유지됩니다.</p>
          </section>
        </div> : <div className="ip-content-grid">
          <section className="ip-panel ip-queue-panel"><div className="ip-section-title"><div><p>WORK QUEUE</p><h2>취소 → 대기자 충원</h2></div><span className={pending ? 'ip-count-pill' : 'ip-count-pill done'}>{pending}건 대기</span></div>
            <p className="ip-queue-intro">실제 운영에서는 담당자가 학교의 기존 시스템에서 먼저 처리하고, 그 결과를 이 화면에 반영하는 흐름을 가정했습니다.</p>
            <article className={`ip-action-card ${stage >= 1 ? 'completed' : ''}`}><div className="ip-action-head"><span className="ip-step">01</span><div><span className="ip-action-kicker">취소 요청 · 가상 코드 C-018</span><h3>확정 인원에서 취소 1건 반영</h3></div><span className={`ip-status ${stage >= 1 ? 'done' : ''}`}>{stage >= 1 ? '반영 완료' : '처리 필요'}</span></div><p>담당자가 기존 신청 시스템에서 취소 여부를 확인한 뒤 현황에 반영합니다. 이 시연에는 학생 연락처나 학번이 없습니다.</p><button ref={cancelAction} type="button" className="ip-action-button" disabled={stage !== 0} onClick={() => moveTo(1)}>{stage >= 1 ? <><Check size={17}/> 취소 반영됨</> : <>가상 취소 반영하기 <ArrowRight size={17}/></>}</button></article>
            {stage === 1 && <output className="ip-inline-result"><strong>빈자리 1석 발생</strong><span>확정 29명 · 대기 4명. 아래 대기 1순위 충원 결과를 반영해 보세요.</span></output>}
            <article className={`ip-action-card ${stage === 2 ? 'completed' : ''}`}><div className="ip-action-head"><span className="ip-step">02</span><div><span className="ip-action-kicker">대기 1순위 · 가상 코드 W-031</span><h3>빈자리 1석에 충원 결과 반영</h3></div><span className={`ip-status ${stage === 2 ? 'done' : stage === 0 ? 'locked' : ''}`}>{stage === 2 ? '반영 완료' : stage === 0 ? '앞 단계 대기' : '처리 필요'}</span></div><p>기관이 기존 채널에서 안내·확정을 마친 뒤 그 결과를 반영하는 단계입니다. 이 버튼은 실제 선발이나 발송을 실행하지 않습니다.</p><button ref={promoteAction} type="button" className="ip-action-button" disabled={stage !== 1} onClick={() => moveTo(2)}>{stage === 2 ? <><Check size={17}/> 충원 반영됨</> : <>가상 충원 결과 반영하기 <ArrowRight size={17}/></>}</button></article>
            {stage === 2 && <output className="ip-inline-result"><strong>처리 완료</strong><span>확정 30명 · 빈자리 0석 · 대기 3명. 이 시연의 대기 업무가 끝났습니다.</span></output>}
            {stage > 0 && <button ref={undoAction} type="button" className="ip-undo" onClick={() => moveTo(stage === 2 ? 1 : 0)}><RotateCcw size={16}/> 직전 반영 되돌리기</button>}
          </section>

          <section className="ip-panel ip-ledger"><div className="ip-section-title"><div><p>CHANGE LOG</p><h2>이 시연의 변경 내역</h2></div></div><div className="ip-log-item"><span className="ip-log-dot"/><div><strong>프로그램 상태 불러옴</strong><p>가상 신청 34건 · 확정 30건 · 대기 4건</p></div></div>{stage >= 1 && <div className="ip-log-item"><span className="ip-log-dot"/><div><strong>취소 1건 반영</strong><p>C-018 · 확정 29건 · 빈자리 1석</p></div></div>}{stage === 2 && <div className="ip-log-item"><span className="ip-log-dot"/><div><strong>대기 1순위 충원 반영</strong><p>W-031 · 확정 30건 · 대기 3건</p></div></div>}<p className="ip-panel-foot">브라우저를 새로고침하면 변경 내역은 사라집니다.</p></section>
        </div>}

        <div className="ip-metrics" aria-label="가상 프로그램 현황">
          <Metric label="확정" value={confirmed} icon={<CheckCircle2 size={19}/>} note="반영된 현재 인원" highlight/>
          <Metric label="빈자리" value={vacant} icon={<UsersRound size={19}/>} note={`정원 ${program.capacity}명 기준`}/>
          <Metric label="대기" value={waitlisted} icon={<Clock3 size={19}/>} note="다음 충원 후보"/>
          <Metric label="취소" value={cancelled} icon={<FileText size={19}/>} note="반영된 취소 건"/>
        </div>
        <footer className="ip-footer"><div><strong>현재 연결 범위</strong><p>가상 프로그램 · 가상 코드 · 브라우저 내부 상태만 사용</p></div><Link href="/preview">학생에게 보이는 앱 미리보기 <ArrowUpRight size={16}/></Link></footer>
      </main>
    </div>
  </div>;
}

function Metric({ label, value, icon, note, highlight = false }: { label: string; value: number | string; icon: React.ReactNode; note: string; highlight?: boolean }) {
  return <div className={`ip-metric ${highlight ? 'highlight' : ''}`}><div className="ip-metric-top"><span>{label}</span>{icon}</div><strong>{value}</strong><small>{note}</small></div>;
}

function FlowRow({ label, count, unit, detail }: { label: string; count: number; unit: '건' | '명' | '석'; detail: string }) {
  return <div className="ip-flow-row"><div><span>{label}</span><small>{detail}</small></div><strong>{count}<span>{unit}</span></strong></div>;
}
