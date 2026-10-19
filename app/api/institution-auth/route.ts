import { authenticateInstitutionKey, institutionActor, institutionConfigured, issueInstitutionCookie } from '@/lib/institution-auth';
import { ownOrigin, reply, smallJson } from '@/lib/member-server';

export async function GET(request: Request) { const actor=await institutionActor(request);return reply({ authenticated:!!actor, available:institutionConfigured(), actor:actor&&{label:actor.label,role:actor.role,staffId:actor.staffId} }); }
export async function POST(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  let body: unknown; try { body = await smallJson(request); } catch { return reply({}, 400); }
  try {
    const actor=await authenticateInstitutionKey((body as { accessKey?: unknown })?.accessKey);
    if (!actor) return reply({ message: '기관 접속 코드를 확인해 주세요.' }, 401);
    const response=reply({ authenticated:true, actor:{label:actor.label,role:actor.role,staffId:actor.staffId} });
    response.headers.set('Set-Cookie',issueInstitutionCookie(request,actor));return response;
  } catch { return reply({message:'기관 로그인에 연결하지 못했어요.'},503); }
}
export function DELETE(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const response = reply({ authenticated: false }); response.headers.set('Set-Cookie', issueInstitutionCookie(request)); return response;
}
