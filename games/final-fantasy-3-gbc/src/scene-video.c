/* Cold scene boundary, never part of the per-frame IRQ path. The original
 * FAB5/FADD swaps display dispatch while leaving sound state live. */
#pragma bank 15
#include <gb/cgb.h>
#include "text-vblank.h"
#ifdef FF3_SCENE_LAYOUT
#include "scene-memory.h"
#endif
volatile uint8_t scene_video_owner;
static void (*scene_publish)(void),(*scene_leave)(void);
static uint8_t (*scene_ready)(void);
uint8_t ff3_scene_video_attach(uint8_t id,void (*publish)(void),uint8_t (*ready)(void),void (*leave)(void)) BANKED {uint8_t ok=0,saved;
 if((id!=FF3_VIDEO_FIELD&&id!=FF3_VIDEO_BATTLE)||!publish||!ready||(uint16_t)publish>=0x4000u||(uint16_t)ready>=0x4000u||(uint16_t)leave>=0x4000u)return 0;
#ifdef FF3_SCENE_LAYOUT
 if(scene_arena_owner!=id)return 0;
#endif
 /* Only VBlank owns this callback list. A full DI across remove/add and
  * scene callbacks exceeds one audio timer period. Keep TIM live; each
  * callback's own small critical section still protects its local state. */
 CRITICAL{saved=IE_REG&VBL_IFLAG;IE_REG&=~VBL_IFLAG;}
 {
  if(scene_video_owner==id&&scene_publish==publish&&scene_ready==ready&&scene_leave==leave)ok=1;
  else if(!scene_video_owner&&ff3_text_transfer_idle()){
   scene_publish=publish;scene_ready=ready;scene_leave=leave;
   ff3_text_scene_hook(publish,1);scene_video_owner=id;ok=1;
  }
 }CRITICAL{IE_REG=(IE_REG&~VBL_IFLAG)|saved;}return ok;
}
uint8_t ff3_scene_video_detach(uint8_t id) BANKED {uint8_t ok=0,saved;
 CRITICAL{saved=IE_REG&VBL_IFLAG;IE_REG&=~VBL_IFLAG;}
 {
  if(id&&scene_video_owner==id&&ff3_text_transfer_idle()&&!(LCDC_REG&0x20)&&scene_ready()){
   ff3_text_scene_hook(scene_publish,0);DISABLE_OAM_DMA;
   if(scene_leave)scene_leave();scene_video_owner=0;scene_publish=0;scene_ready=0;scene_leave=0;ok=1;
  }
 /* Leave may disable STAT. Restore only the VBlank bit, not old IE. */
 }CRITICAL{IE_REG=(IE_REG&~VBL_IFLAG)|saved;}return ok;
}
