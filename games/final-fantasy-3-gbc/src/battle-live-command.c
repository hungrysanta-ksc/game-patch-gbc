#pragma bank 120
#include <string.h>
#include "battle-live-command.h"
#include "battle-command.h"
#include "battle-animation-video.h"
#include "battle-script-video.h"
#include "battle-strike-video.h"
#include "battle-motion-sprites.h"
#include "battle-entry-tail.h"
#include "battle-workspace.h"
#include "battle-encounter.h"
#include "battle-effect-freeze.h"
#include "battle-live-ui.h"
#include "scene-loop.h"
#include "memory.h"
#include "live-command-assets.h"
uint8_t command_request,command_error,command_phase,command_ready;
uint16_t command_serial;
extern Ff3EntryTail status_tail;
extern uint8_t ff3_game_state[1024];
extern uint8_t party_work;
extern volatile uint8_t party_profile;
void ff3_native_service(void) NONBANKED;
void ff3_party_copy(uint8_t bank,const void*src,void*dst,uint16_t n) NONBANKED;
/* Exclusive foreground calculation, before animation captures any of these
 * buffers. No mapped-bank pointers escape the bounded memory bridge. */
#define battle_result ((Ff3BattleResult*)0xd600)
#define rng ((FF3BattleRng*)battle_workspace.map)
#define fight ((Ff3Fight*)(battle_workspace.map+259))
#define call ((Ff3BattleCommand*)(battle_workspace.map+434))
static uint8_t transfer(uint16_t offset,void*p,uint16_t n,uint8_t write){uint8_t*b=p;uint16_t size;
 while(n){size=n>64?64:n;if(!ff3_wram_copy(5,offset,b,size,write)){command_error=1;return 0;}offset+=size;b+=size;n-=size;ff3_native_service();}return 1;
}
uint8_t ff3_live_command_init(void) BANKED {uint8_t i;const LiveCommandAsset*a;
 command_ready=command_request=command_error=command_phase=0;command_serial=0;
 if(scene_mode!=3)return 1;
 if(party_profile<4||party_profile>=LIVE_COMMAND_PROFILES+4){command_error=2;return 0;}a=live_command_assets+party_profile-4;
 /* AA00's party records are already resident. Extend that owner to all
  * twelve records; the enemy prototypes contain only original properties. */
 memset(battle_result,0,sizeof(*battle_result));if(!transfer(0,battle_result->records,256,0))return 0;
 for(i=0;i<8;i++){ff3_party_copy(a->bank,a->records+(uint16_t)i*64,battle_result->records[i+4],64);ff3_native_service();}
 ff3_party_copy(a->bank,a->records+512,battle_result->dead,8);
 memcpy(battle_result->types,status_tail.types,8);for(i=0;i<8;i++)battle_result->remaining+=battle_result->types[i]!=255;
 for(i=0;i<4;i++)if(battle_result->records[i][1]&1)battle_result->near|=128>>i;
 battle_result->first=encounter_first;battle_result->flags=a->flags;battle_result->message=255;
 if(!transfer(0,battle_result,sizeof(*battle_result),1))return 0;memset(fight,0,sizeof(*fight));if(!transfer(832,fight,sizeof(*fight),1))return 0;command_ready=1;return 1;
}
void ff3_live_command_update(void) BANKED {uint8_t i,a;const uint8_t*e;
 if(command_error)return;
 if(command_phase==2&&!action_request&&!action_enabled){
  if(!transfer(0,battle_result,sizeof(*battle_result),0))return;
  ff3_result_check(battle_result);if(!transfer(0,battle_result,sizeof(*battle_result),1))return;
  command_phase=battle_result->result?3:0; /* End owners must consume the battle_result. */
 }
 if(!command_request)return;
 if(!command_ready||command_phase||action_request||action_enabled||!live_ui_ready||effect_signed){command_error=3;return;}
 a=command_request-1;if(a>=12){command_error=4;return;}party_work=2;ff3_native_service();
 /* Preserve the cached frozen pixels only while their palette scratch still
  * belongs to the display owner. Calculation reuses it and invalidates it. */
 effect_freeze_cache_valid=0;
 if(!transfer(0,battle_result,sizeof(*battle_result),0))goto done;
 battle_result->actor=a;if(!transfer(832,fight,sizeof(*fight),0))goto done;
 for(i=0;i<4;i++){ff3_motion_rng_copy(battle_rng_cursor.variant,i*64,rng->table+(uint16_t)i*64);ff3_native_service();}
 memcpy(rng->counter,battle_rng_cursor.counter,3);
 if(a<4){e=ff3_game_state+512+(uint16_t)a*64;fight->equipment[0]=e[3];fight->equipment[1]=e[5];}
 fight->boss=battle_result->flags;
 if(!ff3_command_execute(battle_result,rng,fight,call)){command_error=5;goto done;}
 memcpy(battle_rng_cursor.counter,rng->counter,3);memcpy(strike_weapons,call->weapons,2);strike_critical=fight->critical;
 if(!transfer(0,battle_result,sizeof(*battle_result),1)||!transfer(832,fight,sizeof(*fight),1)||!transfer(1008,call,sizeof(*call),1))goto done;
 ff3_command_script(battle_result,fight,call,&action_script,ff3_game_state[16]&7);
 ff3_command_animation(battle_result,fight,call,&animation_state,status_tail.layout);
 command_request=0;command_phase=1;command_serial++;action_request=1;
 done:party_work=0;
}
uint8_t ff3_live_command_commit(uint8_t cannon) BANKED {
 /* Status is committed exactly at script 0D/0E after both numeral owners.
  * No outcome is published while a death-display barrier is outstanding. */
 if(command_phase!=1||!command_ready)return 0;
 if(effect_signed&&!ff3_effect_release(0)){command_error=7;return 0;}
 if(!transfer(0,battle_result,sizeof(*battle_result),0))return 0;
 if(!ff3_command_commit(battle_result,&animation_state,cannon)){command_error=6;return 0;}
 if(!transfer(0,battle_result,sizeof(*battle_result),1))return 0;
 ff3_live_ui_records((const uint8_t*)battle_result->records);
 command_phase=2;return 1;
}
