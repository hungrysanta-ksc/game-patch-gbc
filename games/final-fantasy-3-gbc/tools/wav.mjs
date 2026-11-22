import {check} from './source.mjs';
export function readWav(b){
 check(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE','Not WAV');let fmt,pcm;
 for(let i=12;i+8<=b.length;){const n=b.readUInt32LE(i+4),s=b.subarray(i+8,i+8+n);check(s.length===n,'Truncated WAV chunk');if(b.toString('ascii',i,i+4)==='fmt ')fmt=s;if(b.toString('ascii',i,i+4)==='data')pcm=s;i+=8+n+(n&1);}
 check(fmt&&pcm&&fmt.readUInt16LE(0)===1&&fmt.readUInt16LE(14)===16,'Expected PCM16 WAV');
 const channels=fmt.readUInt16LE(2),rate=fmt.readUInt32LE(4);let peak=0,power=0,nonzero=0,clipped=0;
 for(let i=0;i<pcm.length;i+=2){const v=pcm.readInt16LE(i);peak=Math.max(peak,Math.abs(v));power+=v*v;if(v)nonzero++;if(Math.abs(v)>=32767)clipped++;}
 return{pcm,channels,rate,seconds:pcm.length/(2*channels*rate),peak:peak/32768,rms:Math.sqrt(power/(pcm.length/2))/32768,nonzero,clipped};
}
export function writeWav(pcm,rate=48000,channels=2){const b=Buffer.alloc(44+pcm.length);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*channels*2,28);b.writeUInt16LE(channels*2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(pcm.length,40);pcm.copy(b,44);return b;}
export function gainPcm(pcm,gain){const out=Buffer.alloc(pcm.length);for(let i=0;i<pcm.length;i+=2)out.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(pcm.readInt16LE(i)*gain))),i);return out;}
