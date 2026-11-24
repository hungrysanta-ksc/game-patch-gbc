#include <gb/cgb.h>
#include "battle-item-video.h"
volatile uint8_t item_visible,item_next_visible,item_scroll_x,item_next_scroll,item_raster_fault;
volatile uint8_t item_scroll_step,item_scroll_right;
void ff3_item_scroll_vblank(void) NONBANKED {
 static const uint8_t offsets[]={13,27,40,53,67,80};
 uint8_t step=item_scroll_step,x;if(!step)return;
 x=offsets[step-1];item_scroll_x=item_scroll_right?x:80-x;
 item_scroll_step=step==6?0:step+1;
}
/* LYC97 arms the HBlank interrupt and returns immediately. HBlank97
 * publishes the bottom-only scroll/addressing split, then rearms LYC.
 * Neither interrupt waits for the PPU; AF is the only modified register. */
void ff3_item_lcd(void) NONBANKED __naked {__asm
 .globl _item_raster_begin, _item_raster_end
_item_raster_begin:
 push af
 ldh a,(_STAT_REG)
 and #3
 jr nz,item_raster_arm
 ; The mode-0 source is only armed on LY97. Keep its deadline path short;
 ; bank copies recheck LY under the IE mask before they can block this IRQ.
 ld a,(_item_visible)
 or a
 jr z,item_raster_done
 ld a,(_item_scroll_x)
 ldh (_SCX_REG),a
 ldh a,(_LCDC_REG)
 or #0x10
 ldh (_LCDC_REG),a
 ld a,#0x40
 ldh (_STAT_REG),a
_item_raster_end:
 pop af
 reti
item_raster_arm:
 ld a,(_item_visible)
 or a
 jr z,item_raster_done
 ldh a,(_LY_REG)
 cp #97
 jr nz,item_raster_late
 ld a,#8
 ldh (_STAT_REG),a
 jr item_raster_done
item_raster_late:
 ld (_item_raster_fault),a
 ld a,#0x40
 ldh (_STAT_REG),a
item_raster_done:
 jr _item_raster_end
 __endasm;
}
void ff3_item_video_init(void) NONBANKED {
 CRITICAL{LYC_REG=97;STAT_REG=(STAT_REG&7)|0x40;}
}
