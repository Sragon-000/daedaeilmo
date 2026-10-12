 'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home, Search, CalendarDays, MessageSquare, GraduationCap, LogOut } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { avatars, type Member } from '@/lib/member-types';
import MemberProfile from './member-profile';
import SchoolLogin from './school-login';
import SemesterTimetable, { type SemesterCourse } from './semester-timetable';
import CampusEvents from './campus-events';
import { SchoolNotices } from './school-notices';
export default function Page() {
 const [authenticated,setAuthenticated]=useState(false),[checking,setChecking]=useState(true),[member,setMember]=useState<Member|null>(null),[profileOpen,setProfileOpen]=useState(false),[tab,setTab]=useState('home'),[notice,setNotice]=useState('');
 const [academicYear,setAcademicYear]=useState(new Date().getMonth()<2?new Date().getFullYear()-1:new Date().getFullYear()),[semester,setSemester]=useState(new Date().getMonth()>=2 && new Date().getMonth()<8?1:2),[courses,setCourses]=useState<SemesterCourse[]>([]),[onboarding,setOnboarding]=useState(false);
 useEffect(()=>{
  let alive=true;
  const check=async()=>{try{const r=await fetch('/api/school-auth',{cache:'no-store'});if(!r.ok)throw new Error();const s=await r.json() as {authenticated?:boolean;school?:string};if(!alive)return;
   const ok=s.authenticated===true && s.school==='pcu';setAuthenticated(ok);if(!ok){setMember(null);setCourses([]);setProfileOpen(false);}
  }catch{if(alive){setAuthenticated(false);setMember(null);setCourses([]);}}finally{if(alive)setChecking(false);}};
  void check();const timer=setInterval(check,60000);return()=>{alive=false;clearInterval(timer);};
 },[]);
 useEffect(()=>{if(!authenticated)return;const abort=new AbortController();
  fetch('/api/profile',{signal:abort.signal}).then(async r=>{const data=await r.json() as {member?:Member;message?:string};if(!r.ok || !data.member)throw new Error(data.message || '프로필을 불러오지 못했어요.');return data.member;}).then(m=>{if(!abort.signal.aborted)setMember(m);}).catch(e=>{if(!abort.signal.aborted)setNotice(e.message);});return()=>abort.abort();
 },[authenticated]);
 useEffect(()=>{if(!authenticated)return;const abort=new AbortController();
  fetch(`/api/timetable?year=${academicYear}&semester=${semester}`,{signal:abort.signal}).then(async r=>{if(!r.ok)throw new Error('시간표를 불러오지 못했어요.');return r.json() as Promise<{courses:SemesterCourse[]}>;}).then(data=>{if(!abort.signal.aborted)setCourses(data.courses);}).catch(e=>{if(!abort.signal.aborted)setNotice(e.message);});return()=>abort.abort();
 },[authenticated,academicYear,semester]);
 async function refreshCourses(){const r=await fetch(`/api/timetable?year=${academicYear}&semester=${semester}`,{cache:'no-store'});if(!r.ok)throw new Error('시간표를 불러오지 못했어요.');const data=await r.json() as {courses:SemesterCourse[]};setCourses(data.courses);}
 async function logout(){const r=await fetch('/api/school-auth',{method:'DELETE'}).catch(()=>null);if(!r?.ok){setNotice('로그아웃하지 못했어요.');return;}setAuthenticated(false);setMember(null);setCourses([]);setProfileOpen(false);setOnboarding(false);setNotice('');}
 if(checking)return <main className="member-profile"><output>로그인을 확인하고 있어요…</output></main>;
 if(!authenticated)return <main className="welcome mobile-welcome"><header className="welcome-header"><b>대대일모.</b></header><section className="welcome-intro"><span className="intro-eyebrow">우리 학교의 실제 소식</span><h1>내 공강을<br/>더 나답게.</h1><Link className="welcome-preview-link" href="/preview">로그인 없이 앱 미리보기 ↗</Link></section><section className="welcome-form"><h2>배재대학교</h2><p className="muted">학교 계정으로 로그인하고 실제 행사와 공지를 만나보세요.</p><SchoolLogin school="pcu" onSuccess={()=>{setAuthenticated(true);setCourses([]);setMember(null);setTab('home');}}/></section></main>;
 if(member && (member.needsSetup || profileOpen))return <MemberProfile key={member.id} member={member} onPhotoChanged={setMember} onSaved={updated=>{const first=member.needsSetup;setMember(updated);setProfileOpen(false);if(first){setOnboarding(true);setTab('schedule');}}} onBack={()=>{if(member.needsSetup)void logout();else setProfileOpen(false);}} onTimetable={()=>{setProfileOpen(false);setTab('schedule');}}/>;
 return <div className="app-shell"><Tabs className="app-tabs" value={tab} onValueChange={v=>setTab(String(v))}><TabsList className="main-nav" aria-label="주요 메뉴">{[{id:'home',label:'홈',icon:Home},{id:'discover',label:'활동 찾기',icon:Search},{id:'schedule',label:'내 시간표',icon:CalendarDays},{id:'spaces',label:'공간 리뷰',icon:MessageSquare}].map(n=><TabsTrigger key={n.id} value={n.id}><n.icon size={21}/><span>{n.label}</span></TabsTrigger>)}</TabsList><main className="app-main">
 <header className="topbar"><div className="school-label"><GraduationCap size={19}/><b>배재대학교</b><span className="demo-label">학교 인증됨</span>{member && <span className="student-identity"><strong>{member.name}</strong><span>@{member.nickname}</span></span>}</div><div className="header-actions"><button className="icon-button" aria-label="로그아웃" onClick={()=>void logout()}><LogOut size={19}/></button><button className="avatar" aria-label="프로필 및 설정" disabled={!member} onClick={()=>setProfileOpen(true)}>{member?.photoUrl?<Image unoptimized width={40} height={40} className="avatar-photo" src={member.photoUrl} alt="내 프로필 사진"/>:member?avatars[member.avatar]:'나'}</button></div></header>
 {notice && <output className="auth-message">{notice}</output>}
 <TabsContent value="home" className="page-content"><div className="page-heading"><p className="date-label">{academicYear}년 {semester}학기</p><h1>우리 학교의 새로운 기회</h1></div><button className="secondary full" onClick={()=>setTab('schedule')}>{courses.length?`등록한 수업 ${courses.length}개 · 시간표 보기`:'내 시간표를 입력하고 행사와 비교하기'}</button><CampusEvents courses={courses} year={academicYear} semester={semester}/></TabsContent>
 <TabsContent value="discover" className="page-content"><div className="page-heading"><h1>활동 찾기</h1></div><CampusEvents courses={courses} year={academicYear} semester={semester}/><SchoolNotices school="pcu"/></TabsContent>
 <TabsContent value="schedule" className="page-content"><SemesterTimetable courses={courses} year={academicYear} semester={semester} onTerm={(year,term)=>{setCourses([]);setAcademicYear(year);setSemester(term);}} onChanged={refreshCourses} onDemoChange={setCourses} authenticated onboarding={onboarding} onFinish={()=>{setOnboarding(false);setTab('home');}}/></TabsContent>
 <TabsContent value="spaces" className="page-content"><div className="page-heading"><h1>공간 리뷰</h1></div><div className="empty-state"><MessageSquare/><b>실제 공간 정보를 준비하고 있어요.</b><p>학교 공간 정보가 연결되면 여기에서 리뷰를 볼 수 있어요.</p></div></TabsContent>
 </main></Tabs></div>;
}
