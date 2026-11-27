import {check,hash} from './source.mjs';
import {stateCpu,sourceInitialState} from './state-source.mjs';
import {cgbPalette} from './field-source.mjs';
import {dungeonEntry} from './dungeon-source.mjs';
const offset=(bank,cpu)=>16+bank*8192+(cpu&8191);
// Precompose only the platform representation; original pose bytes remain in the report.
export function gbcPoses(bytes,palette=0){const out=Buffer.alloc(bytes.length);for(let at=0;at<bytes.length;at+=8)for(let q=0;q<4;q++){const j=[0,2,1,3][q]*2,a=bytes[at+j+1];out[at+q*2]=bytes[at+j];out[at+q*2+1]=8+palette+(a&1)+((a&64)?32:0)+((a&128)?64:0)+((a&32)?128:0);}return out;}
export function explorationAssets(rom,assets,song,{event=false,dungeon=false}={}){
 const d=assets.dialogue.diagnostic,entry=dungeon?dungeonEntry(rom):null,map=entry?.map??(event?10:29),start=entry?.start??(event?[3,29]:[10,10]);check(d.world===0&&d.map===map,'Exploration entry is the reviewed source scene');
 const state=sourceInitialState(rom),c=stateCpu(rom);c.banks=[0x3a,0x3b,0x3e,0x3f];c.m.set(state,0x6000);c.m.set(assets.groups.properties[map],0x780);c.m[0x2d]=1;c.call(0x9091);
 const palette=cgbPalette([...c.m.subarray(0x3d0,0x3d8)]),poses=rom.subarray(offset(0x3e,0xdc1a),offset(0x3e,0xdc1a)+80),rate=rom[offset(0x39,0xbe00)+map];
 check((dungeon?rate===entry.rate:rate===0)&&state[0x100]===0&&state[0x102]===0,'Reviewed healthy onion-knight field entry');
 return {config:`#define FIELD_WORLD 0u\n#define FIELD_MAP ${map}u\n#define FIELD_START_X ${start[0]}u\n#define FIELD_START_Y ${start[1]}u\n#define FIELD_RATE ${rate}u\n#define FIELD_SONG ${song}u\n`,art:'static const uint8_t field_npc_poses[]={'+[...gbcPoses(assets.groups.npcPoses[0])]+'};\n#define FIELD_GRAPHIC 0u\nstatic const uint8_t field_player_poses[]={'+[...Buffer.concat([poses.subarray(0,16),gbcPoses(poses.subarray(16),2)])]+'};\nstatic const uint16_t field_player_palette[]={'+Array.from({length:8},(_,i)=>palette.readUInt16LE(i*2))+'};\n',report:{world:0,map,start,entry:'Development entry on the original map, not a new-game spawn',rate,song,playerGraphics:'NPC graphics asset 0, original 0E/8000',poses:{offset:offset(0x3e,0xdc1a),bytes:80,sha256:hash(poses),consumer:'3E/D8D3..D97B'},palette:{consumer:'Unmodified 3A/9091 and 9050 with original initialized state',sha256:hash(palette)},paletteBytes:[...palette],posesBytes:[...poses]}};
}
