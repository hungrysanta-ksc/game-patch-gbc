#include <gb/cgb.h>
#include "exploration.h"
#include "text-vblank.h"
uint8_t __at(0xdc00) field_oam[160];
uint8_t __at(0xdbc0) field_staging[64];
static volatile uint16_t strip_address;
static volatile uint8_t strip_index,strip_stride;
#define strip_pending field.upload_pending
static uint8_t ready(void){uint8_t ly=LY_REG;return ly>=144&&ly<=148&&(STAT_REG&3)==1;}
static uint8_t column_ready(void){uint8_t ly=LY_REG;return ly>=144&&ly<=150&&(STAT_REG&3)==1;}
/* Four strided tile/attribute pairs. Fixed DBC0/DBE0 staging, preserves BC.
 * Each critical batch is shorter than one double-speed scanline. */
static void column_four(void) __naked {__asm
 push bc
 ld a,(_strip_index)
 add #0xc0
 ld l,a
 ld h,#0xdb
 ld a,(_strip_address)
 ld e,a
 ld a,(_strip_address+1)
 ld d,a
 ld b,#4
91001$:
 xor a
 ldh (_VBK_REG),a
 ld a,(hl)
 ld (de),a
 ld a,l
 add #32
 ld l,a
 ld a,#1
 ldh (_VBK_REG),a
 ld a,(hl)
 ld (de),a
 ld a,l
 sub #31
 ld l,a
 ld a,e
 add #32
 ld e,a
 jr nc,91002$
 inc d
91002$:
 dec b
 jr nz,91001$
 xor a
 ldh (_VBK_REG),a
 ld a,e
 ld (_strip_address),a
 ld a,d
 ld (_strip_address+1),a
 ld a,(_strip_index)
 add #4
 ld (_strip_index),a
 pop bc
 ret
 __endasm;
}
/* Four tile/attribute pairs per short critical section; timer IRQs may run
 * between batches. The map ring is populated outside the visible viewport. */
static void strip_pump(void){uint8_t bank;
 if(!strip_pending)return;
 if(strip_stride==1){CRITICAL{if(ready()){
  for(bank=0;bank<2;bank++){VBK_REG=bank;HDMA1_REG=0xdb;HDMA2_REG=0xc0+bank*32;HDMA3_REG=strip_address>>8;HDMA4_REG=(uint8_t)strip_address;HDMA5_REG=(32>>4)-1;}
  VBK_REG=0;if((STAT_REG&3)!=1)field.video_fault=1;strip_pending=0;
 }}return;}
 while(strip_pending&&column_ready()){CRITICAL{if(column_ready()){column_four();if((STAT_REG&3)!=1)field.video_fault=1;}}
  if(strip_index==32)strip_pending=0;
 }
}
void ff3_field_strip(uint16_t address,uint8_t stride) NONBANKED {
 strip_address=address;strip_stride=stride;strip_index=0;strip_pending=1;
}
static void publish_irq(void) NONBANKED {
 /* GBDK's default VBlank handler transfers the selected OAM page first. */
 if(field.pending){SCX_REG=field.scroll_x;SCY_REG=field.scroll_y;field.pending=0;}
 __asm ei __endasm;
 strip_pump();
 __asm di __endasm;
}
void ff3_field_video_init(void) NONBANKED {CRITICAL{add_VBL(publish_irq);}}
void ff3_field_publish(uint8_t page,uint8_t x,uint8_t y) NONBANKED {
 CRITICAL{field.scroll_x=x;field.scroll_y=y;_shadow_OAM_base=page;field.pending=1;}
}
void ff3_field_flush(void) NONBANKED {
 while(field.pending||strip_pending){ff3_text_service();__asm halt __endasm;}
}
