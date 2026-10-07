import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, unlinkSync } from 'node:fs';
import net from 'node:net';
const script=fileURLToPath(import.meta.url),root=resolve(dirname(script),'../..');
const state=resolve(root,'.local-host');mkdirSync(state,{recursive:true});
const pidFile=resolve(state,'host.pid'),logFile=resolve(state,'host.log');
function current(){try{const pid=Number(readFileSync(pidFile,'utf8'));if(!Number.isInteger(pid)||pid<2)return null;const cmd=execFileSync('ps',['-p',String(pid),'-o','command='],{encoding:'utf8'});return cmd.includes(script+' run')?pid:null;}catch{return null;}}
const mode=process.argv[2] || 'start';
const publicMode=mode==='public' || mode==='run-public';
if(mode==='status'){console.log(current()?'Mac hosting is running. http://localhost:3000/':'Mac hosting is stopped.');}
else if(mode==='stop'){const pid=current();if(pid){process.kill(-pid,'SIGTERM');console.log('Mac hosting stopped.');}else console.log('Mac hosting is already stopped.');}
else if(mode==='start' || mode==='public'){
 if(current()){console.log('Already running: http://localhost:3000/');process.exit(0);}
 for(const port of [3000,4318,...(publicMode?[3010]:[])])await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(new Error(`Port ${port} is occupied. Stop its existing server before starting Mac hosting.`)));server.listen(port,'localhost',()=>server.close(resolve));});
 if(!existsSync(resolve(root,'.local-ocr/recognize')))throw new Error('Run npm run ocr:build first.');
 if(!existsSync(resolve(root,'dist/server/index.js')))throw new Error('Run npm run build first.');
 const fd=openSync(logFile,'a',0o600),child=spawn(process.execPath,[script,publicMode?'run-public':'run'],{cwd:root,detached:true,stdio:['ignore',fd,fd]});child.unref();
 console.log('Starting Mac app + OCR. Address: http://localhost:3000/');console.log('Log: '+logFile);
}
else if(mode==='run' || mode==='run-public'){
 writeFileSync(pidFile,String(process.pid),{mode:0o600});
 const children=[];let stopping=false;
 function stop(){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');try{if(readFileSync(pidFile,'utf8').trim()===String(process.pid))unlinkSync(pidFile);}catch{}setTimeout(()=>process.exit(0),1000);}
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
 const config=JSON.parse(readFileSync(resolve(root,'dist/server/wrangler.json'),'utf8'));
 config.main=resolve(root,'dist/server/index.js');config.assets.directory=resolve(root,'dist/client');
 writeFileSync(resolve(state,'worker.json'),JSON.stringify(config));
 writeFileSync(resolve(state,'.dev.vars'),readFileSync(resolve(root,'.dev.vars')),{mode:0o600});
 try{unlinkSync(resolve(state,'public-url'));}catch{}
 const jobs=[['python3',['scripts/ocr/server.py']],['npx',['wrangler','dev','--config',resolve(state,'worker.json'),'--ip','localhost','--port','3000','--persist-to',resolve(root,'.wrangler/state'),'--log-level','warn']],['/usr/bin/caffeinate',['-i']]];
 if(publicMode)jobs.push([process.execPath,['scripts/hosting/public-proxy.mjs']],['cloudflared',['tunnel','--no-autoupdate','--url','http://127.0.0.1:3010','--protocol','http2']]);
 for(const [cmd,args] of jobs){
  const isTunnel=cmd==='cloudflared';
  const child=spawn(cmd,args,{cwd:root,env:{...process.env,WRANGLER_LOG_PATH:resolve(root,'.wrangler/logs'),MINIFLARE_REGISTRY_PATH:resolve(root,'.wrangler/registry')},stdio:isTunnel?['ignore','pipe','pipe']:'inherit'});children.push(child);
  if(isTunnel)for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{const text=chunk.toString();process.stdout.write(text);const url=text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(url)writeFileSync(resolve(state,'public-url'),url[0]);});
  child.on('error',stop);child.on('exit',()=>{if(!stopping)stop();});
 }
 console.log('Mac hosting started. Keep the Mac powered on; closing the lid may still put it to sleep.');
}else throw new Error('Use start, stop, or status.');
