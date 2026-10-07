export type OcrLine = {text:string;confidence:number};
export type PosterSchedule = {date:string;start:number;end:number;evidence:string;yearFromTitle:boolean;confidence:number};
export function extractPosterSchedule(lines:OcrLine[],title:string):PosterSchedule|null {
 const candidates:PosterSchedule[]=[];
 for(let i=0;i<lines.length;i++) {
  if(!/(?:행사|특강|교육|강연|진행|운영)?\s*일시|행사일정/.test(lines[i].text) || /신청|접수|모집/.test(lines[i].text))continue;
  const selected=[lines[i]];
  for(let j=i+1;j<Math.min(i+3,lines.length);j++) {
   if(/장소|주제|신청|접수|모집|대상|혜택|문의|일시/.test(lines[j].text))break;selected.push(lines[j]);
  }
  if(selected.some(l=>l.confidence<0.5))continue;
  const text=selected.map(l=>l.text).join(' ').normalize('NFKC');
  const dateMatches=[...text.split(/\d{1,2}:\d{2}/)[0].matchAll(/(?:(20\d{2})\s*[년./-]\s*)?(\d{1,2})\s*[월./-]\s*(\d{1,2})\s*(?:일|\.)?/g)];
  if(dateMatches.length!==1 || /매주|격주|매월|부터|까지|익일|회차/.test(text))continue;
  const match=dateMatches[0];
  const titleYears=[...new Set(title.match(/20\d{2}/g) || [])];
  const y=Number(match[1] || (titleYears.length===1?titleYears[0]:0)),m=+match[2],d=+match[3];
  if(!y)continue;
  const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()!==y || date.getUTCMonth()!==m-1 || date.getUTCDate()!==d)continue;
  const weekday=/[（(]([일월화수목금토])(?:요일)?[)）]/.exec(text)?.[1];if(weekday && '일월화수목금토'[date.getUTCDay()]!==weekday)continue;
  const times=[...text.matchAll(/(\d{1,2}):(\d{2})/g)];
  if(times.length<1 || times.length>2 || times.some(t=>+t[1]>=24 || +t[2]>=60))continue;
  // Reject date ranges, even when their second date omits the month.
  const beforeTime=text.slice(0,times[0].index);if(/[~∼～]|\d\s*[-–]\s*\d/.test(beforeTime.replace(match[0],'')))continue;
  if(/오전|오후/.test(text))continue;
  const start=+times[0][1]*60 + +times[0][2];
  const duration=/(\d+(?:\.\d+)?)\s*(?:H\b|시간)/i.exec(text);
  const end=times.length===2?+times[1][1]*60 + +times[1][2]:duration?start+Number(duration[1])*60:NaN;
  if(!Number.isInteger(end) || end<=start || end>=1440)continue;
  candidates.push({date:`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,start,end,evidence:text.slice(0,300),yearFromTitle:!match[1],confidence:Math.min(...selected.map(l=>l.confidence))});
 }
 return candidates.length===1?candidates[0]:null;
}
