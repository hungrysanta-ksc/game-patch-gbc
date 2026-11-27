import {check} from './source.mjs';
import {addTextAssets,fontMap,glyphFor} from './korean-text.mjs';
import {originalActionFlow} from './battle-action-source.mjs';
import {actionUi} from './battle-action-assets.mjs';
import {compactOriginalBox,originalActionUi,uiPixels,projectMessageWindows} from './battle-action-ui.mjs';
import fs from 'node:fs/promises';
import {hpGlyphs} from './battle-hp-font.mjs';
import {sourceMessage} from './battle-message-source.mjs';
import {offset} from './render-budget-source.mjs';
import {scriptSeed,scriptReference} from './battle-script-source.mjs';

// Source call boundaries are verification inputs, never a movie linked into
// the cartridge. Runtime owns five text records and four mutable HP rows.
export async function liveUiAssets(rom,config){
 const {text}=await addTextAssets(rom,{groups:{},provenance:[]},config,{verify:false});
 const font=fontMap(await fs.readFile(config.font));
 const names=['루네스','아르크','레피아','잉구스'].map(s=>Array.from(s,ch=>glyphFor(ch,font)));
 const flows=[false,true].map(enemy=>originalActionFlow(rom,{enemy}));
 const resolve=words=>words[0]>=128&&words[0]<132&&words.slice(1).every(v=>v===255)?names[words[0]-128]:words;
 const profiles=flows.map(flow=>{const ui=actionUi(text,flow);ui.hp.forEach((r,i)=>r.name=names[i]);ui.windows=ui.windows.map(resolve);return {flow,ui};});
 const rectangles=[{x:48,y:2,w:112,h:38},...projectMessageWindows(flows[0].windowDescriptors).map(r=>({...r,y:r.y-6}))];
 const boxes=Buffer.concat(rectangles.map(r=>{const pixels=compactOriginalBox(flows[0].menuTiles,r.w,r.h),packed=Buffer.alloc(r.w*r.h/4);for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){const at=y*r.w/4+(x>>3)*2,v=pixels[y*r.w+x];if(v&1)packed[at]|=128>>(x&7);if(v&2)packed[at+1]|=128>>(x&7);}return packed;}));
 const messages=new Map();for(const [i,id]of text.sourceIds.entries()){if(id<256)continue;const words=[];let literal=true;for(let p=0;p<text.messages[i].length;p+=2){const w=text.messages[i].readUInt16LE(p);if(!w)break;if(w<0x8000){literal=false;break;}words.push(w-0x8000);}if(literal)messages.set(id,words);}
 const ids=[255,...Array.from({length:10},(_,i)=>128+i),199,...new Set([...profiles.flatMap(p=>[...p.ui.hp.flatMap(r=>[...r.name,...r.value]),...p.ui.windows.flat()]),...[...messages.values()].flat()])].filter((v,i,a)=>a.indexOf(v)===i);
 check(ids.length<256,'Live UI glyph dictionary');const index=id=>{const n=ids.indexOf(id);check(n>=0,'Missing live UI glyph');return n;};
 const glyphs=Buffer.concat(ids.map(id=>id>=256?text.glyphs.subarray(id*16,id*16+16):flows[0].menuTiles.subarray(id*16,id*16+16)));
 const advances=Buffer.from(ids.map(id=>id===255?3:8));
 const seed=Buffer.from(profiles[0].ui.hp.flatMap(r=>[...r.name,...Array(6-r.name.length).fill(255),...r.value].map(index)));
 check(seed.length===60,'HP record ABI');
 function expected(ui,live){const raster=originalActionUi(ui,flows[0],text,{smallHp:true}),pixels=uiPixels(raster,live);return Buffer.from(pixels.subarray(6*160,46*160));}
 function partyPixels(party){const hp=profiles[0].ui.hp.map((r,i)=>{const at=256+i*64+12,cur=party.readUInt16LE(at),max=party.readUInt16LE(at+2),s=sourceMessage(rom,[15,i,0,255,1,cur&255,cur>>8,max&255,max>>8,255]);return {...r,value:[...s.raw]};});return expected({hp,windows:Array.from({length:5},()=>[])},0);}
 const cases=[];
 for(const [profile,{flow,ui}]of profiles.entries()){
  const state={hp:ui.hp.map(r=>({...r})),windows:Array.from({length:5},()=>[])};let live=0;
  for(const e of flow.events.filter(e=>e.kind==='open'||e.kind==='close')){
   const words=e.kind==='open'?ui.windows[e.window]:[];state.windows[e.window]=words;live=e.live;
   cases.push({profile,sourceBoundary:e.at,kind:e.kind,window:e.window,request:[e.kind==='open'?1:2,e.window,words.length,...words.map(index)],pixels:expected(state,live).toString('hex'),live});
  }
  for(const h of flow.hp.slice(4)){const row=state.hp[h.slot];row.value=[...h.raw.subarray(8,17)];cases.push({profile,kind:'hp',window:h.slot,request:[3,h.slot,15,...[...row.name,...Array(6-row.name.length).fill(255),...row.value].map(index)],pixels:expected(state,live).toString('hex'),live});}
 }
 for(const c of cases){const top=c.kind==='hp'?5+c.window*8:rectangles[c.window+1].y,h=c.kind==='hp'?8:14;c.patternBytes=(Math.floor((top+h-1)/8)-Math.floor(top/8)+1)*320;}
 const input=(op,v,item=0,next=255,script=1,current=0,max=0,mode=255)=>[op,v,item,next,script,current&255,current>>8,max&255,max>>8,mode];
 const decimal=words=>Number(words.filter(v=>v!==255).map(v=>v-128).join(''));
 for(const c of cases){const flow=profiles[c.profile].flow;
  if(c.kind==='hp'){const raw=flow.hp[4+c.window].raw;c.semantic=input(15,c.window,0,255,1,decimal([...raw.subarray(8,12)]),decimal([...raw.subarray(13,17)]));}
  else {const v=c.window===0?0:c.window===1?166:c.window===2?2:65;c.semantic=input(c.kind==='open'?5+c.window:c.window,v,c.window===1?1:0);}
  const s=sourceMessage(rom,c.semantic);c.sourceId=s.sourceId;c.wait=s.wait;c.rewind=s.rewind;c.error=0;c.draw=true;
  if(c.kind==='open'&&s.sourceId===65535){const name=names[c.semantic[1]];c.request=[1,c.window,6,...[...name,...Array(6-name.length).fill(255)].map(index)];}
 }
 // New probes use unformatted source inputs. The oracle executes the actual
 // 6502 handlers; it does not duplicate the C selector's arithmetic.
 const state={hp:profiles[1].ui.hp.map(r=>({...r})),windows:Array.from({length:5},()=>[])};let live=0;
 const monsters=Buffer.alloc(12);
 function probe(semantic,record=true){const s=sourceMessage(rom,semantic,monsters);let error=0,words=[];
  if(s.kind==='unsupported')error=2;
  else if(s.kind==='open'){
   if(s.sourceId===65535){const name=names[semantic[1]];words=[...name,...Array(6-name.length).fill(255)];}
   else if(!messages.has(s.sourceId))error=3;
   else words=[...(semantic[0]===6&&semantic[2]===0&&semantic[1]>0&&semantic[1]<33?[...s.raw.subarray(0,2)]:[]),...messages.get(s.sourceId)];
   if(!error&&(words.length>14||words.reduce((n,w)=>n+(w===255?3:8),0)>rectangles[s.window+1].w-7))error=4;
  }
  const draw=!error&&['open','close','hp'].includes(s.kind);let request=[],patternBytes=0;
  if(draw){if(s.kind==='open'){state.windows[s.window]=words;live|=1<<s.window;request=[1,s.window,words.length,...words.map(index)];}
   else if(s.kind==='close'){live&=~(1<<s.window);request=[2,s.window,0];}
   else {state.hp[s.window].value=[...s.raw];const row=state.hp[s.window];request=[3,s.window,15,...[...row.name,...Array(6-row.name.length).fill(255),...row.value].map(index)];}
   const top=s.kind==='hp'?5+s.window*8:rectangles[s.window+1].y,h=s.kind==='hp'?8:14;patternBytes=(Math.floor((top+h-1)/8)-Math.floor(top/8)+1)*320;
  }
  const result={profile:2,kind:s.kind,window:s.window,semantic,sourceId:s.sourceId,wait:s.wait,rewind:s.rewind,error,draw,request,patternBytes,pixels:draw?expected(state,live).toString('hex'):undefined,live};if(record)cases.push(result);return result;
 }
 for(let v=0;v<256;v++)probe(input(6,v));
 for(let v=0;v<256;v++)probe(input(8,v));
 for(let v=0;v<144;v++)probe(input(9,v));
 for(const op of [5,7])for(const v of [0,1,2,3,128,135,255,...(op===7?[136]:[])])probe(input(op,v));
 for(const script of [0,1,5])probe(input(3,0,0,65,script));
 for(let op=0;op<5;op++){probe(input(op,1));probe(input(op,255));}
 for(const v of [0,1,9,10,99,100,999,1000,9999,10000,65535])probe(input(15,v%4,0,255,1,v,65535-v));
 const scripts={cases:[],patternBytes:0};let hidden=false;
 for(const [tag,seed,autonomous,blocked]of [
  ['message-wait',scriptSeed(2,{speed:4}),false,false],
  ['actor-message',scriptSeed(4,{speed:8,names:[0,255,255,255]}),false,false],
  ['no-effect',scriptSeed(255,{effect:0}),false,false],
  ['autonomous-wait',scriptSeed(2,{speed:4,messages:[]}),true,false],
  ['animation-owner',scriptSeed(0,{speed:8,names:[0,255,1,255],messages:[]}),false,true]
 ]){let trace=scriptReference(rom,seed);if(blocked)trace=trace.slice(0,trace.findIndex(e=>e.state[23]===4)+1);const observations=[];
  for(const e of trace){const s=e.state,kind=s[23],op=s[24];if(!autonomous)observations.push({state:s.toString('hex'),shot:kind!==2,pixels:kind!==2?expected(state,live).toString('hex'):undefined,hidden});
   if(kind===1){const v=op<4?s[5+op]:op===4?s[9]:op<9?s[op]:s[9+s[20]],r=probe(input(op,v,s[4],s[9+s[20]],s[0]),false);check(!r.error,'Registered live script message');scripts.patternBytes+=r.patternBytes;}
   if(kind===5)hidden=true;
  }
  const terminal=Buffer.from(trace.at(-1).state);if(!blocked){terminal[23]=0;terminal[25]=1;}
  scripts.cases.push({tag,seed:[...seed],autonomous,blocked,observations,terminal:terminal.toString('hex'),hidden,pixels:expected(state,live).toString('hex'),waitFrames:trace.filter(e=>e.state[23]===2).length});
 }
 const messageIndex=[],messageWords=[];for(const [id,words]of messages){const at=messageWords.length;messageIndex.push(id&255,id>>8,at&255,at>>8,words.length);messageWords.push(...words.map(index));}
 let boxOffset=0;const rect=rectangles.map(r=>{const b=[r.x,r.y,r.w,r.h,boxOffset&255,boxOffset>>8];boxOffset+=r.w*r.h/4;return b;});
 return {partyPixels,boxes,glyphs,hpGlyphs,advances,seed,rect:Buffer.from(rect.flat()),palette:flows[0].menuPalette,message_index:Buffer.from(messageIndex),message_words:Buffer.from(messageWords),message_types:Buffer.from(rom.subarray(offset(0x34,0x9575),offset(0x34,0x9575)+72)),messageCount:messages.size,initial:expected(profiles[0].ui,0),cases,scripts,glyphCount:ids.length,source:flows[0].source,namesPolicy:'Explicit Korean party-name inputs for the diagnostic; not canonical names read from the Japanese ROM.'};
}

export function liveUiRgb(rgb,pixels,palette){const out=Buffer.from(rgb);for(let y=0;y<40;y++)for(let x=0;x<160;x++){if(y<2)continue;const v=palette.readUInt16LE(pixels[y*160+x]*2),at=((y+104)*160+x)*3,r=v&31,g=v>>5&31,b=v>>10;out.set([Math.min(240,(r*26+g*4+b*2)>>2),Math.min(240,(g*24+b*8)>>2),Math.min(240,(r*6+g*4+b*22)>>2)],at);}return out;}
