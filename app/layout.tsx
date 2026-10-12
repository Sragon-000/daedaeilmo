import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '대대일모 · 나를 위한 공강',
  icons: { icon: '/favicon.svg' },
  description:
    '배재대학교의 실제 학교 활동, 직접 입력하는 시간표와 공간 리뷰 기능을 보여 주는 대대일모 앱입니다.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
