import {stateCpu} from './state-source.mjs';
import {check} from './source.mjs';

// Explicit GBC contract, not NES address reconstruction. No pointers, frame
// preparation costs, diagnostics or padding participate. Keep C offsetof list
// and this independent diagnostic layout in the same documented order.
export const playSeedFields=[['x',0],['y',1],['subx',2],['suby',3],['direction',4],['speed',5],['z',6],['current',7],['next',8],['property',9],['trigger',10],['keys',17],['previous',18],['world',23],['map',24],['rate',25],['rng_index',14],['rng_direction',15],['npc_cursor',67],['npc_rng',68],['reserved_x',70],['reserved_y',71],['formation_rng',76],['battle',77],['battle_background',78],['frame',73],['dialogue_frame',74],['steps.low',28],['steps.high',29],['ticks.low',32],['ticks.high',33]];
export function playSeedInput(field,audio){check(field.length===79&&audio.length===192,'Complete logical seed owners');return Buffer.concat([Buffer.from(playSeedFields.map(([,i])=>field[i])),audio]);}
export function playSeedOriginal(rom,field,audio){
 const input=playSeedInput(field,audio),c=stateCpu(rom);c.m.set(input);c.a=0;c.p=0x24;c.pc=0xfc27;c.step();
 // Execute the original ADC/INX/BNE loop for this explicitly shorter input.
 // The platform contract changes the input extent, never the carry behavior.
 for(let i=0;i<input.length;i++){check(c.pc===0xfc29&&c.x===i,'Original ADC boundary');c.step();c.step();c.step();}
 return c.a;
}
export function playSeedCases(){
 const rows=[];
 for(let i=0;i<271;i++)for(const value of [1,255]){const b=Buffer.alloc(272);b[i]=value;b[271]=0xa5;rows.push(b);}
 for(let n=0;n<256;n++){const b=Buffer.from(Array.from({length:272},(_,i)=>(i*37+n*19)&255));rows.push(b);}
 rows.push(Buffer.alloc(272,255));return rows;
}
