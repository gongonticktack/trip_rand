import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const root=new URL('../',import.meta.url),file=new URL('.runtime/ip-secret.json',root);
await mkdir(new URL('.runtime/',root),{recursive:true});
try{JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(file,JSON.stringify({TRIP_RAND_IP_SECRET:randomBytes(32).toString('hex')}),{flag:'wx'});}
console.log('Server-only IP secret is ready. No secret value printed.');
