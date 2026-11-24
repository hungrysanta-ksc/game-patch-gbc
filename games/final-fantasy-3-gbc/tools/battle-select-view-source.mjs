import {check} from './source.mjs';import {initializedBattle} from './battle-transition-source.mjs';import {formationPixels,adaptPoint} from './battle-placement-budget.mjs';import {scenePixels} from './battle-scene-pixels.mjs';import {convertTiles} from './map-assets.mjs';import {selectionTables} from './battle-select-source.mjs';import {rearX} from './battle-layout.mjs';
const select=(c,p)=>{c.banks=[p*2,p*2+1,62,63];};
export function originalSelectionView(rom,{back=false,actor=0,queued}={}){
 const {m,f}=initializedBattle(rom,{formation:0,counts:[2,0,0,0],back,rows:[0,0,0,0],terrain:0,jobs:[0,0,0,0]}),c=m.c;m.call(0xb469);
 c.m[0x57]=0;c.m[0x58]=0x61;c.m[0x5b]=0x75;c.m[0x5c]=0x75;c.m[0x6010]=4;c.m[0x7cf3]=1;c.m[0x7ce8]=255;c.m[0x7ceb]=0;
 for(let i=0;i<4;i++){c.m.set([128+i,255,255,255,255,255],0x6106+i*64);c.m[0x7575+i*64]=0;c.m[0x7576+i*64]=c.m[0x7577+i*64]=0;c.m[0x7578+i*64]=c.m[0x757a+i*64]=32;c.m[0x7579+i*64]=c.m[0x757b+i*64]=0;}
 check(actor>=0&&actor<=4,'Selection actor');if(queued){check(queued.length===4,'Queued commands');c.m[0x7ce8]=0;c.m.set(queued,0x78cf);}
 const hp=[],labels=[],step=c.step;c.step=function(){if(this.banks[0]===0x34&&this.pc===0xa609&&this.x===13)labels.push({actor:this.m[0x52],id:0x620+this.a});if(this.banks[0]===0x34&&this.pc===0x9cbe)hp.push(Buffer.from(this.m.subarray(0x7ad7,0x7ae9)));step.call(this);};
 select(c,0x1a);c.call(0x9d06);c.call(0x9ba2);c.m[0x52]=0;c.call(0xa541);c.call(0x9d9e);c.call(0x9a69);const commands=Buffer.from(c.m.subarray(0x7400,0x7404)),rowCommands=Buffer.from(c.m.subarray(0x7404,0x7406));
 select(c,0x17);c.call(0x9e80);c.call(0xb5b8);c.call(0xb304);if(actor<4){c.x=actor;m.call(0xb3cd);}c.call(0xaeec);c.call(0xf8c5);
 const layout=formationPixels(rom,f,{retreat:8}).layout,frame={...scenePixels(c,m.ppu,{back,layout,formation:f,partyY:[10,34,58,82],enemyY:18,terrainHeight:11,statusOwners:true}),phase:'command-selection',numberObjects:[],numberFrame:null,sourceBoundary:0};
 const menuTiles=convertTiles(m.ppu.bytes.subarray(0x1000,0x2000)),sourceUi=Buffer.from(m.ppu.bytes.subarray(0x2260,0x23a0)),{tables}=selectionTables(rom),env=Buffer.from([...tables.ff3_target_layouts.subarray(f.layout*8,f.layout*8+8),...c.m.subarray(0x7da7,0x7daf),...c.m.subarray(0x7d8b,0x7d8f),...c.m.subarray(0x7e22,0x7e26),+back]);
 check(hp.length===4&&commands.equals(tables.ff3_job_commands.subarray(0,4)),'Original selection UI boundary');
 // Obtain the actual four-tile hand and its orientation from the renderer.
 // Convert its anchor only; every opaque cursor pixel retains its source size.
 const cursors=[];select(c,0x19);
 for(let id=0;id<12;id++){
  c.m[0x12]=0;c.m[0xad]=id<8?128>>id:0;c.m[0xae]=id>=8?tables.ff3_party_bits[id-8]:0;c.m[0xb1]=id<8?0:4;c.m[0xb3]=0;c.m[0xb6]=0;c.call(0x9a69);
  const parts=[];for(let at=0x220;at<0x260;at+=4){const [y,tile,attr,x]=c.m.subarray(at,at+4);if(y>=239||!menuTiles.subarray(tile*16,tile*16+16).some(v=>v))continue;parts.push({x,y:y+1,tile,attr});}
  if(id<8&&env[8+id]===255){cursors.push([]);continue;}check(parts.length===4,'Original hand population '+id+' '+parts.length);
  const left=Math.min(...parts.map(p=>p.x)),top=Math.min(...parts.map(p=>p.y));let x,y;
  if(id<8){const canonical=back?240-left:left;[x,y]=adaptPoint(f,canonical,top);x=rearX(back?144-x:x,layout,back);y+=2;}
  else{x=back?left-16:left-80;y=top-[44,72,100,128][id-8]+[10,34,58,82][id-8];}
  x=Math.max(0,Math.min(144,x));y=Math.max(0,Math.min(128,y));cursors.push(parts.map(p=>({...p,x:x+p.x-left,y:y+p.y-top})));
 }
 select(c,0x1a);c.m[0x55]=0;c.m[0x1a]=0;c.call(0x8966);const commandHand=[];for(let at=0x220;at<0x230;at+=4){const [y,tile,attr,x]=c.m.subarray(at,at+4);commandHand.push({x:x-32+4,y:y+1-169+104,tile,attr});}
 return {frame,env,hp:hp.map(raw=>({name:[...raw.subarray(1,7)],value:[...raw.subarray(8,17)]})),...(queued?{labels}:{}),commands,rowCommands,menuTiles,menuPalette:frame.sourcePalettes.subarray(24,32),sourceUi,cursors,commandHand,formation:f,scope:'Live selection function boundary, first-battle formation/counts; explicit diagnostic names and HP, no effect calculator'};
}
