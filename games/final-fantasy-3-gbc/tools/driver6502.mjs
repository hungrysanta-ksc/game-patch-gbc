// Build-time execution of the user's original sound driver. Unsupported opcodes
// fail closed. This is not a NES emulator: PPU, IRQ and APU synthesis are absent.
export class Driver6502 {
 constructor(rom){this.rom=rom;this.m=new Uint8Array(65536);this.banks=[0x36,0x37,0x3e,0x3f];this.a=this.x=this.y=0;this.p=0x24;this.s=255;this.writes=[];this.steps=0;this.opcodes=new Set();}
 read(a){a&=65535;if(a>=0x8000)return this.rom[16+this.banks[(a-0x8000)>>13]*8192+(a&8191)];return this.m[a<0x2000?a&2047:a];}
 write(a,v){a&=65535;v&=255;if(a===0x8000)this.reg=v&7;else if(a===0x8001){if(this.reg===6)this.banks[0]=v&63;else if(this.reg===7)this.banks[1]=v&63;else throw Error('Unexpected mapper register '+this.reg);}else if(a>=0x8000)throw Error('Unexpected mapper write '+a.toString(16));else{this.m[a<0x2000?a&2047:a]=v;if(a>=0x4000&&a<=0x4017)this.writes.push([a,v]);}}
 nz(v){v&=255;this.p=(this.p&0x7d)|(v?0:2)|(v&128);return v;}
 flag(f,v){this.p=v?this.p|f:this.p&~f;}
 push(v){this.write(0x100+this.s,v);this.s=(this.s-1)&255;}
 pop(){this.s=(this.s+1)&255;return this.read(0x100+this.s);}
 byte(){const v=this.read(this.pc);this.pc=(this.pc+1)&65535;return v;}
 word(){const l=this.byte();return l|(this.byte()<<8);}
 addr(mode){let a;switch(mode){case 'imm':a=this.pc;this.pc=(this.pc+1)&65535;return a;case 'zp':return this.byte();case 'zpx':return(this.byte()+this.x)&255;case 'zpy':return(this.byte()+this.y)&255;case 'abs':return this.word();case 'abx':return(this.word()+this.x)&65535;case 'aby':return(this.word()+this.y)&65535;case 'inx':a=(this.byte()+this.x)&255;return this.read(a)|(this.read((a+1)&255)<<8);case 'iny':a=this.byte();return((this.read(a)|(this.read((a+1)&255)<<8))+this.y)&65535;}}
 adc(v){const old=this.a,n=old+v+(this.p&1);this.flag(1,n>255);this.flag(64,(~(old^v)&(old^n)&128)!==0);this.a=this.nz(n);}
 cmp(a,b){this.flag(1,a>=b);this.nz(a-b);}
 call(address){this.pc=address;this.push(0x4f);this.push(0xff);let count=0;while(this.pc!==0x5000){if(++count>200000)throw Error('Sound driver instruction budget exceeded');this.step();}return count;}
 step(){const at=this.pc,op=this.byte();this.opcodes.add(op);this.steps++;let v,a;
  if((op&3)===1){const names=['ora','and','eor','adc','sta','lda','cmp','sbc'],modes=['inx','zp','imm','abs','iny','zpx','aby','abx'];const fn=names[op>>5];a=this.addr(modes[(op>>2)&7]);v=fn==='sta'?undefined:this.read(a);switch(fn){case'ora':this.a=this.nz(this.a|v);break;case'and':this.a=this.nz(this.a&v);break;case'eor':this.a=this.nz(this.a^v);break;case'adc':this.adc(v);break;case'sta':if(((op>>2)&7)===2)throw Error('Invalid STA immediate');this.write(a,this.a);break;case'lda':this.a=this.nz(v);break;case'cmp':this.cmp(this.a,v);break;case'sbc':this.adc(v^255);break;}return;}
  if((op&31)===16){v=this.byte();const f=[128,64,1,2][op>>6],want=(op&32)!==0;if(!!(this.p&f)===want)this.pc=(this.pc+(v<128?v:v-256))&65535;return;}
  const table={0xa0:['y','imm'],0xa4:['y','zp'],0xb4:['y','zpx'],0xac:['y','abs'],0xbc:['y','abx'],0xa2:['x','imm'],0xa6:['x','zp'],0xb6:['x','zpy'],0xae:['x','abs'],0xbe:['x','aby']};
  if(table[op]){const[r,m]=table[op];this[r]=this.nz(this.read(this.addr(m)));return;}
  const stores={0x84:['y','zp'],0x94:['y','zpx'],0x8c:['y','abs'],0x86:['x','zp'],0x96:['x','zpy'],0x8e:['x','abs']};if(stores[op]){const[r,m]=stores[op];this.write(this.addr(m),this[r]);return;}
  const compares={0xc0:['y','imm'],0xc4:['y','zp'],0xcc:['y','abs'],0xe0:['x','imm'],0xe4:['x','zp'],0xec:['x','abs']};if(compares[op]){const[r,m]=compares[op];this.cmp(this[r],this.read(this.addr(m)));return;}
  if((op&3)===2&&[0,1,2,3,6,7].includes(op>>5)&&[1,2,3,5,7].includes((op>>2)&7)&&!([0xca,0xea].includes(op))){
   const kind=op>>5,mode=(op>>2)&7,acc=mode===2;if(acc&&kind>=6)throw Error('Invalid accumulator inc/dec');a=acc?0:this.addr({1:'zp',3:'abs',5:'zpx',7:'abx'}[mode]);v=acc?this.a:this.read(a);const carry=this.p&1;
   if(kind===0){this.flag(1,v&128);v<<=1;}if(kind===1){this.flag(1,v&128);v=(v<<1)|carry;}if(kind===2){this.flag(1,v&1);v>>=1;}if(kind===3){this.flag(1,v&1);v=(v>>1)|(carry<<7);}if(kind===6)v--;if(kind===7)v++;v=this.nz(v);if(acc)this.a=v;else this.write(a,v);return;
  }
  switch(op){
   case 0x20:a=this.word();v=(this.pc-1)&65535;this.push(v>>8);this.push(v&255);this.pc=a;break;
   case 0x60:this.pc=((this.pop()|(this.pop()<<8))+1)&65535;break;
   case 0x4c:this.pc=this.word();break;
   case 0x6c:a=this.word();this.pc=this.read(a)|(this.read((a&0xff00)|((a+1)&255))<<8);break;
   case 0x18:this.p&=~1;break;case 0x38:this.p|=1;break;case 0x58:this.p&=~4;break;case 0x78:this.p|=4;break;case 0xd8:this.p&=~8;break;case 0xb8:this.p&=~64;break;
   case 0x48:this.push(this.a);break;case 0x68:this.a=this.nz(this.pop());break;case 0x08:this.push(this.p|48);break;case 0x28:this.p=this.pop()|32;break;
   case 0xaa:this.x=this.nz(this.a);break;case 0x8a:this.a=this.nz(this.x);break;case 0xa8:this.y=this.nz(this.a);break;case 0x98:this.a=this.nz(this.y);break;case 0xba:this.x=this.nz(this.s);break;case 0x9a:this.s=this.x;break;
   case 0xe8:this.x=this.nz(this.x+1);break;case 0xca:this.x=this.nz(this.x-1);break;case 0xc8:this.y=this.nz(this.y+1);break;case 0x88:this.y=this.nz(this.y-1);break;
   case 0x24:case 0x2c:v=this.read(this.addr(op===0x24?'zp':'abs'));this.p=(this.p&0x3d)|(v&0xc0)|((this.a&v)?0:2);break;
   case 0xea:break;default:throw Error('Unsupported opcode '+op.toString(16)+' at '+at.toString(16));
  }
 }
}
