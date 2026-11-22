import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const ROOT=fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function check(ok,s){if(!ok)throw Error(s);}
export async function input(){let local={};try{local=JSON.parse(await fs.readFile(ROOT+'/local.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const arg=process.argv.indexOf('--rom'),rom=arg<0?local.rom:process.argv[arg+1];check(rom,'Pass --rom PATH or create local.json');const data=await fs.readFile(rom),profile=JSON.parse(await fs.readFile(ROOT+'/spec/source.json','utf8'));check(data.length===profile.size&&hash(data)===profile.sha256,'Unsupported original ROM');return{data,profile,local,rom};}
