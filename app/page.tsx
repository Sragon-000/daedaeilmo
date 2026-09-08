'use client';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  Clock3,
  GraduationCap,
  Home,
  LibraryBig,
  LogOut,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useDemoTools } from './use-demo-tools';
import { SchoolNotices } from './school-notices';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
type School = 'pcu' | 'kmu';
type Course = {
  id: number;
  name: string;
  day: number;
  start: number;
  end: number;
};
type Activity = {
  id: number;
  title: string;
  kind: string;
  day: number;
  start: number;
  end: number;
  place: string;
  deadline: string;
  description: string;
  color: string;
};
type Review = {
  id: number;
  school: School;
  place: number;
  author: string;
  score: number;
  text: string;
  mine?: boolean;
};
const schools = { pcu: '배재대학교', kmu: '계명대학교' },
  days = ['월', '화', '수', '목', '금'];
const time = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const initialCourses: Course[] = [
  { id: 1, name: '디자인 사고', day: 0, start: 540, end: 630 },
  { id: 2, name: '웹 프로그래밍', day: 1, start: 540, end: 660 },
  { id: 3, name: '글로벌 리빙랩', day: 1, start: 840, end: 960 },
  { id: 4, name: '교양 영어', day: 2, start: 600, end: 720 },
  { id: 5, name: '자료 구조', day: 3, start: 540, end: 660 },
  { id: 6, name: '창업과 진로', day: 3, start: 840, end: 930 },
  { id: 7, name: '프로젝트 실습', day: 4, start: 600, end: 720 },
];
const activities: Activity[] = [
  {
    id: 1,
    title: '생각을 꺼내는 디자인 씽킹',
    kind: '교내 프로그램',
    day: 1,
    start: 690,
    end: 780,
    place: '학생회관 세미나실',
    deadline: '9월 8일 11:00',
    description:
      '일상 속 작은 불편을 발견하고, 함께 해결 아이디어를 만드는 90분 워크숍이에요. 준비물 없이 가볍게 참여하세요.',
    color: 'lime',
  },
  {
    id: 2,
    title: '한 시간, 나만의 포트폴리오',
    kind: '진로·취업',
    day: 1,
    start: 750,
    end: 810,
    place: '취업지원센터',
    deadline: '9월 8일 12:00',
    description:
      '내 경험을 한 장으로 정리해보세요. 포트폴리오 구성과 프로젝트 소개 방법을 연습하는 입문 특강입니다.',
    color: 'blue',
  },
  {
    id: 3,
    title: '캠퍼스 아이디어 챌린지',
    kind: '공모전',
    day: 4,
    start: 0,
    end: 0,
    place: '온라인 접수',
    deadline: '9월 11일 18:00',
    description:
      '더 나은 캠퍼스를 위한 아이디어를 제안해보세요. 공모전은 행사 시간이 아닌 신청 마감 기준으로 관리해요.',
    color: 'orange',
  },
  {
    id: 4,
    title: '선배와 함께하는 커리어 토크',
    kind: '진로·취업',
    day: 1,
    start: 870,
    end: 930,
    place: '학생회관 강당',
    deadline: '9월 8일 14:00',
    description:
      '다양한 분야에서 일하는 선배들에게 진로와 첫 취업에 관한 이야기를 들어보세요.',
    color: 'pink',
  },
  {
    id: 5,
    title: '점심시간 영어 대화 모임',
    kind: '교내 프로그램',
    day: 3,
    start: 720,
    end: 780,
    place: '글로벌 라운지',
    deadline: '9월 10일 11:00',
    description: '가벼운 주제로 대화하며 영어를 연습하는 소규모 모임입니다.',
    color: 'blue',
  },
  {
    id: 6,
    title: '성장 응원 장학금',
    kind: '장학금',
    day: 4,
    start: 0,
    end: 0,
    place: '온라인 접수',
    deadline: '9월 18일 17:00',
    description:
      '학습 계획과 성장 경험을 제출하는 장학 프로그램입니다. 세부 지원 조건은 원문 확인이 필요해요.',
    color: 'lime',
  },
];
const places = [
  {
    id: 1,
    name: '도서관 집중 열람실',
    sub: '중앙도서관 2층',
    tags: ['조용한 공간', '개인 공부'],
    hours: '09:00–22:00',
    color: 'blue',
    icon: LibraryBig,
  },
  {
    id: 2,
    name: '캠퍼스 스터디 라운지',
    sub: '학생회관 1층',
    tags: ['대화 가능', '팀 프로젝트'],
    hours: '09:00–20:00',
    color: 'lime',
    icon: MessageSquare,
  },
  {
    id: 3,
    name: '창가 리딩룸',
    sub: '중앙도서관 3층',
    tags: ['콘센트', '독서'],
    hours: '09:00–18:00',
    color: 'orange',
    icon: GraduationCap,
  },
];
const seedReviews: Review[] = (['pcu', 'kmu'] as School[]).flatMap(
  (school, i) => [
    {
      id: i * 10 + 1,
      school,
      place: 1,
      author: '책갈피',
      score: 5,
      text: '수업 사이에 집중하기 좋아요. 창가 쪽은 오후에 햇빛이 잘 들어옵니다.',
    },
    {
      id: i * 10 + 2,
      school,
      place: 1,
      author: '공강수집가',
      score: 4,
      text: '노트북은 지정 좌석을 이용하면 편해요. 시험 기간에는 일찍 가는 편이에요.',
    },
    {
      id: i * 10 + 3,
      school,
      place: 2,
      author: '팀플메이트',
      score: 4,
      text: '팀원들과 이야기하며 작업하기 편한 공간이에요.',
    },
  ],
);
function available(a: Activity, courses: Course[]) {
  return (
    a.start === 0 ||
    !courses.some(
      (c) => c.day === a.day && a.start - 10 < c.end && a.end + 10 > c.start,
    )
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <CalendarDays size={23} />
      </span>
      대대일모<span className="brand-dot">.</span>
    </div>
  );
}
function Choice({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  items: string[][];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v !== null && onChange(v)}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map(([v, t]) => (
          <SelectItem key={v} value={v}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function Page() {
  const [school, setSchool] = useState<School>('pcu'),
    [entered, setEntered] = useState(false),
    [tab, setTab] = useState('home'),
    [day, setDay] = useState(1);
  const [courses, setCourses] = useState<Course[]>(initialCourses),
    [saved, setSaved] = useState<number[]>([]),
    [detail, setDetail] = useState<Activity | null>(null),
    [place, setPlace] = useState<number | null>(null);
  const [reviews, setReviews] = useState<Review[]>(seedReviews),
    [blocked, setBlocked] = useState<string[]>([]),
    [reviewText, setReviewText] = useState(''),
    [score, setScore] = useState('5');
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('전체'),
    [onlyFit, setOnlyFit] = useState(true),
    [notice, setNotice] = useState('');
  const [courseOpen, setCourseOpen] = useState(false),
    [courseName, setCourseName] = useState(''),
    [courseDay, setCourseDay] = useState('1'),
    [start, setStart] = useState('11:00'),
    [end, setEnd] = useState('12:00'),
    [error, setError] = useState('');
  const [notify, setNotify] = useState(false),
    [notificationOpen, setNotificationOpen] = useState(false);
  const dayCourses = courses
    .filter((c) => c.day === day)
    .sort((a, b) => a.start - b.start);
  const gaps = dayCourses
    .slice(0, -1)
    .flatMap((c, i) =>
      dayCourses[i + 1].start > c.end
        ? [{ start: c.end, end: dayCourses[i + 1].start }]
        : [],
    );
  const totalGap = gaps.reduce((n, g) => n + g.end - g.start, 0);
  const homeActivities = activities.filter(
    (a) =>
      a.start > 0 &&
      a.day === day &&
      available(a, courses) &&
      gaps.some((g) => a.start - 10 >= g.start && a.end + 10 <= g.end),
  );
  const visible = activities.filter(
    (a) =>
      (filter === '전체' || a.kind === filter) &&
      (!onlyFit || available(a, courses)) &&
      a.title.includes(query.trim()),
  );
  const currentPlace = places.find((p) => p.id === place);
  const shownReviews = reviews.filter(
    (r) =>
      r.school === school &&
      r.place === place &&
      !blocked.includes(`${school}:${r.author}`),
  );
  useDemoTools({
    entered,
    school,
    saved,
    activities: activities.map((a) => ({
      id: a.id,
      title: a.title,
      fits: available(a, courses),
    })),
    save: (id) =>
      setSaved((prev) => (prev.includes(id) ? prev : [...prev, id])),
  });
  function logout() {
    setEntered(false);
    setSaved([]);
    setNotify(false);
    setNotice('');
    setCourses(initialCourses);
  }
  function toggleSave(id: number) {
    setSaved((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    );
    setNotice(
      saved.includes(id)
        ? '저장한 일정에서 삭제했어요.'
        : '내 일정에 저장했어요.',
    );
  }
  function addCourse(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const mins = (s: string) =>
      Number(s.split(':')[0]) * 60 + Number(s.split(':')[1]);
    const s = mins(start),
      t = mins(end),
      d = Number(courseDay);
    if (!courseName.trim() || t <= s || s < 540 || t > 1080) {
      setError('수업 이름과 09:00–18:00 사이의 올바른 시간을 입력해주세요.');
      return;
    }
    if (courses.some((c) => c.day === d && s < c.end && t > c.start)) {
      setError('이미 등록한 수업과 시간이 겹쳐요.');
      return;
    }
    setCourses((prev) => [
      ...prev,
      { id: Date.now(), name: courseName.trim(), day: d, start: s, end: t },
    ]);
    setCourseOpen(false);
    setCourseName('');
    setError('');
    setNotice('시간표와 공강 추천을 업데이트했어요.');
  }
  function addReview(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!entered || !place || reviewText.trim().length < 5) return;
    setReviews((prev) => [
      ...prev.filter(
        (r) => !(r.school === school && r.place === place && r.mine),
      ),
      {
        id: Date.now(),
        school,
        place,
        author: '나',
        score: Number(score),
        text: reviewText.trim(),
        mine: true,
      },
    ]);
    setReviewText('');
    setNotice('내 리뷰를 저장했어요.');
  }
  function card(a: Activity) {
    return (
      <article className="activity-card" key={a.id}>
        <button
          className={`activity-symbol ${a.color}`}
          aria-label={`${a.title} 상세 보기`}
          onClick={() => setDetail(a)}
        >
          {a.start ? <Sparkles size={25} /> : <GraduationCap size={25} />}
        </button>
        <button className="activity-body" onClick={() => setDetail(a)}>
          <span className="eyebrow">
            {a.kind}
            <span
              className={
                a.start ? (available(a, courses) ? 'fit' : 'conflict') : 'muted'
              }
            >
              {a.start
                ? available(a, courses)
                  ? '시간표 겹침 없음'
                  : '수업과 겹쳐요'
                : '마감 일정'}
            </span>
          </span>
          <h3>{a.title}</h3>
          <p>
            {a.start
              ? `9.${7 + a.day} (${days[a.day]}) · ${time(a.start)}–${time(a.end)}`
              : `마감 ${a.deadline}`}
          </p>
        </button>
        <button
          className={`icon-button save ${saved.includes(a.id) ? 'is-saved' : ''}`}
          aria-label={`${a.title} ${saved.includes(a.id) ? '저장 취소' : '저장'}`}
          aria-pressed={saved.includes(a.id)}
          onClick={() => toggleSave(a.id)}
        >
          <Bookmark
            size={21}
            fill={saved.includes(a.id) ? 'currentColor' : 'none'}
          />
        </button>
      </article>
    );
  }
  if (!entered)
    return (
      <main className="welcome mobile-welcome">
        <header className="welcome-header">
          <Brand />
          <span className="demo-label">프로토타입</span>
        </header>
        <section className="welcome-intro">
          <span className="intro-eyebrow">수업 사이, 새로운 발견</span>
          <h1>
            내 공강을
            <br />더 나답게.
          </h1>
          <div className="intro-time">
            <Clock3 size={22} />
            <span>공강 3시간</span>
            <ArrowRight size={20} />
            <b>새로운 기회</b>
          </div>
        </section>
        <section className="welcome-form">
          <h2>어느 학교에 다니세요?</h2>
          <p className="muted">우리 학교의 일정과 공간을 만나보세요.</p>
          <div className="school-options">
            {(['pcu', 'kmu'] as School[]).map((s) => (
              <button
                key={s}
                className={`school-option ${school === s ? 'selected' : ''}`}
                aria-pressed={school === s}
                onClick={() => setSchool(s)}
              >
                <span className="school-letter">{s === 'pcu' ? 'P' : 'K'}</span>
                <span>
                  <b>{schools[s]}</b>
                  <small>
                    {s === 'pcu' ? '대전 · 도마동' : '대구 · 성서캠퍼스'}
                  </small>
                </span>
                <span className="radio-mark">
                  {school === s && <Check size={14} />}
                </span>
              </button>
            ))}
          </div>
          <button className="primary full" disabled>
            학교 계정으로 로그인 · 연결 준비 중
          </button>
          <p className="auth-explanation">
            <ShieldCheck size={16} />
            학교 로그인 성공 여부로 이용 자격을 확인할 예정이에요.
            <br />
            현재 학교 계정 인증은 사용할 수 없습니다.
          </p>
          <button
            className="demo-entry full"
            onClick={() => {
              setEntered(true);
              setTab('home');
            }}
          >
            데모 먼저 둘러보기 <ArrowRight size={17} />
          </button>
          <p className="demo-foot">
            실제 공개 공지와 예시 활동을 둘러볼 수 있어요.
            <br />
            데모 입장은 학교 인증이 아니며, 비밀번호를 받지 않습니다.
          </p>
        </section>
      </main>
    );
  return (
    <div className="app-shell">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(String(v));
          setNotice('');
        }}
        className="app-tabs"
      >
        <TabsList className="main-nav" aria-label="주요 메뉴">
          {[
            { id: 'home', label: '홈', icon: Home },
            { id: 'discover', label: '활동 찾기', icon: Search },
            { id: 'schedule', label: '내 시간표', icon: CalendarDays },
            { id: 'spaces', label: '공간 리뷰', icon: MessageSquare },
            { id: 'saved', label: '저장', icon: Bookmark },
          ].map((n) => (
            <TabsTrigger key={n.id} value={n.id}>
              <n.icon size={21} />
              <span>{n.label}</span>
              {n.id === 'saved' && saved.length > 0 && <i>{saved.length}</i>}
            </TabsTrigger>
          ))}
        </TabsList>
        <main className="app-main">
          <header className="topbar">
            <div className="school-label">
              <GraduationCap size={19} />
              <b>{schools[school]}</b>
              <span className="demo-label">데모</span>
            </div>
            <div className="header-actions">
              <button
                className="mobile-logout icon-button"
                aria-label="학교 선택으로 돌아가기"
                onClick={logout}
              >
                <LogOut size={19} />
              </button>
              <button
                className="icon-button"
                aria-label="알림 설정"
                onClick={() => setNotificationOpen(true)}
              >
                <Bell size={21} />
              </button>
              <span className="avatar">나</span>
            </div>
          </header>
          <TabsContent value="home" className="page-content">
            <div className="page-heading">
              <p className="date-label">2026년 9월 8일 화요일 · 예시 주간</p>
              <h1>
                오늘의 빈틈,
                <br className="mobile-only" /> 뭘로 채울까요?
                <span className="lime-dot">●</span>
              </h1>
            </div>
            <div className="week-strip">
              {days.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setDay(i)}
                  aria-pressed={day === i}
                  className={day === i ? 'selected' : ''}
                >
                  <span>{d}</span>
                  <b>{7 + i}</b>
                  <i
                    className={
                      courses.some((c) => c.day === i) ? 'has-class' : ''
                    }
                  />
                </button>
              ))}
            </div>
            <section className="gap-card">
              <div className="gap-top">
                <span>
                  <span className="live-dot" />
                  {days[day]}요일의 공강
                </span>
                <Clock3 size={22} />
              </div>
              <h2>
                {totalGap
                  ? `${Math.floor(totalGap / 60) ? `${Math.floor(totalGap / 60)}시간 ` : ''}${totalGap % 60 ? `${totalGap % 60}분` : ''}`
                  : '공강 없음'}
                <span>{totalGap ? '의 가능성' : ''}</span>
              </h2>
              <p>
                {gaps.length
                  ? gaps
                      .map((g) => `${time(g.start)}–${time(g.end)}`)
                      .join(' · ')
                  : '등록한 수업 사이에 빈 시간이 없어요.'}
              </p>
              <div className="day-track">
                {Array.from({ length: 9 }, (_, i) => (
                  <div
                    key={i}
                    className={
                      dayCourses.some(
                        (c) => c.start < 600 + i * 60 && c.end > 540 + i * 60,
                      )
                        ? 'occupied'
                        : 'free'
                    }
                  />
                ))}
              </div>
              <div className="track-labels">
                <span>09:00</span>
                <span>12:00</span>
                <span>15:00</span>
                <span>18:00</span>
              </div>
              <button className="gap-link" onClick={() => setTab('schedule')}>
                내 시간표 보기 <ArrowUpRight size={17} />
              </button>
            </section>
            <section className="section">
              <div className="section-heading">
                <h2>
                  공강에 쏙 들어가는 활동 <span>{homeActivities.length}</span>
                </h2>
                <button onClick={() => setTab('discover')}>전체 보기 →</button>
              </div>
              <p className="section-caption">
                수업 전후 이동 시간 10분을 고려했어요.
              </p>
              {homeActivities.length ? (
                homeActivities.map(card)
              ) : (
                <div className="empty-state">
                  <CalendarDays />
                  <b>이 공강에 맞는 활동이 아직 없어요.</b>
                  <p>다른 요일을 선택하거나 교내 공간을 둘러보세요.</p>
                  <button
                    className="secondary"
                    onClick={() => setTab('spaces')}
                  >
                    공간 둘러보기
                  </button>
                </div>
              )}
            </section>
            <button className="space-banner" onClick={() => setTab('spaces')}>
              <span className="banner-icon">
                <LibraryBig size={28} />
              </span>
              <span>
                <small>잠깐 머무를 곳이 필요하다면</small>
                <b>우리 학교 공간, 후기부터 살펴봐요</b>
              </span>
              <ArrowRight size={22} />
            </button>
            <p className="sample-note">
              추천 활동은 체험용 예시입니다. 실제 공지는 활동 찾기에서
              확인하세요.
            </p>
          </TabsContent>
          <TabsContent value="discover" className="page-content">
            <div className="page-heading">
              <p className="date-label">내 시간에 맞는 새로운 기회</p>
              <h1>활동 찾기</h1>
            </div>
            <SchoolNotices school={school} key={school} />
            <div className="demo-section-heading">
              <span>공강 추천 체험</span>
              <small>아래 활동은 예시입니다</small>
            </div>
            <label className="search-box">
              <Search size={21} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="어떤 활동을 찾고 있나요?"
                aria-label="활동 검색"
              />
            </label>
            <div className="filter-row">
              {['전체', '교내 프로그램', '진로·취업', '공모전', '장학금'].map(
                (f) => (
                  <button
                    key={f}
                    className={filter === f ? 'selected' : ''}
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ),
              )}
            </div>
            <div className="result-bar">
              <span>활동 {visible.length}개</span>
              <div className="fit-toggle">
                수업 겹침 제외{' '}
                <Switch
                  checked={onlyFit}
                  onCheckedChange={setOnlyFit}
                  aria-label="수업과 겹치는 활동 제외"
                />
              </div>
            </div>
            {visible.length ? (
              visible.map(card)
            ) : (
              <div className="empty-state">
                <Search />
                <b>조건에 맞는 활동이 없어요.</b>
                <button
                  className="secondary"
                  onClick={() => {
                    setQuery('');
                    setFilter('전체');
                    setOnlyFit(false);
                  }}
                >
                  검색 조건 초기화
                </button>
              </div>
            )}
            <p className="sample-note">
              날짜·지원 자격·장소는 모두 예시입니다.
            </p>
          </TabsContent>
          <TabsContent value="schedule" className="page-content">
            <div className="page-heading inline">
              <div>
                <p className="date-label">2026년 2학기 · 예시 시간표</p>
                <h1>내 시간표</h1>
              </div>
              <button
                className="primary compact"
                onClick={() => {
                  setError('');
                  setCourseOpen(true);
                }}
              >
                <Plus size={18} /> 수업 추가
              </button>
            </div>
            <div className="timetable">
              <div className="table-head">
                <span />
                {days.map((d) => (
                  <b key={d}>{d}</b>
                ))}
              </div>
              <div className="table-body">
                <div className="time-column">
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i}>{i + 9}</span>
                  ))}
                </div>
                {days.map((d, idx) => (
                  <div className="day-column" key={d}>
                    {courses
                      .filter((c) => c.day === idx)
                      .map((c) => (
                        <div
                          key={c.id}
                          className={`course-block ${['blue', 'lime', 'pink'][c.id % 3]}`}
                          style={{
                            top: `${((c.start - 540) / 540) * 100}%`,
                            height: `${((c.end - c.start) / 540) * 100}%`,
                          }}
                        >
                          <b>{c.name}</b>
                          <small>
                            {time(c.start)}
                            <br />–{time(c.end)}
                          </small>
                          <button
                            aria-label={`${c.name} 삭제`}
                            onClick={() => {
                              setCourses((prev) =>
                                prev.filter((x) => x.id !== c.id),
                              );
                              setNotice(
                                '수업을 삭제하고 추천을 업데이트했어요.',
                              );
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="info-note">
              <Sparkles size={20} />
              <p>
                수업을 추가하거나 삭제하면 공강과 추천 활동이 함께 바뀌어요.
                시간표는 학교에서 가져오지 않고 직접 입력합니다.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="spaces" className="page-content">
            <div className="page-heading">
              <p className="date-label">공강을 보내는 우리만의 장소</p>
              <h1>우리 학교 공간</h1>
              <p className="muted">학교 계정 이용자들의 경험을 모았어요.</p>
            </div>
            <div className="place-grid">
              {places.map((p) => {
                const rs = reviews.filter(
                  (r) =>
                    r.school === school &&
                    r.place === p.id &&
                    !blocked.includes(`${school}:${r.author}`),
                );
                return (
                  <button
                    className="place-card"
                    aria-label={`${p.name} 리뷰 보기`}
                    key={p.id}
                    onClick={() => {
                      setPlace(p.id);
                      setReviewText('');
                    }}
                  >
                    <div className={`place-visual ${p.color}`}>
                      <p.icon size={43} strokeWidth={1.3} />
                      <span>SPACE 0{p.id}</span>
                    </div>
                    <div className="place-info">
                      <div className="place-title">
                        <h2>{p.name}</h2>
                        <ArrowUpRight size={20} />
                      </div>
                      <p>
                        <MapPin size={14} />
                        {p.sub}
                      </p>
                      <div className="place-rating">
                        <Star size={16} fill="currentColor" />
                        <b>
                          {rs.length
                            ? (
                                rs.reduce((n, r) => n + r.score, 0) / rs.length
                              ).toFixed(1)
                            : '첫 리뷰를 남겨보세요'}
                        </b>
                        <span>리뷰 {rs.length}</span>
                      </div>
                      <div className="tags">
                        {p.tags.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="sample-note">
              공간·운영시간·기존 후기는 예시입니다. 실시간 빈자리 정보가
              아닙니다.
            </p>
          </TabsContent>
          <TabsContent value="saved" className="page-content">
            <div className="page-heading">
              <p className="date-label">놓치고 싶지 않은 기회</p>
              <h1>
                저장한 일정 <span className="count">{saved.length}</span>
              </h1>
            </div>
            <div className="notification-card">
              <Bell size={21} />
              <span>
                <b>신청 마감 알림</b>
                <small>데모 설정 · 실제 알림은 발송하지 않아요</small>
              </span>
              <Switch
                checked={notify}
                onCheckedChange={setNotify}
                aria-label="마감 알림 데모 설정"
              />
            </div>
            {saved.length ? (
              activities.filter((a) => saved.includes(a.id)).map(card)
            ) : (
              <div className="empty-state large">
                <Bookmark size={35} />
                <b>관심 있는 활동을 모아보세요.</b>
                <p>활동의 책갈피를 누르면 여기에 저장돼요.</p>
                <button className="primary" onClick={() => setTab('discover')}>
                  활동 찾기 <ArrowRight size={17} />
                </button>
              </div>
            )}
            <p className="sample-note">
              저장은 신청 완료를 뜻하지 않아요. 새로고침하면 데모가
              초기화됩니다.
            </p>
          </TabsContent>
        </main>
      </Tabs>
      {notice && (
        <output className="toast" aria-live="polite">
          <Check size={18} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="안내 닫기">
            ×
          </button>
        </output>
      )}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="detail-dialog" showCloseButton={false}>
          <button
            className="screen-back"
            onClick={() => setDetail(null)}
            aria-label="활동 목록으로 돌아가기"
          >
            <ArrowLeft size={23} />
            <span>활동 상세</span>
          </button>
          {detail && (
            <>
              <span className={`detail-symbol ${detail.color}`}>
                <Sparkles size={30} />
              </span>
              <span className="eyebrow">
                {schools[school]} · {detail.kind}
              </span>
              <DialogTitle className="dialog-title">{detail.title}</DialogTitle>
              <DialogDescription className="dialog-description">
                {detail.description}
              </DialogDescription>
              <div className="detail-facts">
                <p>
                  <CalendarDays size={18} />
                  {detail.start
                    ? `9월 ${7 + detail.day}일 (${days[detail.day]}) ${time(detail.start)}–${time(detail.end)}`
                    : '진행 시간 미정 · 신청 마감 기준'}
                </p>
                <p>
                  <MapPin size={18} />
                  {detail.place}
                </p>
                <p>
                  <Clock3 size={18} />
                  신청 마감 {detail.deadline}
                </p>
                <p>
                  <ShieldCheck size={18} />
                  지원 자격: 원문 확인 필요
                </p>
              </div>
              <div
                className={
                  available(detail, courses) ? 'fit-box' : 'conflict-box'
                }
              >
                {detail.start
                  ? available(detail, courses)
                    ? '수업과 겹치지 않아요. 실제 신청 가능 여부는 별도 확인이 필요해요.'
                    : '수업과 시간이 겹쳐요. 시간표를 확인해주세요.'
                  : '신청 마감일을 내 일정에서 관리할 수 있어요.'}
              </div>
              <button
                className="primary full"
                onClick={() => toggleSave(detail.id)}
              >
                <Bookmark size={18} />
                {saved.includes(detail.id) ? '저장 취소' : '내 일정에 저장'}
              </button>
              <p className="sample-note">
                예시 활동으로 실제 신청·원문 연결은 제공하지 않습니다.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={place !== null}
        onOpenChange={(open) => !open && setPlace(null)}
      >
        <DialogContent className="review-dialog" showCloseButton={false}>
          <button
            className="screen-back"
            onClick={() => setPlace(null)}
            aria-label="공간 목록으로 돌아가기"
          >
            <ArrowLeft size={23} />
            <span>공간 리뷰</span>
          </button>
          {currentPlace && (
            <>
              <span className="eyebrow">{schools[school]} · 예시 공간</span>
              <DialogTitle className="dialog-title">
                {currentPlace.name}
              </DialogTitle>
              <DialogDescription>
                {currentPlace.sub} · 운영 {currentPlace.hours}
              </DialogDescription>
              <div className="review-list">
                {shownReviews.length ? (
                  shownReviews.map((r) => (
                    <article className="review" key={r.id}>
                      <div className="review-header">
                        <b>{r.author}</b>
                        <span className="review-stars">
                          {'★'.repeat(r.score)}
                          {'☆'.repeat(5 - r.score)}
                        </span>
                      </div>
                      <span className="review-meta">
                        {r.mine ? '내 데모 리뷰' : '예시 후기'} · 학교 계정 데모
                      </span>
                      <p>{r.text}</p>
                      <div className="review-footer">
                        {r.mine ? (
                          <div>
                            <button
                              onClick={() => {
                                setReviewText(r.text);
                                setScore(String(r.score));
                              }}
                            >
                              수정
                            </button>
                            <button
                              onClick={() =>
                                setReviews((prev) =>
                                  prev.filter((x) => x.id !== r.id),
                                )
                              }
                            >
                              삭제
                            </button>
                          </div>
                        ) : (
                          <div>
                            <button
                              onClick={() =>
                                setNotice(
                                  '신고 동작을 체험했어요. 운영자에게 전송되지는 않습니다.',
                                )
                              }
                            >
                              신고
                            </button>
                            <button
                              onClick={() => {
                                setBlocked((prev) => [
                                  ...prev,
                                  `${school}:${r.author}`,
                                ]);
                                setNotice(
                                  '이 작성자의 후기를 현재 화면에서 숨겼어요.',
                                );
                              }}
                            >
                              차단
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>아직 후기가 없어요. 첫 경험을 나눠주세요.</p>
                  </div>
                )}
              </div>
              <form onSubmit={addReview} className="review-form">
                <h3>내 경험 남기기</h3>
                <Choice
                  value={score}
                  onChange={setScore}
                  label="별점"
                  items={['5', '4', '3', '2', '1'].map((s) => [s, `${s}점`])}
                />
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  minLength={5}
                  maxLength={300}
                  required
                  placeholder="다음에 방문할 학우에게 도움이 될 경험을 적어주세요. (5자 이상)"
                  aria-label="리뷰 내용"
                />
                <div className="review-submit">
                  <span>{reviewText.length}/300 · 현재 화면에만 저장</span>
                  <button
                    className="primary compact"
                    disabled={reviewText.trim().length < 5}
                    type="submit"
                  >
                    {reviews.some(
                      (r) => r.school === school && r.place === place && r.mine,
                    )
                      ? '내 리뷰 수정'
                      : '리뷰 등록'}
                  </button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={courseOpen} onOpenChange={setCourseOpen}>
        <DialogContent>
          <DialogTitle className="dialog-title">수업 추가</DialogTitle>
          <DialogDescription>
            수업 시간을 반영해 공강을 다시 계산해요.
          </DialogDescription>
          <form className="course-form" onSubmit={addCourse}>
            <label>
              수업 이름
              <input
                required
                maxLength={30}
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="예: 웹 프로그래밍"
              />
            </label>
            <div className="field-label">
              요일
              <Choice
                value={courseDay}
                onChange={setCourseDay}
                label="수업 요일"
                items={days.map((d, i) => [String(i), `${d}요일`])}
              />
            </div>
            <div className="time-inputs">
              <label>
                시작
                <input
                  type="time"
                  required
                  min="09:00"
                  max="18:00"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                종료
                <input
                  type="time"
                  required
                  min="09:00"
                  max="18:00"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="primary full" type="submit">
              시간표에 추가
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}>
        <DialogContent>
          <DialogTitle className="dialog-title">마감 알림</DialogTitle>
          <DialogDescription>
            저장한 활동의 마감 알림 설정을 체험해보세요. 실제 푸시 알림은
            발송하지 않습니다.
          </DialogDescription>
          <div className="notification-card">
            <Bell size={20} />
            <b>마감 하루 전 알림</b>
            <Switch
              checked={notify}
              onCheckedChange={setNotify}
              aria-label="알림 활성화"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
