import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const ROOT=fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function check(ok,s){if(!ok)throw Error(s);}
export function checkGbc(rom,banks,type=0x19,ram=0){check(rom.length===banks*16384&&rom[0x143]===0xc0&&rom[0x147]===type&&rom[0x149]===ram,'CGB/MBC5 header mismatch');let h=0,sum=0;for(let i=0x134;i<=0x14c;i++)h=(h-rom[i]-1)&255;for(let i=0;i<rom.length;i++)if(i!==0x14e&&i!==0x14f)sum=(sum+rom[i])&65535;check(h===rom[0x14d]&&sum===rom.readUInt16BE(0x14e),'GBC checksums');}
export async function input(){let local={};try{local=JSON.parse(await fs.readFile(ROOT+'/local.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const arg=process.argv.indexOf('--rom'),rom=arg<0?local.rom:process.argv[arg+1];check(rom,'Pass --rom PATH or create local.json');const data=await fs.readFile(rom),profile=JSON.parse(await fs.readFile(ROOT+'/spec/source.json','utf8'));check(data.length===profile.size&&hash(data)===profile.sha256,'Unsupported original ROM');return{data,profile,local,rom};}
