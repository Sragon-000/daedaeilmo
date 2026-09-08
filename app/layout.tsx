import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '대대일모 · 나를 위한 공강',
  icons: { icon: '/favicon.svg' },
  description:
    '배재대학교와 계명대학교의 공강 추천, 시간표, 공간 리뷰를 체험하는 프로토타입입니다.',
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
