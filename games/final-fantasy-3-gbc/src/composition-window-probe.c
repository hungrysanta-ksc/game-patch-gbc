#include <gb/cgb.h>
#include <string.h>
#include "platform.h"
#include "memory.h"
#include "text-vblank.h"
#include "composition-window.h"
void ff3_native_begin(void) NONBANKED;
void ff3_native_service(void) NONBANKED;
void main(void){ff3_platform_init();ff3_memory_init();cpu_fast();DISPLAY_OFF;
 memset((void*)0xd000,0x6d,2032);memset((void*)0xdb70,0x6e,144);
 memset((void*)0xd7f0,0xa7,16);memset((void*)0xd940,0xa7,16);memset((void*)0xddf0,0xa7,16);
 memset(scene_oam0,0,160);memset(scene_oam1,0,160);_shadow_OAM_base=0xdc;SCX_REG=SCY_REG=0;WX_REG=167;*(volatile uint8_t*)0xff6c=0;
#ifdef FF3_BATTLE_TIMELINE
 /* During a hold, spend VBlank on the inactive page before scheduler overhead.
  * The transfer IRQ yields the entire publication VBlank to the scheduler. */
 ff3_scene_begin();ff3_text_video_init();ff3_scene_video_init();
#else
 ff3_text_video_init();ff3_scene_video_init();ff3_scene_begin();
#endif
 text_idle=ff3_native_service;LCDC_REG=0x83;ff3_native_begin();scene_ready=0xa5;
 while(1){ff3_native_service();if(scene_request)ff3_scene_run();else {__asm halt __endasm;}}
}
