// GoDaddy may invoke its Preview entrypoint with NODE_ENV=development.
// Always compile ahead of startup; never run a runtime watch compiler.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'build','--webpack'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,NODE_ENV:'production'},stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>{console.error('Unable to start production build.');process.exitCode=1});child.on('exit',code=>{process.exitCode=code??1});
