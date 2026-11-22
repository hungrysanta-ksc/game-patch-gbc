// Locally generated verification ROM: original driver/music remain intact.
// Replaces only fixed-bank $E000 harness and vectors. Never distributed.
export function nesHarness(original,clip){
 const rom=Buffer.from(original),base=0xe000,code=[],labels={},fix=[];
 const emit=(...b)=>code.push(...b),label=n=>labels[n]=base+code.length;
 const abs=(op,n)=>{emit(op,0,0);fix.push({at:code.length-2,n,relative:false});};
 const branch=(op,n)=>{emit(op,0);fix.push({at:code.length-1,n,relative:true});};
 const lda=n=>emit(0xa9,n),sta=a=>emit(0x8d,a&255,a>>8),jsr=a=>emit(0x20,a&255,a>>8);
 label('reset');emit(0x78,0xd8,0xa2,0xff,0x9a);lda(0);sta(0x2000);sta(0x2001);sta(0x4010);lda(0x40);sta(0x4017);lda(0x80);sta(0xa001);lda(0);sta(0xe000);
 // Clear internal and cartridge RAM before initializing source sound state.
 emit(0xa2,0);label('clear');for(let p=0;p<8;p++)emit(0x9d,0,p);for(let p=0x60;p<0x80;p++)emit(0x9d,0,p);emit(0xe8);branch(0xd0,'clear');
 lda(6);sta(0x8000);lda(0x36);sta(0x8001);lda(7);sta(0x8000);lda(0x37);sta(0x8001);jsr(0x8000);lda(0x80);sta(0x2000);lda(0xa5);sta(0x6000);
 label('wait');emit(0xad,1,0x60);branch(0xf0,'wait');
 if(clip.song!==null){lda(clip.song);sta(0x7f43);lda(1);sta(0x7f42);}
 // NMI counter avoids the NES $2002 polling/vblank suppression race.
 emit(0xad,5,0x60);sta(0x6006);label('frame');emit(0xad,5,0x60,0xcd,6,0x60);branch(0xf0,'frame');sta(0x6006);
 lda(1);sta(0x6007);
 for(let i=0;i<clip.effects.length;i++){const e=clip.effects[i];emit(0xad,2,0x60,0xc9,e.frame&255);branch(0xd0,'fx'+i);emit(0xad,3,0x60,0xc9,e.frame>>8);branch(0xd0,'fx'+i);lda(e.id|128);sta(0x7f49);label('fx'+i);}
 jsr(0x8003);emit(0xee,2,0x60);branch(0xd0,'counted');emit(0xee,3,0x60);label('counted');
 lda(0);sta(0x6007);
 emit(0xad,2,0x60,0xc9,clip.frames&255);branch(0xd0,'again');emit(0xad,3,0x60,0xc9,clip.frames>>8);branch(0xd0,'again');label('done');abs(0x4c,'done');label('again');abs(0x4c,'frame');label('irq');emit(0xee,5,0x60,0x40);
 for(const f of fix){if(f.relative){const delta=labels[f.n]-(base+f.at+1);if(delta< -128||delta>127)throw Error('Branch too far '+f.n);code[f.at]=delta&255;}else{code[f.at]=labels[f.n]&255;code[f.at+1]=labels[f.n]>>8;}}
 if(code.length>0x1ffa)throw Error('Harness too large');const begin=16+0x3f*8192;Buffer.from(code).copy(rom,begin);rom.writeUInt16LE(labels.irq,rom.length-6);rom.writeUInt16LE(labels.reset,rom.length-4);rom.writeUInt16LE(labels.irq,rom.length-2);
 for(let i=0;i<rom.length;i++)if(rom[i]!==original[i]&&!((i>=begin&&i<begin+code.length)||i>=rom.length-6))throw Error('Unplanned reference ROM write');return rom;
}
