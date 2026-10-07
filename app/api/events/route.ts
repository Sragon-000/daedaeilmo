import { createHash } from 'node:crypto';
import { enrichPoster } from '@/lib/poster-ocr';
import { parseNotices } from '@/lib/school-notices';
import { articleBody, eventCandidate, parseEvent, type CampusEvent } from '@/lib/campus-events';
import { storeEvents, storedEvents } from '@/lib/event-catalog';
import { authenticatedSchool, reply } from '@/lib/member-server';
let cached: {ids:string[];fetchedAt:string;partial:boolean} | undefined;
let pending: Promise<NonNullable<typeof cached>> | undefined;
async function read(url:string) {
 const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'DaedaeilmoPrototype/0.1 public-campus-notice-reader',Accept:'text/html'}});
 if(!response.ok)throw new Error('UPSTREAM');
 const html=await response.text();if(html.length>2000000)throw new Error('SIZE');return html;
}
async function collect() {
 const fetchedAt=new Date().toISOString();
 const pages=[['Notify_1',1],['Notify_1',2],['Notify_1',3],['Event_1',1]] as const;
 const recent=new Date(Date.now()-120*86400000).toISOString().slice(0,10);
 const boards=await Promise.allSettled(pages.map(async ([board,page])=>{
  const html=await read('https://www.pcu.ac.kr/kor/article/'+board+'?pageIndex='+page);
  return parseNotices(html,'pcu',60).filter(n=>eventCandidate(n.title) && (!n.postedAt || n.postedAt>=recent))
   .map(n=>({...n,id:`${board}:${n.id}`,sourceBoard:board,url:`https://www.pcu.ac.kr/kor/article/${board}/${n.id}`}));
 }));
 const notices=[...new Map(boards.flatMap(b=>b.status==='fulfilled'?b.value:[]).map(n=>[n.id,n])).values()].slice(0,16);
 if(!notices.length)throw new Error('EMPTY');
 const items:CampusEvent[]=[];let partial=boards.some(b=>b.status==='rejected');
 // Bound upstream concurrency and keep unparsed items visible without guessing dates.
 for(let i=0;i<notices.length;i+=2) {
  const group=await Promise.all(notices.slice(i,i+2).map(async notice=>{
   try {const html=await read(notice.url),body=articleBody(html),event=parseEvent(html,notice,fetchedAt);
    if(!body){partial=true;return {...event,sourceUnavailable:true};}
    event.contentHash=createHash('sha256').update(body.replace(/<!--[\s\S]*?-->/g,'').replace(/\s+/g,' ')).digest('hex');
    return await enrichPoster(event);}
   catch {partial=true;return {...parseEvent('',notice,fetchedAt),sourceUnavailable:true};}
  }));items.push(...group);
 }
 await storeEvents(items);
 cached={ids:items.map(item=>item.id),fetchedAt,partial};return cached;
}
export async function GET(request: Request) {
 const session=authenticatedSchool(request);
 if(!session || session.school!=='pcu')return reply({},401);
 try {
  if(!cached || Date.now()-Date.parse(cached.fetchedAt)>600000) {
   pending ??= collect().finally(()=>{pending=undefined;});await pending;
  }
  if (!cached) throw new Error('EMPTY');
  return Response.json({items:await storedEvents(cached.ids),fetchedAt:cached.fetchedAt,partial:cached.partial,mode:'live'},{headers:{'Cache-Control':'no-store'}});
 } catch {
  if(cached) {
   try {return Response.json({items:await storedEvents(cached.ids),fetchedAt:cached.fetchedAt,partial:cached.partial,mode:'stale'},{headers:{'Cache-Control':'no-store'}});}
   catch { /* A missing catalog is not usable stale data. */ }
  }
  return Response.json({message:'학교 행사 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.'},{status:503});
 }
}
