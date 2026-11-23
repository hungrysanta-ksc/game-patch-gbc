import fs from 'node:fs/promises';import {check,hash} from './source.mjs';
import {dialogueAssets} from './dialogue-source.mjs';import {fontMap,glyphFor,parseTsv,textKinds} from './korean-text.mjs';
export const dialogueKinds=[...textKinds,'dialogueSource','itemPrices','jong'];
export async function prepareDialogue(rom,assets,config){
 dialogueAssets(rom,assets);const map=fontMap(await fs.readFile(config.font)),jong=Buffer.alloc(294);
 for(const [ch,id]of map)if((ch.codePointAt(0)-0xac00)%28)jong[(id-256)>>3]|=1<<((id-256)&7);
 assets.groups.jong=[jong];assets.provenance.push({kind:'jong',id:0,bytes:jong.length,sha256:hash(jong),source:'Unicode Hangul final-consonant arithmetic mapped to approved EUC-KR font IDs',consumer:'Korean particle extension 0040'});
 const d=assets.text.bindings.diagnostic;check(d&&d.names.length===4,'Private dialogue diagnostic config');
 for(const k of ['world','map','npc','flag','slot','x','y'])check(Number.isInteger(d[k])&&d[k]>=0&&d[k]<256,'Diagnostic byte '+k);
 check(d.npc<224&&d.slot<12&&d.flag<128&&d.x<=44&&d.y<=46,'Diagnostic input bounds');
 check(Array.isArray(d.sources)&&d.sources.length>0&&d.sources.length<=255&&d.sources.every(id=>Number.isInteger(id)&&id>=0&&id<1712),'Diagnostic source IDs');
 const ja=parseTsv(await fs.readFile(config.translationDir+'/system_ja.txt','utf8')),ko=parseTsv(await fs.readFile(config.translationDir+'/system_ko.txt','utf8')),names=[];
 for(const p of d.names){check(hash(Buffer.from(ja.get(p.key)))===p.jaSha256&&hash(Buffer.from(ko.get(p.key)))===p.koSha256,'Diagnostic name review');const chars=[...ko.get(p.key)];check(chars.length<=6,'Diagnostic name longer than source six slots');names.push(...chars.map(c=>glyphFor(c,map)),...Array(6-chars.length).fill(255));}
 assets.dialogue.diagnostic={...d,names};return '#define DIALOGUE_WORLD '+d.world+'u\n#define DIALOGUE_MAP '+d.map+'u\n#define DIALOGUE_X '+d.x+'u\n#define DIALOGUE_Y '+d.y+'u\n#define DIALOGUE_NPC '+d.npc+'u\n#define DIALOGUE_SLOT '+d.slot+'u\n#define DIALOGUE_FLAG '+d.flag+'u\nstatic const uint16_t dialogue_names[]={'+names.join(',')+'};\nstatic const uint16_t dialogue_examples[]={'+d.sources.join(',')+'};\n#define DIALOGUE_EXAMPLES '+d.sources.length+'u\n';
}
