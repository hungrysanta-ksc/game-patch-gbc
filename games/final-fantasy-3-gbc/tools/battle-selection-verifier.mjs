import fs from 'node:fs/promises';
import {check} from './source.mjs';
import {sourceCommandCursor,sourceTarget} from './battle-select-source.mjs';
import {screenshotRgb} from './map-pixels.mjs';
export function selectionSequence(){const out=[];for(const back of [0,1]){
 const route=keys=>{out.push({op:8,page:back});for(const key of keys)out.push({op:9,page:back,key});};
 route([32,32,32,32,16,32,1,16,32,128,32,64,2,1,2,1,16,1]);
 route([32,1]);route([32,32,1]);route([32,32,32,1]);route([64,64]);route([128,128]);
 }return out;}
export function selectionStep(rom,profile,state,request){if(request.op===8)return {mode:0,row:0,back:request.page,dispatch:0,sound:0,target:Buffer.alloc(11),left:0,right:0};
 const s={...state,target:Buffer.from(state.target)},key=request.key,bit=key&-key;check(s.mode!==2,'Request after caller return');
 if(s.mode===0){if(key)s.sound=0x98;s.row=sourceCommandCursor(rom,s.row,0,key);
  if(bit===1){s.sound=0x85;s.dispatch=profile.source.commands.data[s.row];if(s.dispatch===4){s.target[10]=s.sound;s.target=sourceTarget(rom,Buffer.from(profile.env.data),s.target,0,{begin:true});s.mode=1;s.dispatch=0;}else s.mode=2;}
  else if(bit===2){s.row=0;s.left=s.right=0;}
  else if(bit===64){if(s.left){s.sound=0x85;s.dispatch=s.back?3:2;s.mode=2;}else{s.left=1;s.right=0;}}
  else if(bit===128){if(s.right){s.sound=0x85;s.dispatch=s.back?2:3;s.mode=2;}else{s.right=1;s.left=0;}}
 }else{s.target=sourceTarget(rom,Buffer.from(profile.env.data),s.target,key);s.sound=s.target[10];if(!s.target[0]&&!s.target[1]){if(s.target[7]){s.dispatch=4;s.mode=2;}else{s.mode=s.row=s.left=s.right=0;}}}return s;
}
export function selectionHand(profile,s){if(s.mode===2)return [];if(s.mode===0)return profile.source.commandHand.map(p=>({...p,y:p.y+s.row*8}));const mask=s.target[0]||s.target[1]&240;const i=Array.from({length:8},(_,i)=>i).find(i=>mask&(128>>i));check(i!==undefined,'Single target cursor');return profile.source.cursors[i+(s.target[0]?0:8)];}
function colors(hex){const b=Buffer.from(hex,'hex');return Array.from({length:b.length/2},(_,i)=>{const v=b.readUInt16LE(i*2),r=v&31,g=v>>5&31,bl=v>>10;return [Math.min(240,(r*26+g*4+bl*2)>>2),Math.min(240,(g*24+bl*8)>>2),Math.min(240,(r*6+g*4+bl*22)>>2)];});}
export async function verifySelection({data,report,actual,cfg,dir,shots,sequence}){let s,count=0,maxObjects=0,maxLine=0,serial;const examples=[];
 for(const [i,p]of actual.pages.entries()){const request=sequence[i%sequence.length],profile=report.battle.action.selectionViews[request.page];s=selectionStep(data,profile,s,request);const observed=p.selection;
  check(p.op===request.op&&p.page===request.page,'Selection request order');for(const k of ['mode','row','back','dispatch','sound'])check(observed[k]===s[k],'Selection '+k+' at '+i+': '+observed[k]+' != '+s[k]);check(observed.target===s.target.toString('hex'),'Original target state '+i);if(serial!==undefined)check(((observed.serial-serial)&65535)===1,'Selection publication serial');serial=observed.serial;
  if(!p.screenshot)continue;const hand=selectionHand(profile,s),frame=report.frames[profile.entries[0].frame],rgb=Buffer.from(await fs.readFile(dir+'/action'+(4+s.back)+'-0.rgb')),tiles=Buffer.from(profile.source.menuTiles.data),palette=colors(frame.palette.slice(128));
  for(const q of hand)for(let y=0;y<8;y++)for(let x=0;x<8;x++){const tx=q.attr&64?7-x:x,ty=q.attr&128?7-y:y,at=q.tile*16+ty*2,bit=7-tx,v=(tiles[at]>>bit&1)|((tiles[at+1]>>bit&1)<<1);if(!v)continue;const dx=q.x+x,dy=q.y+y;check(dx>=0&&dx<160&&dy>=0&&dy<144,'Unclipped original hand');rgb.set(palette[(q.attr&3)*4+v],(dy*160+dx)*3);}
  const image=await fs.readFile(cfg.home+'/Screenshots/'+shots[p.screenshotOrdinal]);check(screenshotRgb(image).equals(rgb),'Actual selection pixels '+i+' mode '+s.mode+' row '+s.row);
  const oam=Buffer.alloc(160),base=Buffer.from(frame.atlas.oam.data),page=(p.lcdc>>3)&1,n=frame.stats.objects;for(let j=0;j<n;j++)base[j*4+2]+=page*64;base.copy(oam,hand.length*4,0,n*4);for(const [j,q]of hand.entries())oam.set([q.y+16,q.x+8,60+(q.tile-89)+page*64,11+((q.attr&64)?32:0)+((q.attr&128)?64:0)],j*4);
  check(Buffer.from(p.oam,'hex').equals(oam)&&!(p.lcdc&4),'Complete original cursor OAM '+i);const lines=Array(144).fill(0);for(let j=0;j<n+hand.length;j++){const y=oam[j*4]-16;for(let yy=Math.max(0,y);yy<Math.min(144,y+8);yy++)lines[yy]++;}maxObjects=Math.max(maxObjects,n+hand.length);maxLine=Math.max(maxLine,...lines);check(n+hand.length<=40&&Math.max(...lines)<=10,'Cursor OAM capacity');check(p.scx===0&&p.scy===6,'V6 viewport');
  if(i<sequence.length){const file='selection-'+i+'.png';await fs.writeFile(dir+'/'+file,image);examples.push({file,...request,mode:s.mode,row:s.row,dispatch:s.dispatch});}count++;
 }
 check(count===sequence.length*2&&actual.pages.length>=count,'Two complete selection cycles');
 // A local latency regression gate, not a claim of original input cadence.
 check(actual.pages.filter(p=>p.op===9).every(p=>p.seconds<0.08),'Warmed selection input latency');
 await fs.writeFile(dir+'/selection-review.json',JSON.stringify(examples,null,2));
 await fs.writeFile(dir+'/index.html','<!doctype html><meta charset="utf-8"><title>FF3 원작 선택 연결</title><style>body{background:#151921;color:#eee;font:16px sans-serif;margin:24px}main{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0}img{width:480px;image-rendering:pixelated}figcaption{padding:8px}</style><h1>V6 · 원작 명령/대상 선택</h1><p>실제 GBC 캡처. 방향키 이동, A 선택, B 취소. 한 명의 선택 결과에서 멈추는 진단이며 실제 행동 실행/아이템 목록은 후속 작업입니다. 이름 0~3과 HP는 진단 입력입니다.</p><main>'+examples.map(e=>'<figure><img src="'+e.file+'"><figcaption>'+e.file+' · '+(e.page?'백어택':'정면')+' · '+['명령','대상','호출자 반환'][e.mode]+' · 행 '+e.row+' · 요청 '+e.dispatch+'</figcaption></figure>').join('')+'</main>');
 return {screenshots:count,pixels:count*160*144,states:actual.pages.length,maxObjects,maxLine,requestsPerCycle:sequence.length,scope:'One actor command/target selection and caller dispatch, diagnostic formation/HP; no action execution or item/magic submenu'};
}
