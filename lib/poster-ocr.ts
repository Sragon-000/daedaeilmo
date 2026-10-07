import { env } from 'cloudflare:workers';
import { createHash } from 'node:crypto';
import { getDb } from '@/db';
import type { CampusEvent } from './campus-events';
import { extractPosterSchedule, type OcrLine } from './poster-schedule';
async function bounded(response:Response,max:number) {
 const reader=response.body?.getReader();if(!reader)throw new Error('EMPTY');let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('SIZE');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;
}
async function recognize(url:string):Promise<OcrLine[]> {
 const config=env as unknown as {POSTER_OCR_URL?:string;POSTER_OCR_TOKEN?:string};
 const parsed=new URL(url);if(parsed.origin!=='https://www.pcu.ac.kr' || !parsed.pathname.startsWith('/upload/'))throw new Error('SOURCE');
 const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'DaedaeilmoPrototype/0.1 public-campus-notice-reader'}});if(!response.ok || !response.headers.get('content-type')?.startsWith('image/'))throw new Error('IMAGE');
 const bytes=await bounded(response,8000000),hash=createHash('sha256').update(bytes).update('vision-v1').digest('hex');
 const db=getDb(),cached=await db.prepare('SELECT payload FROM poster_ocr WHERE hash = ?').bind(hash).first<{payload:string}>();
 if(cached)return JSON.parse(cached.payload) as OcrLine[];
 if(!config.POSTER_OCR_URL || !config.POSTER_OCR_TOKEN)throw new Error('NOT_CONFIGURED');
 const result=await fetch(config.POSTER_OCR_URL,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/octet-stream',Authorization:'Bearer '+config.POSTER_OCR_TOKEN},body:bytes,signal:AbortSignal.timeout(35000)});
 if(!result.ok)throw new Error('OCR');
 const data=JSON.parse(new TextDecoder().decode(await bounded(result,200000))) as {lines?:OcrLine[]};
 if(!Array.isArray(data.lines) || data.lines.length>1000 || data.lines.some(l=>typeof l.text!=='string' || l.text.length>2000 || !Number.isFinite(l.confidence)))throw new Error('INVALID');
 await db.prepare('INSERT INTO poster_ocr (hash,payload,created_at) VALUES (?,?,?) ON CONFLICT(hash) DO NOTHING').bind(hash,JSON.stringify(data.lines),Date.now()).run();return data.lines;
}
export async function enrichPoster(event:CampusEvent):Promise<CampusEvent> {
 if(!event.posters.length)return event;
 const titleYear=event.title.match(/(?:^|[^\d])(20\d{2})(?:년|학년도|[- ]?[12]학기)/)?.[1];
 if(titleYear && Number(titleYear)<new Date().getFullYear())return event;
 try {
  const schedules=[];let unresolved=false;
  for(const url of event.posters){const schedule=extractPosterSchedule(await recognize(url),event.title);if(schedule)schedules.push(schedule);else unresolved=true;}
  const unique=[...new Map(schedules.map(s=>[`${s.date}:${s.start}:${s.end}`,s])).values()];
  if(unique.length!==1 || unresolved)return {...event,ocr:{status:'review',message:'포스터 일정이 불명확하거나 여러 회차일 수 있어요. 원문을 확인해 주세요.'}};
  const s=unique[0];
  if(s.confidence<0.9)return {...event,ocr:{status:'review',message:'OCR 일정 후보 · 원본 확인 필요',evidence:`${s.date} ${Math.floor(s.start/60)}:${String(s.start%60).padStart(2,'0')}–${Math.floor(s.end/60)}:${String(s.end%60).padStart(2,'0')} · ${s.evidence}${s.yearFromTitle?' · 연도는 공지 제목 기준':''}`}};
  if(event.date && (event.date!==s.date || event.start!==s.start || event.end!==s.end))return {...event,date:null,start:null,end:null,ocr:{status:'review',message:'본문과 포스터의 일정이 달라 자동 비교를 보류했어요.'}};
  return {...event,date:s.date,start:s.start,end:s.end,ocr:{status:'read',message:s.yearFromTitle?'포스터 OCR · 연도는 공지 제목 기준':'포스터 OCR',evidence:s.evidence}};
 } catch(error) {console.warn('Poster OCR unavailable',error instanceof Error && /^[A-Z_]+$/.test(error.message)?error.message:'CONNECTION_OR_STORAGE');return {...event,ocr:{status:'unavailable',message:'포스터 분석 연결이 지연되고 있어요.'}};}
}
