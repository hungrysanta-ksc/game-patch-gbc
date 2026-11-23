import {check} from './source.mjs';import {sourceNumber} from './dialogue-source.mjs';
// Expand from the private compiled tokens and explicit runtime context. No GBC
// output buffers are used to build the expected stream.
export function expandDialogue(assets,sourceId,context){
 const out=[];let last=65535;
 const emit=w=>{out.push(w);if(w>=0x8000&&![255,0xc9,0xc0].includes(w&0x7fff))last=w&0x7fff;};
 const run=(id,depth)=>{check(depth<=3,'Nested text depth');const i=assets.text.sourceIds.indexOf(id);check(i>=0,'Missing reviewed text '+id);const m=assets.text.messages[i];
  for(let at=0;at<m.length;at+=2){let w=m.readUInt16LE(at);if(w===0||w===10){if(!depth)out.push(w);return;}
   if(w===2){last=65535;if(context.item)run(1024+context.item,depth+1);continue;}
   if(w===3||w===4||w===5){const value=w===3?assets.groups.itemPrices[0].readUInt16LE(context.item*2):w===4?context.variable:context.gil;for(const c of sourceNumber(value,w===5?7:6))emit(0x8000+c);continue;}
   if(w===12||w>=16&&w<=19){let slot=context.shown>>6;if(w!==12){slot=w-16;at+=2;check(m.readUInt16LE(at)===2,'Unsupported character string');}check(slot<4&&!(context.shown&63),'Shown character offset');for(const c of context.names.slice(slot*6,slot*6+6))emit(0x8000+c);continue;}
   if(w===64){check(last>=256&&last<2606,'Unknown particle final');const a=m.readUInt16LE(at+2),b=m.readUInt16LE(at+4);at+=4;emit(0x8000+((assets.groups.jong[0][(last-256)>>3]&(1<<((last-256)&7)))?a:b));continue;}
   emit(w);if(w>=16&&w<40){at+=2;out.push(m.readUInt16LE(at));}
  }throw Error('Expanded string has no terminator');
 };run(sourceId,0);const b=Buffer.alloc(out.length*2);out.forEach((v,i)=>b.writeUInt16LE(v,i*2));return b;
}
