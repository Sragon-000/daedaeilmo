'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import type { Notice, School } from '@/lib/school-notices';
import { sources } from '@/lib/school-notices';
export function SchoolNotices({ school }: { school: School }) {
  const [state, setState] = useState<{
    items: Notice[];
    loading: boolean;
    error: string;
    fetchedAt: string;
    warning?: string;
  }>({ items: [], loading: true, error: '', fetchedAt: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/notices?school=${school}`, { signal: abort.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          items: Notice[];
          fetchedAt: string;
          warning?: string;
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || '학교 공지를 가져오지 못했어요.');
        if (!abort.signal.aborted)
          setState({
            items: data.items,
            loading: false,
            error: '',
            fetchedAt: data.fetchedAt,
            warning: data.warning,
          });
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setState({
            items: [],
            loading: false,
            error: error instanceof Error ? error.message : '연결 오류',
            fetchedAt: '',
          });
      });
    return () => abort.abort();
  }, [school, attempt]);
  return (
    <section className="live-notices">
      <div className="section-heading">
        <h2>
          학교에서 온 소식 <span className="live-label">실제 공지</span>
        </h2>
        <button
          aria-label="학교 공지 새로고침"
          disabled={state.loading}
          onClick={() => {
            setState({ items: [], loading: true, error: '', fetchedAt: '' });
            setAttempt((n) => n + 1);
          }}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <p className="section-caption">
        {school === 'pcu' ? '배재대학교 일반공지' : '계명대학교 학사공지'} ·
        학교 원문에서 가져왔어요
      </p>
      {state.loading ? (
        <output className="notice-loading" aria-live="polite">
          학교 공지를 불러오는 중이에요…
        </output>
      ) : state.error ? (
        <div className="notice-error">
          <p>{state.error}</p>
          <a href={sources[school]} target="_blank" rel="noopener noreferrer">
            학교 게시판 열기 ↗
          </a>
        </div>
      ) : (
        <div className="notice-list">
          {state.items.slice(0, 8).map((item) => (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              key={item.id}
            >
              <span>{item.title}</span>
              <ArrowUpRight size={17} />
            </a>
          ))}
        </div>
      )}
      {state.warning && <p className="notice-warning">{state.warning}</p>}
      {state.fetchedAt && (
        <p className="sample-note">
          확인{' '}
          {new Date(state.fetchedAt).toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
          })}{' '}
          · 원문 기준
        </p>
      )}
    </section>
  );
}
