import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ROOT,check,hash} from './source.mjs';
// Observe the existing fixed-ROM VBlank callback. No probe instructions.
export async function publicationAudit(dir,symbols,rom,local){
 const compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));
 check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Publication profile compiler');
 const r=await promisify(execFile)(compiler,['-msm83:gb',...['FF3_EFFECTS','FF3_AUDIO_FAST','FF3_LIVE_UI','FF3_STATUS_VIDEO','FF3_TERRAIN','FF3_RESIDENT_BG','FF3_SINGLE_ENGINE','FF3_BANKED_RUNTIME','FF3_TEXT_AUDIO','FF3_COMPOSITION_CACHE'].map(s=>'-D'+s),'-Dcache_request=party_work','-I'+dir+'/generated','-c','-o',dir+'/party-publication-profile.o',ROOT+'/src/battle-party-video.c'],{cwd:ROOT,maxBuffer:4e6});
 await fs.writeFile(dir+'/party-publication-profile.log',r.stdout+r.stderr);
 const listing=await fs.readFile(dir+'/party-publication-profile.lst','utf8');
 const offset=name=>{const m=listing.match(new RegExp('^\\s+([0-9A-F]{8})\\s+\\d+ _'+name+':+','m'));check(m,'Publication listing anchor '+name);return parseInt(m[1],16);};
 const at=symbols.ff3_party_copy+offset('publish')-offset('ff3_party_copy');
 check(at>0&&at+9<0x4000&&rom.subarray(at,at+7).equals(Buffer.from([0xf0,0x44,0x4f,0xaf,0xe0,0x43,0xfa]))&&rom.readUInt16LE(at+7)===symbols.party_pending,'Linked publication LY/pending reads');
 return 'actionPublicationSite='+at+'\n';
}
