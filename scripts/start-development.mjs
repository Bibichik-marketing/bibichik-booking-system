import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(process.env.NODE_ENV==='production'){console.error('Development server is disabled under NODE_ENV=production. Build first, then use npm start.');process.exit(1)}
const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'dev',...process.argv.slice(2)],{cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'inherit',env:{...process.env,NODE_ENV:'development'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>{console.error('Development server failed to start.');process.exitCode=1});child.on('exit',code=>{process.exitCode=code??1});
