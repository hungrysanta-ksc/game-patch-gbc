import fs from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {ROOT,check,hash} from './source.mjs';import {audioProducerSites} from './audio-producer-profile.mjs';
// Recreate the pinned effects producer listing, then verify every probe against
// the linked ROM's actual CALL target/hash span. No ROM bytes are patched.
export async function actionAudioAudit(dir,symbols,rom,local,listing){
 const compiler=local.gbdk+'/bin/lcc.exe',lock=JSON.parse(await fs.readFile(ROOT+'/spec/toolchain.json'));check(hash(await fs.readFile(compiler))===lock.gbdk.lccSha256,'Profile compiler identity');
 if(!listing){const r=await promisify(execFile)(compiler,['-msm83:gb','-DFF3_EFFECTS','-DFF3_AUDIO_FAST','-DFF3_SINGLE_ENGINE','-DFF3_BANKED_RUNTIME','-DFF3_TEXT_AUDIO','-DFF3_COMPOSITION_CACHE','-Dcache_request=party_work','-I'+dir+'/generated','-c','-o',dir+'/audio-native-profile.o',ROOT+'/src/audio-native.c'],{cwd:ROOT,maxBuffer:4e6});await fs.writeFile(dir+'/audio-native-profile.log',r.stdout+r.stderr);listing=dir+'/audio-native-profile.lst';}
 const sites=audioProducerSites(await fs.readFile(listing,'utf8'),symbols,rom);await fs.writeFile(dir+'/producer-sites.json',JSON.stringify(sites,null,2));
 return 'actionAudioSites={'+sites.map(s=>'{at='+s.at+',finish='+s.end+',kind='+s.kind+'}').join(',')+'}\n';
}
