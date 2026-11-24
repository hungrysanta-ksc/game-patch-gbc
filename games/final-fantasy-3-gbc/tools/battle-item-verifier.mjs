import fs from 'node:fs/promises';
import {check} from './source.mjs';
import {sourceInitialState} from './state-source.mjs';
import {selectionStep as partyStep} from './battle-party-verifier.mjs';
import {sourceParty} from './battle-party-source.mjs';
import {sourceItemCursor,sourceInventory} from './battle-items-source.mjs';
import {sourceItemUse,sourceItemAutoTargets} from './battle-item-use-source.mjs';
import {sourceTarget} from './battle-select-source.mjs';
import {selectionHand} from './battle-selection-verifier.mjs';
import {selectionViewProfile} from './battle-select-view-assets.mjs';
import {addTextAssets} from './korean-text.mjs';
import {makeMapAssets} from './map-assets.mjs';
import {makeObjectAssets} from './object-assets.mjs';
import {itemAssets} from './battle-item-assets.mjs';
import {partyUiRaster} from './battle-party-ui.mjs';
import {actionRgb,actionComposition} from './battle-action-assets.mjs';
import {screenshotRgb} from './map-pixels.mjs';
export function itemBags(){const ids=[0xa6,0xa7,0xa8,0xa9,0xaa,0xab,0xac,0xad,0xae,0xaf,0xb0,0xb1,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xbb,0xbc,0xbd,0xbe,0xbf,0xc0,0xc1,0x1e,0x62,0xc8,0];return [Buffer.from([...ids,...ids.map((id,i)=>id?(i===1?12:i===2?99:i===24?255:i%9+1):0)]).toString('hex')];}
export function selectionSequence(){const out=[];for(const back of [0,1]){const route=keys=>{out.push({op:8,page:back,itemSeed:0});for(const key of keys)out.push({op:9,page:back,key});};
 route([16,1,128,128,128,128,128,128,128,128,64,64,64,64,64,64,64,64,32,16,128,2]);
 // Potion: HP target cancel, then reservation, previous actor refunds once.
 route([16,1,1,1,32,2,16,1,1,1,32,1,2]);
 // Long supplied name, selected-row marquee, two-hand invalid pair, cancel.
 route([16,1,128,32]);if(!back)out.push({op:9,page:back,key:0,hold:360});out.push(...[1,32,1,2,2].map(key=>({op:9,page:back,key})));
 // Enemy-target item (south wind), then target cancel and confirm.
 route([16,1,128,128,128,1,1,2,16,1,128,128,128,1,1,1]);
 // Earth drum's automatic all-enemy mask uses all eight status records.
 route([16,1,128,128,128,128,32,1,1,2]);
 // Using a held weapon reserves it without changing the persistent bag.
 route([16,1,64,1,1,1,2]);
 // Disabled armor/spell item and an empty slot must not reserve anything.
 route([16,1,128,128,128,128,128,128,128,32,1,1,2,32,1,1,2,32,1,1,2,2]);
 // Equipment-to-bag swap is an explicit unimplemented caller, not success.
 route([16,1,64,1,128,1]);
 }return out;}
function enter(rom,s){s.party=sourceParty(rom,s.party,1);if(s.party[1]===3){const a=s.party[0],r=Buffer.alloc(72);r.set(s.bag);r[64]=s.party[50+a];r[65]=s.equipped[a];const v=sourceInventory(rom,r,4,Buffer.from([0,a])).state;s.bag=Buffer.from(v.subarray(0,64));s.party[50+a]=v[64];s.equipped[a]=v[65];s.party[1]=0;}s.display=Buffer.from(s.party.subarray(2,6));s.mode=s.party[1]===0?0:2;s.row=s.left=s.right=s.dispatch=0;}
export function itemStep(rom,profile,state,q,equipment,jobs){
 if(q.itemSeed!==undefined)state={...state,bag:Buffer.from(itemBags()[q.itemSeed],'hex')};
 if(q.op===8||state.mode<3){const s=partyStep(rom,profile,state,q);s.cursor=Buffer.from(state?.cursor??Buffer.alloc(6));s.hp=state?.hp??0;s.id=state?.id??0;
  if(s.mode===2&&s.dispatch===20){s.mode=3;s.dispatch=0;s.party[1]=0;s.hp=0;s.cursor.set([0,1,1,0]);}return s;}
 const s={...state,cursor:Buffer.from(state.cursor),party:Buffer.from(state.party),bag:Buffer.from(state.bag),equipped:Buffer.from(state.equipped),target:Buffer.from(state.target)},actor=s.party[0],at=10+actor*3;
 const reserve=()=>{s.party[at]=s.id;if(s.cursor[1]){const r=Buffer.alloc(72);r.set(s.bag);r[64]=s.party[50+actor];const v=sourceInventory(rom,r,3,Buffer.from([(s.cursor[1]-1)*4+s.cursor[0],actor])).state;s.bag=Buffer.from(v.subarray(0,64));s.party[50+actor]=v[64];}else{s.party[50+actor]=s.id;s.equipped[actor]=1;}s.party[0]++;enter(rom,s);};
 if(s.mode===4){s.target=sourceTarget(rom,Buffer.from(profile.env.data),s.target,q.key);s.sound=s.target[10];s.party[22+actor]=s.target[9];if(!s.target[0]&&!s.target[1]){if(s.target[7]){s.party[at+1]=s.target[7];s.party[at+2]=s.target[8];reserve();}else enter(rom,s);}return s;}
 const r=sourceItemCursor(rom,s.cursor,q.key);s.cursor=r.state;if(q.key&240)s.sound=0x98;
 if(r.event===3){enter(rom,s);return s;}if(r.event===2){s.mode=2;s.dispatch=0xe1;s.party[1]=4;return s;}if(r.event===4){s.sound=0x86;return s;}if(!r.event){if(q.key===1)s.sound=0x85;return s;}
 s.id=s.cursor[1]?s.bag[(s.cursor[1]-1)*4+s.cursor[0]]:equipment[actor*64+(s.cursor[0]>=2?5:3)];const use=sourceItemUse(rom,s.id,jobs[actor],{equipped:!s.cursor[1]});s.party[at]=use.item;s.party[46+actor]|=use.actionFlags;s.hp=use.showHp;
 if(!use.valid){s.sound=0x86;return s;}s.sound=0x85;
 if(!(use.property&24)){reserve();return s;}if(use.property&64){const target=sourceItemAutoTargets(rom,Buffer.from(profile.source.monsterStatus.data));s.party[at+1]=target.mask;s.party[at+2]=target.flags;reserve();return s;}
 s.target[9]=s.party[22+actor];s.target[10]=s.sound;s.target=sourceTarget(rom,Buffer.from(profile.env.data),s.target,((use.property&32)?0:1)|((use.property&128)?2:0),{begin:true});s.mode=4;return s;
}
const colors=hex=>{const b=Buffer.from(hex,'hex');return Array.from({length:b.length/2},(_,i)=>{const v=b.readUInt16LE(i*2),r=v&31,g=v>>5&31,z=v>>10;return [Math.min(240,(r*26+g*4+z*2)>>2),Math.min(240,(g*24+z*8)>>2),Math.min(240,(r*6+g*4+z*22)>>2)];});};
const pixel=(b,t,x,y)=>(b[t*16+y*2]>>(7-x)&1)|((b[t*16+y*2+1]>>(7-x)&1)<<1);
function columnPixels(a,column,s,equipment,jobs,offset){const kind=!column?0:column===1?1:column===8?3:2,p=new Uint8Array(80*38);
 for(let y=0;y<38;y++)for(let x=0;x<80;x++)p[y*80+x]=pixel(a.base,kind*50+(y>>3)*10+(x>>3),x&7,y&7);
 for(let r=0;r<4;r++){const label=!column&&!(r&1),id=label?256+(r>>1):column?s.bag[(column-1)*4+r]:equipment[s.party[0]*64+(r>=2?5:3)],qty=column?s.bag[32+(column-1)*4+r]:equipment[s.party[0]*64+(r>=2?6:4)],shift=column===s.cursor[1]&&r===s.cursor[0]?offset:0;
  for(let y=0;y<8;y++){
   if(label||id)for(let x=0;x<36;x++){const sx=x+shift;if(sx<128&&(a.names[id*128+y*16+(sx>>3)]&(128>>(sx&7))))p[(3+r*8+y)*80+16+x]=3;}
   if(label)continue;
   for(let x=0;x<24;x++){const g=x<8?10:x<16?(qty<10?255:Math.floor(qty/10)%10):qty%10;if(g!==255&&(a.digits[g*16+y*2]&(128>>(x&7))))p[(3+r*8+y)*80+52+x]=3;}
   if(column&&!a.usable[jobs[s.party[0]]*256+id])for(let x=0;x<8;x++)if(a.digits[11*16+y*2]&(128>>x))p[(3+r*8+y)*80+4+x]=3;
  }
 }return p;
}
export async function verifySelection({data,local,report,actual,cfg,dir,shots,sequence}){
 const assets=await addTextAssets(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),local.text),profiles=[false,true].map(back=>Array.from({length:5},(_,actor)=>selectionViewProfile(data,assets.text,{back,actor,party:true}))),a=await itemAssets(data,assets.text,profiles[0][0].source.menuTiles,local.text);for(const group of profiles)for(const p of group)p.source.frame.composition=actionComposition(p.source.frame);
 const initial=sourceInitialState(data),jobs=Array.from({length:4},(_,i)=>initial[0x100+i*64]);let s,count=0,maxObjects=0,maxLine=0,equipment,serial,outsideState;const examples=[],marqueeWindows=[],latencies={open:[],scrollWithPreparation:[],otherInput:[],start:[]};
 for(const [i,p]of actual.pages.entries()){
  const q=sequence[i%sequence.length],profile=report.battle.action.selectionViews[q.page];equipment??=Buffer.from(p.gameState,'hex').subarray(0x200,0x300);const old=s;s=itemStep(data,profile,s,q,equipment,jobs);
  const timing=q.op===8?'start':old?.mode===0&&s.mode===3?'open':old?.mode===3&&s.mode===3&&old.cursor[2]!==s.cursor[2]?'scrollWithPreparation':'otherInput';latencies[timing].push(p.seconds);
  check(p.op===q.op&&p.page===q.page,'Item request order');for(const k of ['mode','row','back','dispatch','sound'])check(p.selection[k]===s[k],'Item '+k+' at '+i+': '+p.selection[k]+' != '+s[k]);
  const outside=p.gameState.slice(0,0xc0*2)+p.gameState.slice(0x100*2);outsideState??=outside;check(outside===outsideState,'Non-inventory GameState '+i);
  check(p.selection.target===s.target.toString('hex'),'Original item target '+i);check(p.party===s.party.toString('hex'),'Original item action '+i);check(p.partyDisplay===s.display.toString('hex'),'Item HP labels '+i);check(p.bag===s.bag.toString('hex')&&p.usedEquipped===s.equipped.toString('hex'),'Item reservation/refund '+i);check(p.item.cursor===s.cursor.toString('hex')&&!p.item.rasterFault,'Item cursor/raster '+i);
  if(serial!==undefined)check(((p.selection.serial-serial)&65535)===1,'Item publication serial');serial=p.selection.serial;
  if(old?.mode===3&&s.mode===3&&(old.cursor[0]!==s.cursor[0]||old.cursor[1]!==s.cursor[1]))check(p.item.marquee===0,'Changed cursor resets name offset '+i);
  const visible=s.mode===3||(s.mode===4&&!s.hp);check(p.item.visible===+visible,'Item visibility '+i);check(p.item.marquee<=92,'Marquee bound');if(q.hold>=360){const id=s.bag[(s.cursor[1]-1)*4+s.cursor[0]];marqueeWindows.push({from:p.completedMaster,to:p.captureMaster,maxOffset:a.widths[id]-36});}if(!p.screenshot)continue;
  const view=profiles[s.back][s.party[0]],f=report.frames[profile.entries[s.party[0]].frame],ui=partyUiRaster(view,assets.text,s.display),rgb=actionRgb(view.source.frame,ui,3),palette=colors(f.palette),obj=colors(f.palette.slice(128)),tiles=view.source.menuTiles;let hand=[];
  if(visible){for(let col=0;col<2;col++){const pixels=columnPixels(a,s.cursor[2]+col,s,equipment,jobs,p.item.marquee);for(let y=0;y<38;y++)for(let x=0;x<80;x++)rgb.set(palette[28+pixels[y*80+x]],((106+y)*160+col*80+x)*3);}
   if(s.mode===3){const add=(r,c,selected=0)=>{if(c<s.cursor[2]||c>s.cursor[2]+1){hand.push(null,null,null,null);return;}const first=view.source.commandHand[0];hand.push(...view.source.commandHand.map(p=>({...p,x:p.x-first.x+(c-s.cursor[2])*80+selected*4,y:p.y-first.y+104+r*8})));};add(s.cursor[0],s.cursor[1]);if(s.cursor[3])add(s.cursor[4],s.cursor[5],1);}
   else{const mask=s.target[0]||s.target[1],start=s.target[0]&&!(mask&240)?4:0;for(let j=start;j<start+4;j++)if(mask&(128>>j))hand.push(...view.source.cursors[j+(s.target[0]?0:8)]);}
  }else{hand=selectionHand(view,s);if(s.mode===4&&s.hp)for(let y=106;y<144;y++)rgb.fill(0,y*160*3,(y*160+48)*3);}
  for(const q of hand.filter(Boolean).reverse())for(let y=0;y<8;y++)for(let x=0;x<8;x++){const v=pixel(tiles,q.tile,q.attr&64?7-x:x,q.attr&128?7-y:y);if(v&&q.x+x>=0&&q.x+x<160&&q.y+y>=0&&q.y+y<144)rgb.set(obj[(q.attr&3)*4+v],((q.y+y)*160+q.x+x)*3);}
  const image=await fs.readFile(cfg.home+'/Screenshots/'+shots[p.screenshotOrdinal]),actualRgb=screenshotRgb(image);if(!actualRgb.equals(rgb)){await fs.writeFile(dir+'/item-expected-'+i+'.rgb',rgb);throw Error('Actual item pixels '+i+' mode '+s.mode+' marquee '+p.item.marquee);}
  const expectedOam=Buffer.alloc(160),base=Buffer.from(f.atlas.oam.data),page=visible?1:(p.lcdc>>3)&1,n=f.stats.objects;for(let j=0;j<n;j++)base[j*4+2]+=page*64;base.copy(expectedOam,hand.length*4,0,n*4);for(const [j,q]of hand.entries())if(q)expectedOam.set([q.y+16,q.x+8,60+q.tile-89+page*64,11+((q.attr&64)?32:0)+((q.attr&128)?64:0)],j*4);
  const oam=Buffer.from(p.oam,'hex');check(oam.equals(expectedOam)&&!(p.lcdc&4),'Complete item OAM '+i);const lines=Array(144).fill(0);let objects=0;for(let j=0;j<40;j++){const y=oam[j*4]-16;if(y>=144||y+8<=0)continue;objects++;for(let yy=Math.max(0,y);yy<Math.min(144,y+8);yy++)lines[yy]++;}maxObjects=Math.max(maxObjects,objects);maxLine=Math.max(maxLine,...lines);check(objects<=40&&Math.max(...lines)<=10,'Item OAM capacity '+i);check(p.scx===0&&p.scy===6,'V6 item viewport');
  if(i<sequence.length){const file='item-'+i+'.png';await fs.writeFile(dir+'/'+file,image);examples.push({file,...q,mode:s.mode,actor:s.party[0],cursor:[...s.cursor],marquee:p.item.marquee});}count++;
 }
 const shiftedNameScreenshots=actual.pages.filter(p=>p.screenshot&&p.item.marquee>0).length;check(shiftedNameScreenshots>=2,'Pixel evidence of selected-name motion with other names stationary');
 check(count===sequence.length*2,'Two complete item cycles');await fs.writeFile(dir+'/item-review.json',JSON.stringify(examples,null,2));await fs.writeFile(dir+'/index.html','<!doctype html><meta charset="utf-8"><title>FF3 아이템 창</title><style>body{background:#151921;color:#eee;font:16px sans-serif;margin:24px}main{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0}img{width:480px;image-rendering:pixelated}</style><h1>원작 아이템 창 · V6</h1><p>실제 GBC 캡처. 재고는 명시적인 검증 입력. A 두 번 사용, B 취소. 효과 계산·장비 교환은 별도 소비자입니다.</p><main>'+examples.map(e=>'<figure><img src="'+e.file+'"><figcaption>'+e.file+' · 모드 '+e.mode+' · 커서 '+e.cursor+'</figcaption></figure>').join('')+'</main>');
 return {latencies:Object.fromEntries(Object.entries(latencies).map(([k,v])=>[k,{count:v.length,maxSeconds:Math.max(...v)}])),marqueeWindows,shiftedNameScreenshots,screenshots:count,pixels:count*160*144,states:actual.pages.length,maxObjects,maxLine,requestsPerCycle:sequence.length,scope:'Original item IDs/counts/usability and six-frame horizontal list, selected-name marquee, original target selection/reservation/refund; fixed diagnostic inventory/formation, no item effects or equipment swap'};
}

export function checkItemTiming(log,selection){
 const raster=[...log.matchAll(/item-raster:(\d+),(\d+),(\d+),(\d+),(\d+)/g)].at(-1),irq=[...log.matchAll(/item-audio-irq:(\d+)/g)].at(-1);check(raster&&irq,'Item raster/IRQ evidence');const [count,bad,fault,maxCycles,rate]=raster.slice(1).map(Number),irqCycles=Number(irq[1]);check(count>100&&!bad&&!fault&&maxCycles>0&&irqCycles>0&&irqCycles/rate<1/4096,'Bounded raster and complete audio IRQ');
 const rows=[...new Map([...log.matchAll(/item-scroll:(\d+),(\d+),(\d+)/g)].map(m=>[Number(m[2]),m.slice(1).map(Number)])).values()].sort((a,b)=>a[1]-b[1]),patterns=[[13,27,40,53,67,80],[67,53,40,27,13,0]],counts=[0,0];let jitter=0;
 for(let i=0;i<rows.length-5;i++)for(let side=0;side<2;side++)if(rows[i][0]===patterns[side][0]&&rows[i+1][0]===patterns[side][1]){for(let j=0;j<6;j++){check(rows[i+j][0]===patterns[side][j],'Six item scroll positions');if(j){const d=Math.abs(rows[i+j][1]-rows[i+j-1][1]-140448);jitter=Math.max(jitter,d);check(d<=512,'Consecutive item scroll frames');}}counts[side]++;}
 check(counts.every(n=>n>=28),'Both directions across full inventory, normal/back, twice');
 const marqueeRows=[...new Map([...log.matchAll(/item-marquee:(\d+),(\d+)/g)].map(m=>[Number(m[2]),m.slice(1).map(Number)])).values()].sort((a,b)=>a[1]-b[1]),marquee=marqueeRows.map(r=>r[0]);check(marquee.some(v=>v>0),'Automatic selected-name motion');
 check(selection.marqueeWindows.length>=2,'Two selected-name observation windows');
 for(const w of selection.marqueeWindows){const v=marqueeRows.filter(r=>r[1]>=w.from&&r[1]<=w.to).map(r=>r[0]),at=v.indexOf(w.maxOffset);check(Number.isFinite(w.from)&&at>=0&&v.slice(at+1).some(x=>x<w.maxOffset),'Selected full name reaches its end and reverses');}
 return {rasterPublications:count,invalidRasterWrites:bad,rasterFault:fault,rasterHandlerMaxSeconds:(maxCycles+64)/rate,audioIrqMaxSeconds:irqCycles/rate,scrollsRight:counts[0],scrollsLeft:counts[1],scrollFrames:6,scrollFrameJitterSeconds:jitter/rate,marqueeMaxOffset:Math.max(...marquee),fullNameReversals:selection.marqueeWindows.length};
}
