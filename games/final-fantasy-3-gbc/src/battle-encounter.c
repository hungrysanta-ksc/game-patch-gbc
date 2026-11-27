/* 2F/A02A,A0B7..A0E6,9FAA; 34/87BE..88E0. Resource selection consumes
 * the original count RNG before surprise/back-attack, retaining all counters.
 * Spatial catalog keys are exact. No diagnostic profile is a fallback. */
#pragma bank 117
#include <string.h>
#include "battle-encounter.h"
#include "battle-context.h"
#include "battle-workspace.h"
#include "battle-strike-video.h"
#include "battle-motion-sprites.h"
#include "battle-entry-tail.h"
#include "scene-loop.h"
#include "encounter-screen-assets.h"
extern uint8_t ff3_game_state[1024],message_monsters[12];
extern Ff3EntryTail status_tail;
extern volatile uint8_t party_work;
void ff3_native_service(void) NONBANKED;
uint8_t encounter_type,encounter_first,encounter_counts[4],encounter_error;
static uint8_t selected;
uint8_t ff3_encounter_prepare(void) BANKED {
 uint8_t i,j,k,n;Ff3Entry entry;FF3BattleRng*r=(FF3BattleRng*)battle_workspace.map;
 encounter_error=0;strike_rng_ready=0;
 if(scene_rng_ready!=1){encounter_error=1;return 0;}
 if(scene_background){encounter_error=2;return 0;}
 for(selected=0;selected<ENCOUNTER_FORMATIONS;selected++)if(encounter_bounds[selected][0]==scene_formation)break;
 if(selected==ENCOUNTER_FORMATIONS){encounter_error=3;return 0;}
 party_work=2;ff3_native_service();
 for(i=0;i<4;i++){ff3_motion_rng_copy((scene_rng_seed&2)>>1,i*64,r->table+(uint16_t)i*64);ff3_native_service();}
 r->counter[0]=r->counter[1]=r->counter[2]=scene_rng_seed;
 memset(&entry,0,sizeof(entry));entry.flags=encounter_bounds[selected][5];
 for(i=0;i<4;i++){
  n=encounter_bounds[selected][1+i];ff3_battle_random(r,0,n>>4,n&15,encounter_counts+i);
  entry.levels[i]=ff3_game_state[257+(uint16_t)i*64];
  entry.equipment_rows[i]=entry.battle_rows[i]=ff3_game_state[527+(uint16_t)i*64]&1;
 }
 for(i=0,k=4;i<4;i++)for(j=0;j<encounter_counts[i];j++){
  if(k>=12){encounter_error=4;return 0;}entry.levels[k++]=encounter_bounds[selected][10+i];
 }
 /* Normal low-byte formations on foot. World/vehicle entry owners remain
  * separately gated, not inferred from a stale save-position byte. */
 ff3_entry_rules(r,&entry);encounter_type=entry.formation;encounter_first=entry.first;
 for(i=0;i<ENCOUNTER_KEYS;i++){
  if(encounter_keys[i][0]!=scene_formation||encounter_keys[i][5]!=(encounter_type==0x88))continue;
  for(j=0;j<4&&encounter_keys[i][j+1]==encounter_counts[j];j++);
  if(j!=4)continue;
  scene_profile=encounter_keys[i][6];battle_rng_cursor.variant=(scene_rng_seed&2)>>1;memcpy(battle_rng_cursor.counter,r->counter,3);strike_rng_ready=1;scene_rng_ready=0;party_work=0;return 1;
 }
 encounter_error=5;return 0;
}
void ff3_encounter_names(void) BANKED {
 memcpy(message_monsters,status_tail.types,8);memcpy(message_monsters+8,encounter_bounds[selected]+6,4);
}
