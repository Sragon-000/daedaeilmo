import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '대대일모 · 기관 운영 시연',
  description: '가상 자료로 프로그램 현황과 취소·대기자 처리 흐름을 보여 주는 기관 담당자용 시연 화면입니다.',
};

export default function InstitutionPreviewLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
