'use client';
import { useState, type SyntheticEvent } from 'react';

export default function SchoolLogin({
  school,
  onSuccess,
}: {
  school: string;
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPasswordVisible(false);
    setPending(true);
    setMessage('배재대학교에서 계정을 확인하고 있어요.');
    try {
      const response = await fetch('/api/school-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          school,
          username: values.get('username'),
          password: values.get('password'),
        }),
      });
      const result = (await response.json()) as {
        authenticated?: boolean;
        message?: string;
      };
      if (!response.ok || result.authenticated !== true) {
        setMessage(result.message || '학교 로그인을 확인하지 못했어요.');
        return;
      }
      // Verify that the browser actually retained the server-issued HttpOnly cookie.
      const session = await fetch('/api/school-auth', {
        cache: 'no-store',
      }).then(
        (r) =>
          r.json() as Promise<{ authenticated?: boolean; school?: string }>,
      );
      if (session.authenticated !== true || session.school !== 'pcu') {
        setMessage(
          '로그인 세션을 유지하지 못했어요. 브라우저 쿠키 설정을 확인해 주세요.',
        );
        return;
      }
      form.reset();
      onSuccess();
    } catch {
      setMessage('연결이 끊겼어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      const password = form.elements.namedItem('password');
      if (password instanceof HTMLInputElement) password.value = '';
      values.delete('password');
      setPending(false);
    }
  }
  if (school !== 'pcu')
    return (
      <p className="auth-explanation">
        계명대학교 계정 인증은 추후 연결 예정입니다.
      </p>
    );
  return (
    <form onSubmit={submit} className="school-login" aria-busy={pending}>
      <label htmlFor="school-username">배재대 학번 / 아이디</label>
      <input
        id="school-username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={40}
        required
        disabled={pending}
      />
      <label htmlFor="school-password">학교 비밀번호</label>
      <div className="password-field">
        <input
          id="school-password"
          name="password"
          type={passwordVisible ? 'text' : 'password'}
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={100}
          required
          disabled={pending}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={passwordVisible ? '비밀번호 가리기' : '비밀번호 보기'}
          aria-controls="school-password"
          disabled={pending}
          onClick={() => setPasswordVisible((visible) => !visible)}
        >
          {passwordVisible ? '가리기' : '보기'}
        </button>
      </div>
      <p className="auth-explanation">
        배재대 포털 로그인으로 확인합니다. 비밀번호는 인증에만 사용하고 저장하지
        않습니다. 학교의 기존 로그인 세션이 종료될 수 있어요.
      </p>
      <button className="primary full" disabled={pending}>
        {pending ? '학교 계정 확인 중…' : '배재대 계정으로 로그인'}
      </button>
      {message && (
        <output className="auth-message" aria-live="polite">
          {message}
        </output>
      )}
    </form>
  );
}
