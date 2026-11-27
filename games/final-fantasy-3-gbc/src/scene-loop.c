/* 3F/FA34..FA79: preserve context, exchange display owner, run battle,
 * restore context; sound state is excluded from the restored image. */
#pragma bank 76
#include <gb/cgb.h>
#include "scene-loop.h"
#include "scene-memory.h"
#include "text-vblank.h"
volatile uint8_t scene_mode,scene_request,scene_phase,scene_fault;
volatile uint8_t scene_cycles,scene_profile,scene_audio_boots;
extern volatile uint8_t native_request,native_argument;
void ff3_native_service(void) NONBANKED;
void field_legacy_main(void) BANKED;void battle_legacy_main(void) BANKED;
void ff3_scene_song(uint8_t song) BANKED {
 while(native_request){ff3_native_service();__asm halt __endasm;}
 native_argument=song;native_request=2;
 while(native_request){ff3_native_service();__asm halt __endasm;}
}
void ff3_scene_run(void) BANKED {
 scene_mode=1;
 if(!ff3_scene_field_begin()){scene_fault=1;return;}
 while(!scene_fault){
  field_legacy_main();if(scene_fault)return;
  scene_phase=2;
  if(!ff3_scene_battle_begin()){scene_fault=2;return;}
  battle_legacy_main();if(scene_fault)return;
  scene_phase=4;
  if(!ff3_scene_field_restore()){scene_fault=3;return;}
  scene_cycles++;
 }
}
