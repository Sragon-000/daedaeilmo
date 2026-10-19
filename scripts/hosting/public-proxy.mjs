import http from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const target='http://localhost:3000';
const institutionVisibility=resolve('.local-host/institution-preview-public');
const institutionPilotVisibility=resolve('.local-host/institution-pilot-public');
function institutionPreviewEnabled(){
 try{return readFileSync(institutionVisibility,'utf8').trim()==='enabled';}
 catch(error){return error?.code==='ENOENT';}
}
function institutionPilotEnabled(){
 try{return readFileSync(institutionPilotVisibility,'utf8').trim()==='enabled';}
 catch{return false;}
}
const apis=new Set(['/api/school-auth','/api/profile','/api/avatar','/api/timetable','/api/events','/api/event-saves','/api/event-opens','/api/notices','/api/reviews','/api/preview/events','/api/programs','/api/applications','/api/institution-auth','/api/institution-programs','/api/institution-applications']);
const rates=new Map();
http.createServer((req,res)=>{
 let publicUrl;try{publicUrl=new URL(readFileSync(resolve('.local-host/public-url'),'utf8').trim());}catch{res.writeHead(503);res.end('Starting');return;}
 if(req.headers.host!==publicUrl.host){res.writeHead(403);res.end('Forbidden');return;}
 if(req.headers['x-forwarded-proto']!=='https'){res.writeHead(308,{Location:publicUrl.origin+req.url});res.end();return;}
 const url=new URL(req.url,publicUrl),method=req.method || 'GET';
 if(url.pathname==='/institution-preview' && !institutionPreviewEnabled()){res.writeHead(404);res.end();return;}
 if((url.pathname==='/institution' || ['/api/programs','/api/applications','/api/institution-auth','/api/institution-programs','/api/institution-applications'].includes(url.pathname)) && !institutionPilotEnabled()){res.writeHead(404);res.end();return;}
 const preview=url.pathname==='/preview' || url.pathname==='/institution-preview' || url.pathname==='/api/preview/events';
 const allowed=url.pathname==='/' || url.pathname==='/favicon.svg' || url.pathname==='/experiment' || url.pathname==='/preview' || url.pathname==='/institution-preview' || url.pathname==='/institution' || /^\/_next\/static\/[a-zA-Z0-9_./-]+\.(js|css|woff2?|png|svg)$/.test(url.pathname) || apis.has(url.pathname);
 if(!allowed || !['GET','HEAD','POST','DELETE','PATCH'].includes(method)){res.writeHead(404);res.end();return;}
 if(!['GET','HEAD'].includes(method) && req.headers.origin!==publicUrl.origin){res.writeHead(403);res.end('Forbidden origin');return;}
 if(url.pathname.startsWith('/api/')){
  const key=String(req.headers['cf-connecting-ip'] || 'unknown')+((url.pathname==='/api/school-auth'||url.pathname==='/api/institution-auth'||url.pathname==='/api/experiment/access')&&method==='POST'?':login':':api'),now=Date.now();
  let rate=rates.get(key);if(!rate || rate.until<now){rate={count:0,until:now+60000};rates.set(key,rate);}
  if(++rate.count>(key.endsWith(':login')?10:120)){res.writeHead(429,{'Retry-After':'60'});res.end();return;}
  if(rates.size>10000)for(const [key,value] of rates)if(value.until<now)rates.delete(key);
 }
 // Verify the public Origin above before translating to the private loopback origin.
 const headers={...req.headers,host:'localhost:3000'};
 if(headers.origin)headers.origin=target;
 delete headers['x-forwarded-host'];delete headers['x-forwarded-proto'];delete headers.forwarded;
 const upstream=http.request(target+url.pathname+url.search,{method,headers},response=>{
  const out={...response.headers,'x-content-type-options':'nosniff','referrer-policy':preview?'no-referrer':'same-origin'};
  if(out['set-cookie'])out['set-cookie']=out['set-cookie'].map(c=>/;\s*secure\b/i.test(c)?c:c+'; Secure');
  res.writeHead(response.statusCode || 502,out);response.pipe(res);
 });
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Service unavailable');});
 req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
}).listen(3010,'127.0.0.1',()=>console.log('Public HTTPS gateway ready on loopback port 3010'));
