// Fail closed: a demo flag, a school URL visit, or client-supplied success cannot issue a school session.
export async function POST() {
  return Response.json(
    {
      authenticated: false,
      code: 'SCHOOL_INTEGRATION_NOT_VERIFIED',
      message: '학교 로그인 성공을 검증하는 연동이 아직 준비되지 않았습니다.',
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
