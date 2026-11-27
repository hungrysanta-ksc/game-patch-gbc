import {check,hash} from './source.mjs';
// Semantic fields already ported. Other addresses are NOT presumed zero or
// assigned a fabricated GBC location. Window/graphics scratch is platform-local.
const field=new Map([[0x20,'keys'],[0x21,'pressed'],[0x29,'x'],[0x2a,'y'],[0x33,'direction'],[0x34,'speed'],[0x35,'subx'],[0x36,'suby'],[0x43,'current'],[0x44,'next'],[0x45,'property'],[0x48,'map'],[0x4a,'npc_cursor'],[0x67,'npc_tile'],[0x68,'reserved_x'],[0x69,'reserved_y'],[0x6a,'battle'],[0x6b,'battle_background'],[0x78,'world'],[0x84,'target_x'],[0x85,'target_y'],[0xa5,'z'],[0xf0,'frame'],[0xf4,'npc_rng'],[0xf5,'rng_index'],[0xf6,'rng_direction'],[0xf7,'formation_rng'],[0xf8,'rate']]);
const overwritten=new Set([0,1,...Array.from({length:15},(_,i)=>i+3),0x7e,0xa9,0xaa,0xab,0xac,0xb8,0xc9,0xca,0xcb,0xcc]);
export function seedOwnership(){return Array.from({length:256},(_,address)=>({address,role:overwritten.has(address)?'battle-prefix':field.has(address)?'ported-field':address>=0xd0&&address<=0xd9?'audio-local-scratch':'other-source-state',...(field.has(address)?{field:field.get(address)}:{})}));}
export function sourceSeedWriters(rom,asm){
 const direct=new Set([0x85,0x86,0x84,0xc6,0xe6,0x06,0x46,0x26,0x66]),absolute=new Set([0x8d,0x8e,0x8c,0xce,0xee,0x0e,0x4e,0x2e,0x6e]),indirect=new Set([0x81,0x91]),indexed=new Set([0x95,0x96,0x94,0xd6,0xf6,0x16,0x56,0x36,0x76,0x9d,0x99]);
 const writers=[],dynamic=[];
 for(const [line,text]of asm.split(/\r?\n/).entries()){
  const m=text.match(/^([\dA-F]{2})\/([\dA-F]{4}): ((?:[\dA-F]{2} )+)\s*(STA|STX|STY|INC|DEC|ASL|LSR|ROL|ROR)\b/);if(!m)continue;
  const bank=parseInt(m[1],16),pc=parseInt(m[2],16);if(bank<0x36)continue;
  const b=Buffer.from(m[3].trim().split(/ +/).map(v=>parseInt(v,16))),op=b[0],at=b.length===3?b.readUInt16LE(1):b[1];
  if(!direct.has(op)&&!absolute.has(op)&&!indexed.has(op)&&!indirect.has(op))continue;
  if(!indirect.has(op)&&at>255)continue;
  const offset=16+bank*8192+(pc&8191);check(rom.subarray(offset,offset+b.length).equals(b),'Disassembly writer differs from ROM at '+m[1]+'/'+m[2]);
  const site={bank,cpu:pc,line:line+1,bytesHash:hash(b)};
  if(direct.has(op)||absolute.has(op))writers.push({...site,address:at});else dynamic.push({...site,mode:indirect.has(op)?'indirect':'indexed',base:at});
 }
 check(writers.length>0,'No source writers found');return {writers,dynamic};
}
