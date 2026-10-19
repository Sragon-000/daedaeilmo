import { getDb } from '@/db';
import { authenticatedSchool, ensureMember, reply } from '@/lib/member-server';

export async function GET(request: Request) {
  const session = authenticatedSchool(request); if (!session || session.school !== 'pcu') return reply({},401);
  try {
    const member = await ensureMember(session);
    const rows = await getDb().prepare(`SELECT p.id,p.title,p.description,p.eligibility,p.place,p.event_date,p.start_minute,p.end_minute,p.capacity,p.absence_confirmed,p.absence_evidence,p.source_event_id,e.url AS source_url,
      a.status AS my_status,a.acknowledged_at AS my_acknowledged_at,
      (SELECT COUNT(*) FROM program_applications c WHERE c.program_id=p.id AND c.status='accepted') AS accepted_count
      FROM institution_programs p LEFT JOIN campus_events e ON e.id=p.source_event_id
      LEFT JOIN program_applications a ON a.program_id=p.id AND a.member_id=?
      WHERE p.school='pcu' AND p.status='published' ORDER BY p.updated_at DESC LIMIT 100`).bind(member.id).all();
    return reply({ programs:rows.results, identity:{ name:member.name, source:'self_entered', schoolVerified:true } });
  } catch { return reply({message:'프로그램을 불러오지 못했어요.'},503); }
}
