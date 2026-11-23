import fs from 'node:fs/promises';
import {ROOT,check} from './source.mjs';
export async function memoryAudit(){return '\n'+await fs.readFile(ROOT+'/tools/memory-audit.lua','utf8');}
export function checkMemoryAudit(log){
 const m=[...log.matchAll(/memory-audit:(\d+),(\d+),([\d.]+),(\d+)/g)].at(-1);
 check(m,'Missing WRAM bank audit');const [copies,faults,maxMappedSeconds,interrupts]=m.slice(1).map(Number);
 check(copies>100&&!faults&&maxMappedSeconds>0&&maxMappedSeconds<0.0001&&interrupts>100,'WRAM/stack/IRQ contract '+m[0]);
 return {copies,faults,maxMappedSeconds,interrupts};
}
