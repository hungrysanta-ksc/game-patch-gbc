import fs from 'node:fs/promises';
import path from 'node:path';
import {input,check,hash} from './source.mjs';
import {weaponDuration} from './battle-weapon-duration.mjs';
import {readWav} from './wav.mjs';
const i=process.argv.indexOf('--out');check(i>=0&&process.argv[i+1],'Required --out observation directory');const out=path.resolve(process.argv[i+1]);
const {data}=await input(),conditions=JSON.parse(await fs.readFile(out+'/conditions.json'));
check(conditions.romSha256===hash(data),'Observation ROM mismatch');
const results=[];
for(const c of conditions.cases)for(const row of c.rows){
 const dir=`L${c.characterLevel}-J${row.jobLevel}`,home=out+'/'+dir;
 const config=JSON.parse(await fs.readFile(home+'/config.json'));
 check(config.characterLevel===c.characterLevel&&config.jobLevel===row.jobLevel&&config.counter===c.counter,'Condition/config mismatch');
 const capture=JSON.parse(await fs.readFile(home+'/capture.json')),trace=await fs.readFile(home+'/trace.log','utf8');
 const events=[...trace.matchAll(/duration:(\w+),([\d,]+)/g)].map(m=>{const [frame,clock,value,hand,animationFrame,right,left,remaining,actor,rng]=m[2].split(',').map(Number);return{kind:m[1],frame,clock,value,hand,animationFrame,right,left,remaining,actor,rng};});
 const one=kind=>{const a=events.filter(e=>e.kind===kind);check(a.length===1,`Expected one ${kind}`);return a[0];};
 const start=one('start'),end=one('end'),expected=weaponDuration(data,{hits:row.hits});
 check(start.right===row.hits[0]&&start.left===row.hits[1]&&start.rng===row.rng&&start.actor===3,'Actual physical outcome differs');
 check(end.frame-start.frame===expected.weaponWaits,'Actual frame duration differs');
 for(const [kind,refKind] of [['swing','swing'],['slice','slice'],['sound','sound-request']]){
  const actual=events.filter(e=>e.kind===kind&&(kind!=='sound'||e.value===0xb6));
  const ref=expected.events.filter(e=>e.kind===refKind&&(kind!=='sound'||e.value===0xb6));
  check(JSON.stringify(actual.map(e=>[e.frame-start.frame,e.hand]))===JSON.stringify(ref.map(e=>[e.wait-expected.weaponStart,e.hand])),`${dir}: ${kind} count/timing mismatch`);
 }
 const names=(await fs.readdir(home+'/Screenshots')).filter(n=>n.endsWith('.png')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 check(names.length===capture.frames.length&&capture.ended>=0,'Incomplete capture');
 const images=[];for(const name of names){const b=await fs.readFile(home+'/Screenshots/'+name);check(b.subarray(1,4).toString()==='PNG'&&b.readUInt32BE(16)===256&&b.readUInt32BE(20)===240,'Capture dimensions');images.push({url:dir+'/Screenshots/'+name,sha256:hash(b)});}
 const wavBytes=await fs.readFile(home+'/original.wav'),{pcm,...audio}=readWav(wavBytes);check(audio.nonzero>0&&!audio.clipped,'Silent/clipped observation');
 results.push({characterLevel:c.characterLevel,jobLevel:row.jobLevel,counter:c.counter,hits:row.hits,swings:events.filter(e=>e.kind==='swing').length,sliceUpdates:events.filter(e=>e.kind==='slice').length,soundRequests:events.filter(e=>e.kind==='sound'&&e.value===182).length,weaponFrames:end.frame-start.frame,fps:capture.fps,images,audio:{...audio,url:dir+'/original.wav',sha256:hash(wavBytes)},traceSha256:hash(Buffer.from(trace))});
}
await fs.writeFile(out+'/verified.json',JSON.stringify({scope:'Controlled original NES observations, not GBC playback or natural progression',results},null,2));
const payload=JSON.stringify(results).replaceAll('<','\\u003c');
await fs.writeFile(out+'/index.html',`<!doctype html><meta charset="utf-8"><title>양파검사 직업 숙련도 비교</title><style>body{background:#121924;color:#e5ebf3;font:16px system-ui;max-width:1120px;margin:30px auto}section{display:flex;gap:24px}article{flex:1;min-width:0}img{width:100%;image-rendering:pixelated}button,select,input{margin:8px;font:inherit}input{width:70%}audio{width:100%}small{color:#adbdd1}</style><h1>직업 숙련도 1 ↔ 99 · 원작 NES 실측</h1><p>각 쌍은 캐릭터 레벨·무기·기본 능력치·적·시작 난수가 같습니다. 직업 숙련도만 바꾸고 원작 장비 계산으로 파생 능력치를 갱신했습니다.</p><label>고정 캐릭터 레벨 <select id="level"><option>1</option><option selected>33</option><option>99</option></select></label><button id="play">프레임 재생 / 정지</button><input id="seek" type="range" min="0" value="0"><span id="frame"></span><section><article><h2>직업 숙련도 1</h2><p id="aStat"></p><img id="a"><audio id="aAudio" controls></audio></article><article><h2>직업 숙련도 99</h2><p id="bStat"></p><img id="b"><audio id="bAudio" controls></audio></article></section><p><small>RAM 조작 실험입니다. 기본 능력치 5·오른손 검 0x1E·빈 왼손을 고정했으며 자연 성장한 캐릭터를 뜻하지 않습니다. 프레임 재생은 화면 비교용이고 아래 오디오는 각 관측의 원본 WAV입니다. 검 동작 전 준비 구간과 배경음도 포함합니다. 자동 음성 동기화는 하지 않습니다.</small></p><script>const data=${payload};let rows,playing=false,t=0;const el=id=>document.getElementById(id);function draw(){let n=+el('seek').value;rows.forEach((r,i)=>el(i?'b':'a').src=r.images[Math.min(n,r.images.length-1)].url);el('frame').textContent=n+' frame'}function select(){playing=false;rows=data.filter(r=>r.characterLevel===+el('level').value);rows.forEach((r,i)=>{let k=i?'b':'a';el(k+'Stat').textContent='명중 '+r.hits[0]+'회 · 칼질/효과음 '+r.swings+'회 · 무기 연출 '+r.weaponFrames+'프레임';el(k+'Audio').pause();el(k+'Audio').src=r.audio.url});el('seek').max=Math.max(...rows.map(r=>r.images.length))-1;el('seek').value=0;draw()}el('level').onchange=select;el('seek').oninput=()=>{playing=false;draw()};el('play').onclick=()=>{playing=!playing;if(+el('seek').value===+el('seek').max)el('seek').value=0};function tick(now){if(playing&&now-t>=1000/rows[0].fps){t=now;el('seek').value=+el('seek').value+1;draw();if(+el('seek').value>=+el('seek').max)playing=false}requestAnimationFrame(tick)}select();requestAnimationFrame(tick);</script>`);
console.log(JSON.stringify(results.map(({images,audio,...r})=>({...r,capturedFrames:images.length,audioSeconds:audio.seconds})),null,2));
