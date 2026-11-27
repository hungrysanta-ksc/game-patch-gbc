/* The full field/battle modules are linked; this entry exercises their shared
 * allocation boundary with continuous original audio, not a game victory. */
#pragma bank 75
#include <gb/cgb.h>
#include <string.h>
#include "platform.h"
#include "memory.h"
#include "scene-memory.h"
#include "scene-loop.h"
#include "scene-layout-config.h"
#include "text-vblank.h"
volatile uint8_t state_ready,state_start,state_status,state_failure;
volatile uint32_t state_case;
volatile uint16_t state_index;
extern volatile uint8_t native_request,native_done;
extern volatile uint16_t native_underruns,native_max_late;
extern uint8_t resident_effect_clone_valid;
void ff3_native_begin(void) NONBANKED;void ff3_native_service(void) NONBANKED;
void field_legacy_main(void) BANKED;void battle_legacy_main(void) BANKED;
static void require(uint8_t ok){state_case++;if(!ok&&!state_failure)state_failure=state_index;}
static uint8_t pattern(uint16_t at,uint8_t seed){return (uint8_t)at^(uint8_t)(at>>8)^seed;}
static void region(uint16_t at,uint16_t n,uint8_t seed,uint8_t check){uint16_t i;uint8_t ok=1;
 for(i=0;i<n;i++){if(check){if(*(uint8_t*)(at+i)!=pattern(i,seed))ok=0;}else *(uint8_t*)(at+i)=pattern(i,seed);if(!(i&63))ff3_native_service();}
 if(check)require(ok);
}
static void run(void) BANKED {uint8_t cycle;
 ff3_platform_init();ff3_memory_init();cpu_fast();DISPLAY_ON;HIDE_WIN;DISABLE_OAM_DMA;
 ff3_text_video_init();text_idle=ff3_native_service;state_ready=0xa5;while(!state_start){}
 /* Cold entry alternatives for existing full picture/audio regressions on
  * this exact combined ROM. Separate boots, not a field/battle roundtrip. */
 if(state_start==4){ff3_scene_run();while(1){ff3_native_service();__asm halt __endasm;}}
 if(state_start==2){ff3_scene_field_begin();field_legacy_main();}
 if(state_start==3){ff3_scene_field_begin();ff3_scene_battle_begin();battle_legacy_main();}
 ff3_native_begin();native_request=255;ff3_native_service();
 state_index=1;require(!ff3_scene_field_restore());require(!ff3_scene_battle_begin());require(ff3_scene_field_begin());require(!ff3_scene_field_begin());
 resident_effect_clone_valid=0xa7;memset(text_staging,0,16);ff3_text_copy(1,0x9000,text_staging,16);require(resident_effect_clone_valid==0xa7);
 memory_busy=1;require(!ff3_scene_battle_begin());memory_busy=0;
 SHOW_WIN;require(!ff3_scene_battle_begin());HIDE_WIN;
 for(cycle=0;cycle<64;cycle++){
  state_index=2;region(FF3_SCENE_ARENA,FF3_FIELD_DATA_BYTES,cycle,0);region(0xd000,3072,cycle+1,0);
  /* Common mutable gameplay state must keep battle changes on return. */
  ff3_game_state[512]=cycle;require(ff3_scene_battle_begin());require(scene_arena_owner==2);require(!ff3_scene_battle_begin());
  if(!cycle){ff3_memory_probe();require(memory_probe_done==0xff&&memory_probe_failures==1);require(!memory_probe_cases);}
  state_index=3;region(FF3_SCENE_ARENA,FF3_BATTLE_DATA_BYTES,cycle+2,0);region(0xd000,3072,cycle+3,0);ff3_game_state[512]=cycle+1;
  require(ff3_scene_field_restore());require(scene_arena_owner==1);require(ff3_game_state[512]==cycle+1);
  region(FF3_SCENE_ARENA,FF3_FIELD_DATA_BYTES,cycle,1);region(0xd000,3072,cycle+1,1);
  require((SVBK_REG&7)==1);require(!scene_arena_fault&&!memory_fault);
 }
 state_index=4;while(!native_done){ff3_native_service();__asm halt __endasm;}
 require(!native_underruns&&!native_max_late);state_status=state_failure?2:1;while(1){ff3_native_service();__asm halt __endasm;}
}
void main(void) NONBANKED {run();}
