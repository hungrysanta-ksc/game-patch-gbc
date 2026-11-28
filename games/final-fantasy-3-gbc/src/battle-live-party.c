/* 31/A400..A43F,A482; 34/9474,9D06; 31/AA16; 2E/9E64,9E01;
 * 2F/AA00,B304,B52A. Persistent character/equipment and transient battle
 * records retain separate owners. No fixed-profile party state survives. */
#pragma bank 79
#include <string.h>
#include "battle-live-party.h"
#include "battle-encounter.h"
#include "scene-loop.h"
#include "battle-equipment.h"
#include "battle-entry-tail.h"
#include "battle-party-oam.h"
#include "battle-status-oam.h"
#include "battle-workspace.h"
#include "battle-live-ui.h"
#include "battle-status-video.h"
#include "battle-effect-freeze.h"
#include "memory.h"
#include "text-vblank.h"
#include "live-party-assets.h"
extern uint8_t ff3_game_state[1024];
extern Ff3EntryDisplay party_motion;
extern Ff3PartyOam party_state;
extern Ff3EntryTail status_tail;
extern Ff3StatusOam status_state;
void ff3_party_copy(uint8_t bank,const void*src,void*dst,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
uint8_t live_party_error,live_party_ready;
void ff3_party_refresh_present(void) BANKED;
extern volatile uint8_t party_error;
uint8_t ff3_live_party_refresh(const uint8_t*status) BANKED {
 uint8_t i,error;
 if(!live_party_ready||status_stage!=2||status_tail.phase!=FF3_TAIL_DONE||effect_signed)return 0;
 for(i=0;i<4;i++)if((status[i*2]&192)==64){live_party_error=2;return 0;}
 /* 9E80 copies normalized status, B5B8 retains graphic-kind and position
  * caches. The source refresh never replays entry or recounts enemies. */
 for(i=0;i<4;i++){status_tail.motion.status[i]=status[i*2];status_tail.status2[i]=status[i*2+1];}
 effect_freeze_cache_valid=0;
 if(!ff3_entry_tail_refresh(&status_tail))return 0;
 status_stage=1;memcpy(&party_motion,&status_tail.motion,sizeof(party_motion));
 /* HIDE/STATUS are publication boundaries; LOAD copies are prepared by
  * advance before the next acknowledgement. Keep the old object hidden
  * while its six original dead-pose patterns replace the resident job. */
 for(;;){
  ff3_party_refresh_present();if(party_error)return 0;
  error=ff3_status_video_advance();if(error){live_party_error=10+error;return 0;}
  if(status_stage==2)break;
 }
 ff3_party_refresh_present();return !party_error;
}
#define record battle_workspace.map
uint8_t ff3_live_party_prepare(void) BANKED {
 uint8_t i,j,s,flags,icon,variant,job,*c,*e;uint16_t cur,max;
 live_party_ready=live_party_error=0;
 /* Validate the entire party before mutating canonical derived stats.
  * Stone's BG owner is absent in the combined renderer, not a normal pose. */
 for(i=0;i<4;i++){
  c=ff3_game_state+256+(uint16_t)i*64;e=ff3_game_state+512+(uint16_t)i*64;
  if(c[0]>=22){live_party_error=1;return 0;}
  if(c[2]&64){live_party_error=2;return 0;}
  for(j=0;j<3;j++)if(e[j]>=0x98){live_party_error=3;return 0;}
  if(e[3]>=0x62||e[5]>=0x62){live_party_error=3;return 0;}
 }
 for(i=0;i<4;i++){
  c=ff3_game_state+256+(uint16_t)i*64;e=ff3_game_state+512+(uint16_t)i*64;job=c[0];
  memset(record,0,64);record[0]=c[1];record[1]=c[2];memcpy(record+3,c+12,4);record[15]=c[16];
  for(j=0;j<8;j++)record[7+j]=c[48+j*2];
  ff3_party_copy(78,live_party_modifiers+(uint16_t)job*5,record+40,5);record[53]=record[44];record[44]=i;
  cur=c[12]|((uint16_t)c[13]<<8);max=c[14]|((uint16_t)c[15]<<8);
  if(!(record[1]&128)){if(cur<=(max>>2))record[1]|=1;else record[1]&=254;}
  s=record[1];party_motion.status[i]=(s&192)|((s&63)>>3);status_tail.status2[i]=(s&7)<<5;
  flags=((s&7)|((s&16)>>1))<<1;icon=255;
  if(!(s&192)&&flags){icon=0;while(!(flags&128)){flags<<=1;icon++;}}
  status_state.status[i]=icon;status_state.targets[i]=0;
  party_motion.rows[i]=(e[15]&1)^(scene_mode==3&&encounter_type==0x88);status_tail.jobs[i]=job;
  ff3_party_copy(78,live_party_palettes+(job?4+job:i),party_state.palette+i,1);
  /* 34/88A4 toggles the battle's equipment copy, not the field save owner. */
  j=e[15];e[15]=(j&254)|party_motion.rows[i];ff3_equipment_update(c,e,record);e[15]=(e[15]&254)|(j&1);ff3_native_service();
  if(!ff3_wram_copy(5,(uint16_t)i*64,record,64,1)){live_party_error=4;return 0;}
  s=party_motion.status[i];variant=job;status_tail.graphics[i]=0;
  if(s&4){variant=44;status_tail.graphics[i]=2;}
  else if(s&1){variant=45;status_tail.graphics[i]=3;}
  else if(s&128){variant+=22;status_tail.graphics[i]=1;}
  ff3_text_rom_copy(0,0x8010+(uint16_t)i*224,78,live_party_patterns+(uint16_t)variant*224,224);ff3_native_service();
 }
 ff3_live_ui_party_hp();live_party_ready=1;return 1;
}
void ff3_live_party_command(void) BANKED {
 uint8_t i;
 for(i=0;i<4;i++){
  status_state.x[i]=party_motion.x[i];status_state.y[i]=party_motion.y[i];
  if(status_state.status[i]<8){ff3_text_rom_copy(0,0x8490+(uint16_t)i*64,78,live_party_icons+(uint16_t)status_state.status[i]*64,64);ff3_native_service();}
 }
}
