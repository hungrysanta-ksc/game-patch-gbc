import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,check,hash} from './source.mjs';
export async function actionOamAudit(dir,symbols,rom,local,listingPath){
 const compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));
 check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'OAM profile compiler');
 if(!listingPath){const r=await promisify(execFile)(compiler,['-msm83:gb','-DFF3_BANKED_RUNTIME','-c','-o',dir+'/action-oam-profile.o',ROOT+'/src/battle-action-oam.c'],{cwd:ROOT,maxBuffer:4e6});
  await fs.writeFile(dir+'/action-oam-profile.log',r.stdout+r.stderr);listingPath=dir+'/action-oam-profile.lst';}
 const listing=await fs.readFile(listingPath,'utf8'),sites=[];
 for(const name of ['ff3_action_oam_begin','ff3_action_oam_finish']){
  const marker=new RegExp('^\\s+([0-9A-F]{8})\\s+\\d+ _'+name+'::','m'),match=listing.match(marker);check(match,'OAM profile anchor');
  const start=parseInt(match[1],16),tail=listing.slice(match.index+match[0].length),ret=tail.match(/^\s+([0-9A-F]{8}) C9\s+.*\bret\s*$/m);
  check(ret,'OAM profile return');const at=symbols[name]&65535,bank=symbols[name]>>>16,end=at+parseInt(ret[1],16)-start;
  check(bank===56&&end<0x8000&&rom[bank*16384+(end&16383)]===0xc9,'Linked OAM return');
  for(const line of tail.slice(0,ret.index+ret[0].length).split(/\r?\n/)){
   const m=line.match(/^\s+([0-9A-F]{8}) ([0-9A-Frs ]+)\s+\[/);if(!m)continue;
   let offset=bank*16384+(at&16383)+parseInt(m[1],16)-start;
   for(const b of m[2].matchAll(/([rs]?)([0-9A-F]{2})/g)){if(!b[1])check(rom[offset]===parseInt(b[2],16),'Linked OAM instruction '+name+' '+offset.toString(16));offset++;}
  }
  sites.push({at,end,bank,name});
 }
 return 'actionOamBank='+symbols._current_bank+'\nactionOamSites={'+sites.map(s=>'{at='+s.at+',finish='+s.end+',bank='+s.bank+',name="'+s.name+'"}').join(',')+'}\n';
}
