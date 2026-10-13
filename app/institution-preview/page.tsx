'use client';

import { useState } from 'react';
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
  const [announcement, setAnnouncement] = useState('');
  const confirmed = stage === 1 ? 29 : 30;
  const waitlisted = stage === 2 ? 3 : 4;
  const cancelled = stage === 0 ? 0 : 1;
  const pending = stage === 2 ? 0 : 1;

  function moveTo(next: Stage) {
    setStage(next);
    setAnnouncement(next === 1
      ? '가상 취소 건을 반영했습니다. 이제 대기 1순위 충원을 확인해 보세요.'
      : '가상 충원 건을 반영했습니다. 이 시연의 처리할 일이 모두 끝났습니다.');
  }

  function reset() {
    setStage(0);
    setView('overview');
    setAnnouncement('가상 시나리오를 처음 상태로 되돌렸습니다.');
  }

  return <div className="ip-shell">
    <header className="ip-topbar">
      <Link href="/" className="ip-brand" aria-label="대대일모 홈">대대일모<span>.</span></Link>
      <div className="ip-topbar-right"><span className="ip-demo-badge">가상 데이터 시연</span><Link href="/preview" className="ip-student-link">학생 앱 보기 <ArrowUpRight size={15}/></Link></div>
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
          <div><span className="ip-program-type">{program.category} · 예시</span><h2>{program.title}</h2><p>신청과 선발이 끝난 뒤 취소 요청 1건이 들어온 상황을 가정합니다.</p></div>
          <div className="ip-program-label"><span>운영 상태</span><strong>선발 후 관리 중</strong></div>
        </section>

        <div className="ip-data-note"><FileText size={18}/><span><strong>시연용 가상 자료</strong> · 아래 인원과 처리 코드는 실제 학교 기록이 아닙니다. 학교 신청 시스템에 저장되거나 연락이 발송되지 않습니다.</span></div>

        <div className="ip-metrics" aria-label="가상 프로그램 현황">
          <Metric label="모집 정원" value={program.capacity} icon={<UsersRound size={19}/>} note="프로그램 기준"/>
          <Metric label="신청" value={program.applicants} icon={<FileText size={19}/>} note="고유 신청 건"/>
          <Metric label="확정" value={confirmed} icon={<CheckCircle2 size={19}/>} note={stage === 1 ? '취소 반영 후' : '현재 확정 인원'} highlight/>
          <Metric label="대기 · 취소" value={`${waitlisted} · ${cancelled}`} icon={<Clock3 size={19}/>} note="서로 다른 상태"/>
        </div>

        {view === 'overview' ? <div className="ip-content-grid">
          <section className="ip-panel ip-focus-panel"><div className="ip-section-title"><div><p>오늘의 작업</p><h2>{pending ? '확인이 필요한 변경이 있어요' : '처리할 변경이 없어요'}</h2></div><span className={pending ? 'ip-count-pill' : 'ip-count-pill done'}>{pending}건 대기</span></div>
            {pending ? <div className="ip-focus-task"><span className="ip-task-symbol">{stage === 0 ? '01' : '02'}</span><div><strong>{stage === 0 ? '취소 요청을 확인하고 상태 반영' : '대기 1순위 충원 결과 반영'}</strong><p>{stage === 0 ? '가상 코드 C-018의 취소를 반영하면 빈자리 1석이 생깁니다.' : '가상 코드 W-031의 충원 결과를 반영하면 정원이 다시 채워집니다.'}</p></div><ChevronRight size={18}/></div> : <div className="ip-empty"><CheckCircle2 size={25}/><span>이 시나리오의 상태 변경 2건을 모두 반영했습니다.</span></div>}
            <button type="button" className="ip-primary" onClick={() => setView('queue')}>{pending ? '처리 흐름 살펴보기' : '완료 내역 보기'} <ArrowRight size={17}/></button>
          </section>

          <section className="ip-panel"><div className="ip-section-title"><div><p>STATUS FLOW</p><h2>한눈에 보는 운영 상태</h2></div></div>
            <div className="ip-flow"><FlowRow label="신청 접수" count={program.applicants} detail="가상 신청 건"/><FlowRow label="선발 확정" count={confirmed} detail="취소·충원에 따라 변경"/><FlowRow label="대기" count={waitlisted} detail="다음 충원 후보"/><FlowRow label="취소" count={cancelled} detail="확정 취소 반영"/></div>
            <p className="ip-panel-foot">상태별 수치는 서로 다른 단계입니다. 화면의 변경은 시연 중에만 유지됩니다.</p>
          </section>
        </div> : <div className="ip-content-grid">
          <section className="ip-panel ip-queue-panel"><div className="ip-section-title"><div><p>WORK QUEUE</p><h2>취소 → 대기자 충원</h2></div><span className={pending ? 'ip-count-pill' : 'ip-count-pill done'}>{pending}건 대기</span></div>
            <p className="ip-queue-intro">실제 운영에서는 담당자가 학교의 기존 시스템에서 먼저 처리하고, 그 결과를 이 화면에 반영하는 흐름을 가정했습니다.</p>
            <article className={`ip-action-card ${stage >= 1 ? 'completed' : ''}`}><div className="ip-action-head"><span className="ip-step">01</span><div><span className="ip-action-kicker">취소 요청 · 가상 코드 C-018</span><h3>확정 인원에서 취소 1건 반영</h3></div><span className={`ip-status ${stage >= 1 ? 'done' : ''}`}>{stage >= 1 ? '반영 완료' : '처리 필요'}</span></div><p>담당자가 기존 신청 시스템에서 취소 여부를 확인한 뒤 현황에 반영합니다. 이 시연에는 학생 연락처나 학번이 없습니다.</p><button type="button" className="ip-action-button" disabled={stage !== 0} onClick={() => moveTo(1)}>{stage >= 1 ? <><Check size={17}/> 취소 반영됨</> : <>가상 취소 반영하기 <ArrowRight size={17}/></>}</button></article>
            <article className={`ip-action-card ${stage === 2 ? 'completed' : ''}`}><div className="ip-action-head"><span className="ip-step">02</span><div><span className="ip-action-kicker">대기 1순위 · 가상 코드 W-031</span><h3>빈자리 1석에 충원 결과 반영</h3></div><span className={`ip-status ${stage === 2 ? 'done' : stage === 0 ? 'locked' : ''}`}>{stage === 2 ? '반영 완료' : stage === 0 ? '앞 단계 대기' : '처리 필요'}</span></div><p>기관이 기존 채널에서 안내·확정을 마친 뒤 그 결과를 반영하는 단계입니다. 이 버튼은 실제 선발이나 발송을 실행하지 않습니다.</p><button type="button" className="ip-action-button" disabled={stage !== 1} onClick={() => moveTo(2)}>{stage === 2 ? <><Check size={17}/> 충원 반영됨</> : <>가상 충원 결과 반영하기 <ArrowRight size={17}/></>}</button></article>
          </section>

          <section className="ip-panel ip-ledger"><div className="ip-section-title"><div><p>CHANGE LOG</p><h2>이 시연의 변경 내역</h2></div></div><div className="ip-log-item"><span className="ip-log-dot"/><div><strong>프로그램 상태 불러옴</strong><p>가상 신청 34건 · 확정 30건 · 대기 4건</p></div></div>{stage >= 1 && <div className="ip-log-item"><span className="ip-log-dot"/><div><strong>취소 1건 반영</strong><p>C-018 · 확정 29건 · 빈자리 1석</p></div></div>}{stage === 2 && <div className="ip-log-item"><span className="ip-log-dot"/><div><strong>대기 1순위 충원 반영</strong><p>W-031 · 확정 30건 · 대기 3건</p></div></div>}<p className="ip-panel-foot">브라우저를 새로고침하면 변경 내역은 사라집니다.</p></section>
        </div>}

        {announcement && <output className="ip-announcement">{announcement}</output>}
        <footer className="ip-footer"><div><strong>현재 연결 범위</strong><p>가상 프로그램 · 가상 코드 · 브라우저 내부 상태만 사용</p></div><Link href="/preview">학생에게 보이는 앱 미리보기 <ArrowUpRight size={16}/></Link></footer>
      </main>
    </div>
  </div>;
}

function Metric({ label, value, icon, note, highlight = false }: { label: string; value: number | string; icon: React.ReactNode; note: string; highlight?: boolean }) {
  return <div className={`ip-metric ${highlight ? 'highlight' : ''}`}><div className="ip-metric-top"><span>{label}</span>{icon}</div><strong>{value}</strong><small>{note}</small></div>;
}

function FlowRow({ label, count, detail }: { label: string; count: number; detail: string }) {
  return <div className="ip-flow-row"><div><span>{label}</span><small>{detail}</small></div><strong>{count}<span>건</span></strong></div>;
}
