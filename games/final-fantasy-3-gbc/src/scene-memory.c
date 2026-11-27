/* Original 3F/FB17,F83B preserves field context, excluding live sound DP.
 * Here the whole field DATA arena and bank-1 workspace are preserved; this
 * conservative image also retains NPC/event state not yet reduced to a slice. */
#pragma bank 74
#include <string.h>
#include "scene-memory.h"
#include "scene-layout-config.h"
#include "text-vblank.h"
#include "memory.h"
void ff3_native_service(void) NONBANKED;
volatile uint8_t scene_arena_owner,scene_arena_fault;
static uint8_t saved_field;
static uint8_t idle(void){return !scene_arena_fault&&!scene_video_owner&&ff3_text_transfer_idle()&&!(LCDC_REG&0x20);}
static uint8_t copy(uint16_t address,uint16_t offset,uint16_t count,uint8_t write){uint16_t n;
 while(count){n=count>64?64:count;if(!ff3_wram_copy(7,offset,(void*)address,n,write)){scene_arena_fault=1;return 0;}
  address+=n;offset+=n;count-=n;ff3_native_service();
 }return 1;
}
uint8_t ff3_scene_field_begin(void) BANKED {
 if(scene_arena_owner||saved_field||!idle())return 0;
 memset((void*)FF3_SCENE_ARENA,0,FF3_FIELD_DATA_BYTES);scene_arena_owner=FF3_VIDEO_FIELD;return 1;
}
uint8_t ff3_scene_battle_begin(void) BANKED {
 if(scene_arena_owner!=FF3_VIDEO_FIELD||saved_field||!idle())return 0;
 if(!copy(FF3_SCENE_ARENA,0,FF3_FIELD_DATA_BYTES,1)||!copy(0xd000,FF3_FIELD_DATA_BYTES,3072,1))return 0;
 saved_field=1;memset((void*)FF3_SCENE_ARENA,0,FF3_BATTLE_DATA_BYTES);scene_arena_owner=FF3_VIDEO_BATTLE;return 1;
}
uint8_t ff3_scene_field_restore(void) BANKED {
 if(scene_arena_owner!=FF3_VIDEO_BATTLE||!saved_field||!idle())return 0;
 if(!copy(0xd000,FF3_FIELD_DATA_BYTES,3072,0)||!copy(FF3_SCENE_ARENA,0,FF3_FIELD_DATA_BYTES,0))return 0;
 saved_field=0;scene_arena_owner=FF3_VIDEO_FIELD;return 1;
}
