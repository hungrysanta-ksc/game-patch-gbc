import {check} from './source.mjs';
import {diagnosticStorage} from './scene-resource-contract.mjs';
// Half-open CPU ranges in WRAM bank 1. Fixed bank 0 contains GameState,
// audio queue/engine/IRQ state and linker-owned statics; storage is banked.
export function memoryLayout(symbols,{explore}){
 const stackFloor=explore?0xdcb0:0xdb70;
 const regions=[
  ['map_workspace',0xd000,0xd7ef,'active field'],['map_pad',0xd7ef,0xd7f0,'alignment'],
  ['map_guard',0xd7f0,0xd800,'guard'],['text_cells',0xd800,0xd940,'active window'],
  ['cell_guard',0xd940,0xd950,'guard'],['text_staging',0xd950,0xda50,'VBlank DMA'],
  ['text_pad',0xda50,0xda60,'alignment'],['text_lookup',0xda60,0xdb60,'active window'],
  ['text_guard',0xdb60,0xdb70,'guard'],
  ...(explore?[
   ['field',0xdb70,0xdbc0,'active field, 80-byte reservation'],
   ['field_staging',0xdbc0,0xdc00,'VBlank strip'],['field_oam',0xdc00,0xdca0,'OAM DMA'],
   ['field_guard',0xdca0,0xdcb0,'guard']]:[]),
  ['stack',stackFloor,0xe000,'always bank 1']
 ].map(([name,begin,end,owner])=>({name,bank:1,begin,end,bytes:end-begin,owner}));
 let end=0xd000;for(const r of regions){check(r.begin===end&&r.end>r.begin,'WRAM overlap/gap '+r.name);end=r.end;}
 check(end===0xe000,'WRAM window coverage');
 for(const name of ['map_workspace','text_cells','text_staging','text_lookup',...(explore?['field','field_staging','field_oam']:[])])check(symbols['_'+name]===regions.find(r=>r.name===name).begin,'WRAM placement '+name);
 const fixedEnd=symbols.s__HEAP;check(fixedEnd<=0xcf00,'Keep at least 256 bytes of fixed WRAM headroom');
 for(const [name,bytes]of [['ff3_game_state',1024],['native_queue',1024],['native_consumed',12],['memory_bridge',16],['ff3_state',216]])check(symbols['_'+name]>=0xc000&&symbols['_'+name]+bytes<=fixedEnd,'IRQ/fixed residency '+name);
 for(const name of ['ff3_wram_copy','ff3_wram_transfer','ff3_memory_init'])check(symbols['_'+name]<0x4000,'Mapped transfer must stay in fixed ROM '+name);
 check(symbols._native_snapshot===undefined&&symbols._native_snapshot_bank<0x4000,'Snapshots relocated to storage');
 return {fixedBegin:0xc000,fixedEnd,fixedFreeBytes:0xd000-fixedEnd,minFixedFreeBytes:256,stackFloor,stackBytes:0xe000-stackFloor,regions,
  scope:'Exploration/text diagnostic placement only; fixed RAM and stack checks are not a combined scene link.',
  storage:diagnosticStorage(),
  contract:'SVBK=1 for code/stack/IRQ/DMA. This diagnostic uses <=16-byte IE-masked leaf copies for storage. Other diagnostics have additional bounded VBlank readers. No bank is granted for field suspension; combined GameState/audio/video ownership and gameplay mode dispatch remain pending.'};
}
export function checkTransferCode(rom,symbols){
 const a=symbols._ff3_wram_transfer,z=symbols._ff3_wram_copy,b=rom.subarray(a,z);
 // Exact fixed-toolchain leaf structure, with variable little-endian data addresses.
 // The two loops may only load/store via DE/HL, increment, decrement and branch.
 const prefix=[...(symbols._item_visible!==undefined?[0xf0,0x44,0xfe,96,0x38,4,0xfe,98,0x38,0xf6]:[]),0xf0,0x44,0xfe,141,0x38,4,0xfe,144,0x38,symbols._item_visible!==undefined?0xec:0xf6];
 const guard=symbols._item_visible!==undefined?[0xf0,0x44,0xfe,96,0x38,9,0xfe,98,0x30,5,0xf1,0xe0,0xff,0x18,0xd7]:[];
 const template=[...prefix,0xf0,0xff,0xf5,0xaf,0xe0,0xff,...guard,0xfa,null,null,0x5f,0xfa,null,null,0xc6,0xd0,0x57,0xfa,null,null,0x6f,0xfa,null,null,0x67,0xfa,null,null,0x47,0xfa,null,null,0xb7,0x28,13,0xfa,null,null,0xe0,0x70,0x2a,0x12,0x13,0x05,0x20,0xfa,0x18,11,0xfa,null,null,0xe0,0x70,0x1a,0x22,0x13,0x05,0x20,0xfa,0x3e,1,0xe0,0x70,0xf1,0xe0,0xff,0xc9];
 check(b.length===template.length&&template.every((x,i)=>x===null||x===b[i]),'Unexpected bank-copy machine code; review stack/IRQ safety before accepting');
 for(const at of [7,11,17,21,25,29,35,48]){const address=b.readUInt16LE(at+prefix.length+guard.length);check(address>=0xc000&&address<symbols.s__HEAP,'Transfer operand must stay in fixed WRAM');}
 return {address:a,bytes:b.length,mappedBytesMax:16,irqMask:'IE saved/restored, IME unchanged',romBytes:b.toString('hex')};
}
