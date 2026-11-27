import {stateCpu} from './state-source.mjs';
import {check,hash} from './source.mjs';

// Execute the complete original prefix, including DP save, IRQ/bank setup,
// OAM clear and all 12 KiB of VRAM clear writes. Never skip a source call.
export function encounterSeedOriginal(rom,dp,flags=0,{formation=0,background=0,carry=0}={}){
 check(dp.length===256&&Number.isInteger(flags)&&flags>=0&&flags<=255,'Complete source DP and flags');
 const c=stateCpu(rom);c.m.set(dp);c.a=formation;c.x=background;c.y=flags;c.p=0x24|(carry&1);c.pc=0xfa26;
 const write=c.write.bind(c),writes=[];c.write=function(a,v){if(a<256)writes.push([a,v]);write(a,v);};
 let instructions=0;while(c.pc!==0xfc27){check(++instructions<100000,'Complete entry prefix budget');c.step();}
 const input=Buffer.from(c.m.subarray(0,256)),a=c.a,inputCarry=c.p&1,prefixInstructions=instructions;
 while(c.pc!==0xfc2e){check(++instructions<101000,'Original ADC budget');c.step();}
 const touched=[...new Set(writes.map(([at])=>at))].sort((a,b)=>a-b);
 return {seed:c.a,input,a,carry:inputCarry,touched,inherited:Array.from({length:256},(_,i)=>i).filter(i=>!touched.includes(i)),instructions,prefixInstructions,inputHash:hash(input)};
}

export function encounterSeedCases(){
 const cases=[];
 // All individual byte dependencies, including bytes which the prefix owns.
 for(let at=0;at<256;at++)for(const value of [1,255]){const dp=Buffer.alloc(256);dp[at]=value;cases.push({dp,flags:0});}
 // Carry paths plus nonzero inherited bytes: transport/flags, overflow, final ADC.
 for(const vehicle of [0,3,4,6,7,255])for(const flags of [0,1,3,4,7,128,255])for(const fill of [0,255]){const dp=Buffer.alloc(256,fill);dp[0x46]=vehicle;cases.push({dp,flags});}
 for(let n=0;n<256;n++){const dp=Buffer.from(Array.from({length:256},(_,i)=>(i*37+n*19)&255));cases.push({dp,flags:n});}
 return cases;
}
