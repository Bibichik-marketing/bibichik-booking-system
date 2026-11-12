// Start only an existing production build. Never compile endpoints at runtime.
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const port=process.env.PORT||'3000';
if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535){console.error('Invalid PORT: expected integer 1–65535.');process.exit(1)}
if(!existsSync(new URL('../.next/BUILD_ID',import.meta.url))){console.error('Production build missing. Run npm run build before npm start.');process.exit(1)}
const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'start','--hostname',process.env.BIBICHIK_BIND_HOST||'0.0.0.0','--port',port],{cwd:root,env:{...process.env,NODE_ENV:'production'},stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>{console.error('Unable to start production server.');process.exitCode=1});
child.on('exit',(code)=>{process.exitCode=code??1});
