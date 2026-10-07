'use client';
import Image from 'next/image';
import { useState, type SyntheticEvent } from 'react';
import { avatars, type Member, type Avatar } from '@/lib/member-types';
export default function MemberProfile({ member, onSaved, onBack, onTimetable, onPhotoChanged }: { member: Member; onSaved: (member: Member) => void; onBack: () => void; onTimetable: () => void; onPhotoChanged: (member: Member) => void }) {
  const [name, setName] = useState(member.name), [nickname, setNickname] = useState(member.nickname), [avatar, setAvatar] = useState<Avatar>(member.avatar);
  const [pending, setPending] = useState(false), [message, setMessage] = useState('');
  async function changePhoto(file?: File) {
    setPending(true); setMessage('');
    try {
      let body: Blob | undefined;
      if (file) {
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) throw new Error('10MB 이하의 JPG·PNG·WebP 사진을 선택해 주세요.');
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1,512/Math.max(bitmap.width,bitmap.height));
        const canvas = document.createElement('canvas'); canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
        const context=canvas.getContext('2d'); if(!context) {bitmap.close();throw new Error('사진을 처리하지 못했어요.');}
        context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
        body=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('사진을 처리하지 못했어요.')),'image/jpeg',0.8));
      }
      const response=await fetch('/api/avatar',{method:file?'POST':'DELETE',...(body?{headers:{'Content-Type':'image/jpeg'},body}:{})});
      const result=await response.json() as {member?:Member;message?:string};
      if(!response.ok || !result.member) throw new Error(result.message || '사진을 저장하지 못했어요.');
      onPhotoChanged(result.member);setMessage(file?'사진을 저장했어요.':'기본 아바타로 변경했어요.');
    } catch(error) {setMessage(error instanceof Error?error.message:'사진을 처리하지 못했어요.');}
    finally {setPending(false);}
  }
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage('');
    try {
      const response = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, nickname, avatar }) });
      const result = await response.json() as { member?: Member; message?: string };
      if (!response.ok || !result.member) { setMessage(result.message || '저장하지 못했어요.'); return; }
      onSaved(result.member);
    } catch { setMessage('연결을 확인하고 다시 시도해 주세요.'); }
    finally { setPending(false); }
  }
  return <main className="member-profile">
    <button className="profile-back" onClick={onBack} disabled={pending}>{member.needsSetup ? '로그아웃' : '← 돌아가기'}</button>
    <p className="date-label">배재대학교 · 학교 인증됨</p>
    <h1>{member.needsSetup ? '내 프로필 만들기' : '내 프로필'}</h1>
    <p className="muted">리뷰마다 이름 또는 닉네임을 선택할 수 있어요.</p>
    {!member.needsSetup && <button className="secondary full" onClick={onTimetable}>학기별 시간표 설정 →</button>}
    <form className="school-login" onSubmit={submit}>
      <div className="profile-avatar-preview" aria-label="선택한 아바타">{member.photoUrl ? <Image unoptimized width={96} height={96} src={member.photoUrl} alt="내 프로필 사진" /> : avatars[avatar]}</div>
      <label htmlFor="profile-photo">프로필 사진 업로드</label>
      <input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={e => { const file=e.target.files?.[0]; if(file) void changePhoto(file); e.target.value=''; }} />
      <p className="profile-hint">JPG·PNG·WebP, 최대 10MB · 선택한 사진은 바로 저장됩니다.</p>
      {member.photoUrl && <button type="button" className="secondary full" disabled={pending} onClick={() => void changePhoto()}>사진 삭제 · 기본 아바타 사용</button>}
      <fieldset className="avatar-options"><legend>사진이 없을 때 사용할 기본 아바타</legend>{Object.entries(avatars).map(([key, emoji]) => <button key={key} type="button" aria-label={`${emoji} 아바타`} aria-pressed={avatar === key} disabled={pending} onClick={() => setAvatar(key as Avatar)}>{emoji}</button>)}</fieldset>
      <label htmlFor="profile-name">이름 (실명)</label>
      <input id="profile-name" name="profileName" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={24} required disabled={pending} autoComplete="name" />
      <p className="profile-hint">본인의 실제 이름을 입력해 주세요. 학교에서 자동으로 확인한 실명은 아닙니다.</p>
      <label htmlFor="profile-nickname">닉네임</label>
      <input id="profile-nickname" name="nickname" value={nickname} onChange={e => setNickname(e.target.value)} minLength={2} maxLength={24} required disabled={pending} autoComplete="off" />
      <p className="profile-hint">자동 생성된 닉네임을 자유롭게 바꿀 수 있어요.</p>
      <button type="submit" className="primary full" disabled={pending || name.trim().length < 2 || nickname.trim().length < 2}>{pending ? '저장 중…' : member.needsSetup ? '프로필 저장하고 시작' : '변경사항 저장'}</button>
      {message && <output className="auth-message" aria-live="polite">{message}</output>}
    </form>
  </main>;
}
