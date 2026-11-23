import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,input,hash,check} from './source.mjs';import {makeMapAssets} from './map-assets.mjs';import {makeObjectAssets} from './object-assets.mjs';import {addTextAssets} from './korean-text.mjs';import {prepareDialogue} from './dialogue-build.mjs';import {npcRecord,npcOriginal} from './dialogue-source.mjs';import {expandDialogue} from './dialogue-reference.mjs';import {textPage,windowRgb} from './text-reference.mjs';import {objectReference,objectRgb} from './object-reference.mjs';import {sourceInitialState} from './state-source.mjs';import {screenshotRgb} from './map-pixels.mjs';
const {data,local}=await input(),dir=ROOT+'/build/dialogue',rom=dir+'/ff3-dialogue-viewer.gbc',report=JSON.parse(await fs.readFile(dir+'/report.json')),romSha256=hash(await fs.readFile(rom)),coreSha256=hash(await fs.readFile(local.mesenCore));
check(romSha256===report.romSha256&&coreSha256==='1ba99d2c848e007c60cbd7fceca058440758eb44837a93a6724d29d72723c994','Dialogue artifact identity');
const assets=await addTextAssets(data,makeObjectAssets(data,makeMapAssets(data,{verify:false}),{verify:false}),local.dialogue,{verify:false});await prepareDialogue(data,assets,local.dialogue);
const a=assets.dialogue,d=a.diagnostic,requests=[],expected=[],state=sourceInitialState(data),context={names:[...d.names],shown:0,gil:0,variable:200,item:166};
function add(r,e={}){if(r.flags)state.set(r.flags,0x20);if(r.names)context.names=[...r.names];for(const k of ['shown','gil','variable','item'])if(r[k]!==undefined)context[k]=r[k];state[14]=context.shown;for(let j=0;j<3;j++)state[0x1c+j]=context.gil>>(8*j)&255;
 if(r.command===7){const at=0x20+(r.flag>>3);if(r.set)state[at]|=1<<(r.flag&7);else state[at]&=~(1<<(r.flag&7));}
 requests.push({screenshot:false,...r});expected.push({state:state.toString('hex'),names:[...context.names],...([4,5].includes(r.command)?{npcError:0}:{}),...e});}
for(const c of a.cases)add({command:5,world:c.world,npc:c.npc,flags:c.flags},{npcEvent:c.event,dialogue:c.dialogue});
for(const world of [2,255])for(const npc of [0,55,223]){const flags=Array(16).fill(255),e=npcOriginal(data,world,npc,flags);add({command:5,world,npc,flags},{npcEvent:e.event,dialogue:e.dialogue.toString('hex')});}
for(const n of a.numbers)add({command:6,value:n.value,digits:n.digits},{number:n.bytes});
for(const f of a.flags)add({command:7,flags:Array(32).fill(f.set?0:255),flag:f.id,set:f.set});
add({command:3,flags:Array(32).fill(0)});
function pages(id,first,npc=false,screens=true){
 for(const k of ['shown','gil','variable','item','names'])if(first[k]!==undefined)context[k]=first[k];
 const stream=expandDialogue(assets,id,context);let offset=0,page=0;do{const p=textPage(stream,offset);check(!p.error,'Expanded layout rejected');offset=p.offset;page++;add(page===1?{...first,screenshot:screens}:{key:'A',screenshot:screens},{visible:1,more:+p.more,page,cells:p.cells,pixels:p,npcError:npc?0:undefined,npcActive:npc?1:undefined,npcText:npc?id:undefined});if(!p.more)break;}while(page<200);
 add({key:'A',screenshot:screens},{visible:0,more:0,npcActive:npc?0:undefined});
}
const flagArray=on=>{const f=Array(16).fill(0);if(on)f[d.flag>>3]|=1<<(d.flag&7);return f;};
// Actual source NPC selection -> F0 -> source string -> Korean window -> FF.
for(const on of [0,1])for(const shown of on?[0,64,128,192]:[0]){const flags=flagArray(on),e=npcOriginal(data,d.world,d.npc,flags),ev=a.events[e.event];check(ev.supported&&ev.commands[0].op===240,'Diagnostic NPC route');const id=(d.world?768:512)+e.dialogue[ev.commands[0].operand];pages(id,{command:4,world:d.world,npc:d.npc,flags,shown},true);}
const nameEntry=assets.text.bindings.entries.find(b=>b.parts.some(p=>p.markup?.['(PC4)']));check(nameEntry,'Four-slot source binding');
pages(nameEntry.id,{command:1,id:nameEntry.id,shown:0,names:d.names});
const itemEntry=assets.text.bindings.entries.find(b=>b.parts.some(p=>p.markup?.['(ITEM_N)'])),treasure=assets.text.bindings.entries.find(b=>b.parts.some(p=>p.markup?.['(NUM)'])),variable=assets.text.bindings.entries.find(b=>b.parts.some(p=>p.markup?.['(KINGAKU)'])),party=assets.text.bindings.entries.find(b=>b.parts.some(p=>p.control?.[0]===5));
check(itemEntry&&treasure&&variable&&party,'Reviewed substitution bindings');
for(const item of assets.text.sourceIds.filter(id=>id>=1024&&id<1280).map(id=>id-1024))pages(itemEntry.id,{command:1,id:itemEntry.id,item});
// Every source price uses the actual runtime lookup, including 7F/80 boundary.
for(let item=0;item<256;item++)pages(treasure.id,{command:1,id:treasure.id,item},false,[0,127,128,166,255].includes(item));
for(const value of [0,1,999999,0xffffff])pages(variable.id,{command:1,id:variable.id,variable:value});
for(const value of [0,1,9999999,0xffffff])pages(party.id,{command:1,id:party.id,gil:value});
// Full six-slot name crossing the last column; no truncation to fit a page.
pages(nameEntry.id,{command:1,id:nameEntry.id,names:Array.from({length:24},(_,i)=>d.names[Math.floor(i/6)*6])});
add({command:1,id:itemEntry.id,item:1},{textError:25,visible:0});
add({command:1,id:itemEntry.id,item:0},{textError:27,visible:0});
const shownEntry=assets.text.bindings.entries.find(b=>b.parts.some(p=>Object.values(p.markup||{}).some(v=>v[0]===12)));check(shownEntry,'Shown-character binding');
function invalidName(entry,inputs,error){
 const m=assets.text.messages[assets.text.sourceIds.indexOf(entry.id)];let at=0;
 while(at<m.length){const w=m.readUInt16LE(at);if(w===12||w>=16&&w<=19)break;at+=w===64?6:w>=16&&w<40?4:2;}
 check(at<m.length,'Missing name control');const prefix=Buffer.concat([m.subarray(0,at),Buffer.alloc(2)]);let offset=0,page=0;
 do{const p=textPage(prefix,offset);check(!p.error,'Name prefix layout');offset=p.offset;page++;add(page===1?{command:1,id:entry.id,...inputs}:{key:'A'},p.more?{visible:1,more:1,page,cells:p.cells}:{textError:error,visible:0});if(!p.more)break;}while(page<200);
}
invalidName(shownEntry,{shown:1},27);
invalidName(nameEntry,{shown:0,names:Array(24).fill(0)},23);
for(const npc of [224,255])add({command:4,world:0,npc},{npcError:30,visible:0});
const unsupported=a.cases.find(c=>c.event&&a.events[c.event]&&!a.events[c.event].supported);check(unsupported,'Unsupported event coverage');add({command:4,world:unsupported.world,npc:unsupported.npc,flags:unsupported.flags},{npcError:32,visible:0});
const noop=a.cases.find(c=>c.event===0);if(noop)add({command:4,world:noop.world,npc:noop.npc,flags:noop.flags},{npcEvent:0,npcActive:0,visible:0});
// Restore the actual NPC, then exercise the viewer's real A-button entry.
add({command:3,world:d.world,npc:d.npc,flags:flagArray(1),names:d.names,shown:0,gil:0,item:166,variable:200},{visible:0});
const selected=npcOriginal(data,d.world,d.npc,flagArray(1)),id=(d.world?768:512)+selected.dialogue[a.events[selected.event].commands[0].operand];pages(id,{key:'A'},true);
const symbols={};for(const m of (await fs.readFile(dir+'/ff3-dialogue-viewer.noi','utf8')).matchAll(/DEF _(\w+) (0x[0-9a-f]+)/gi))symbols[m[1]]=Number(m[2]);
const out=ROOT+'/evidence/dialogue';await fs.mkdir(out,{recursive:true});const output=out+'/observations.json',configPath=output+'.config.json';let home;
if(process.argv.includes('--reuse')){const c=JSON.parse(await fs.readFile(configPath));check(c.romSha256===romSha256&&JSON.stringify(c.requests)===JSON.stringify(requests),'Stale dialogue observations');home=c.home;}
else{home=await fs.mkdtemp(ROOT+'/.local/mesen-dialogue-');await fs.writeFile(configPath,JSON.stringify({dll:local.mesenCore,home,rom,romSha256,coreSha256,symbols,requests,output}));try{const r=await promisify(execFile)(local.dotnet||'dotnet',[ROOT+'/tools/VerifyDialogue/bin/Release/net8.0/VerifyDialogue.dll',configPath],{cwd:ROOT,timeout:300000,maxBuffer:8e6});await fs.writeFile(output+'.log',r.stdout+r.stderr);}catch(e){await fs.writeFile(output+'.log',(e.stdout||'')+(e.stderr||''));throw e;}}
const actual=JSON.parse(await fs.readFile(output));check(actual.romSha256===romSha256&&actual.coreSha256===coreSha256&&actual.observations.length===requests.length,'Dialogue observations identity');
const scene={world:d.world,map:d.map,x:d.x,y:d.y,phase:0,flags:0},obj=objectReference(data,assets,scene),background=objectRgb(assets,scene,obj),screenshots=(await fs.readdir(home+'/Screenshots')).filter(p=>p.endsWith('.png')).sort().map(p=>home+'/Screenshots/'+p);let shot=0,peak=0,baseVram;
for(let i=0;i<requests.length;i++){const r=requests[i],e=expected[i],v=actual.observations[i],label=' request '+i,u16=x=>Buffer.from(x,'hex').readUInt16LE();
 check(v.error===(e.textError||0)&&(e.npcError===undefined||v.npcError===e.npcError),'Dialogue errors'+label+' '+JSON.stringify({expected:e.textError,npc:e.npcError,actual:v.error,npcActual:v.npcError}));
 check(v.bank===1&&(v.svbk&7)===1&&(v.vbk&1)===0&&!v.viewError&&v.guard==='a7'.repeat(16),'Dialogue memory/bank guard'+label+' view '+v.viewError);
 check(v.state===e.state&&v.oam===obj.oam.toString('hex'),'Dialogue changed state/OAM'+label);check(u16(v.loads)===i+1,'Dialogue request/joypad edge count'+label);
 for(const [k,key]of [['npcEvent','npcEvent'],['npcActive','npcActive'],['visible','visible'],['more','more'],['page','page']])if(e[k]!==undefined)check(v[key]===e[k],k+label+' expected '+e[k]+' got '+v[key]);
 if(e.npcText!==undefined)check(u16(v.npcText)===e.npcText,'F0 string selection'+label);if(e.dialogue)check(v.dialogue===e.dialogue,'NPC copied 32 IDs'+label);
 const names=Buffer.from(v.names,'hex');e.names.forEach((n,j)=>check(names.readUInt16LE(j*2)===n,'Name record changed'+label));
 if(e.number){const b=Buffer.from(e.number,'hex'),n=Buffer.from(v.number,'hex');for(let j=0;j<b.length;j++)check(n.readUInt16LE(j*2)===b[j],'Original numeric bytes'+label);}
 if(e.cells){const b=Buffer.from(v.cells,'hex');e.cells.forEach((n,j)=>check(b.readUInt16LE(j*2)===n,'Expanded text cell'+label+' cell '+j));peak=Math.max(peak,v.cacheCount);}
 if(r.screenshot){const b=Buffer.from(v.vram,'hex');if(!baseVram)baseVram=Buffer.from(b);for(const [start,end]of [[0x800,0x1c00],[0x2000,0x2c00],[0x3800,0x3c00]])check(b.subarray(start,end).equals(baseVram.subarray(start,end)),'Window damaged map/NPC VRAM'+label);
  const pixels=screenshotRgb(await fs.readFile(screenshots[shot++]));check(pixels.equals(e.visible?windowRgb(background,e.pixels,assets.text.glyphs):background),'Dialogue screenshot'+label);
 }
}
check(shot===screenshots.length,'Unexpected dialogue screenshots');const result={romSha256,coreSha256,requests:requests.length,comparisons:a.comparisons,screenshots,pixels:shot*160*144,joypadRequests:requests.filter(r=>r.key).length,peakCache:peak,normalGameplay:false,scope:'Injected source contexts, real NPC condition/event/text chain and button acknowledgement; movement, naming UI/save and audio scheduling pending'};await fs.writeFile(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,screenshots:shot},null,2));
