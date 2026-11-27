#include <gb/cgb.h>
#include <stddef.h>
#include "exploration.h"
#include "text-vblank.h"
typedef char video_fault_offset[offsetof(FF3Exploration,video_fault)==39?1:-1];
uint8_t __at(0xdc00) field_oam[160];
uint8_t __at(0xdbc0) field_staging[64];
/* Named in the linker map for controlled tail-transfer verification. */
volatile uint16_t strip_address;
volatile uint8_t strip_index,strip_stride;
#define strip_pending field.upload_pending
static uint8_t ready(void){uint8_t ly=LY_REG;return ly>=144&&ly<=149&&(STAT_REG&3)==1;}
static uint8_t column_ready(void){uint8_t ly=LY_REG;return ly>=144&&ly<=150&&(STAT_REG&3)==1;}
/* Four strided tile/attribute pairs. Interleaved tile/attribute staging at DBC0, preserves BC.
 * At entry use two pairs if a timer is already pending, otherwise four. */
static void column_batch(uint8_t count) __naked {count;__asm
 push bc
 ld c,a
 ld b,a
 ld a,(_strip_index)
 add a,a
 add #0xc0
 ld l,a
 ld h,#0xdb
 ld a,(_strip_address)
 ld e,a
 ld a,(_strip_address+1)
 ld d,a
91001$:
 xor a
 ldh (_VBK_REG),a
 ld a,(hl+)
 ld (de),a
 ld a,#1
 ldh (_VBK_REG),a
 ld a,(hl+)
 ld (de),a
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
 add a,c
 ld (_strip_index),a
 pop bc
 ret
 __endasm;
}
/* Tight fixed-ROM pump: allow the timer between four-pair batches, without
 * repeating C call/stack overhead around every scanline check. Entry has IME=1. */
static void column_pump(void) __naked {__asm
91010$:
 di
 ldh a,(_LY_REG)
 cp #144
 jr c,91019$
 cp #151
 jr nc,91019$
 ldh a,(_STAT_REG)
 and #3
 cp #1
 jr nz,91019$
 ld a,(_strip_index)
 cp #30
 ld a,#4
 jr c,91012$
 ld a,#2
91012$:
 call _column_batch
 ldh a,(_STAT_REG)
 and #3
 cp #1
 jr z,91011$
 ld a,#1
 ld (_field+39),a
91011$:
 ei
 nop
 ld a,(_strip_index)
 cp #32
 jr c,91010$
 ret
91019$:
 ei
 ret
 __endasm;
}
/* One 32-byte row bank, with no indexed C loop in the interrupt path. */
static void row_one(void) __naked {__asm
 ld a,(_strip_index)
 ldh (_VBK_REG),a
 swap a
 add a,a
 add #0xc0
 ldh (_HDMA2_REG),a
 ld a,#0xdb
 ldh (_HDMA1_REG),a
 ld a,(_strip_address+1)
 ldh (_HDMA3_REG),a
 ld a,(_strip_address)
 ldh (_HDMA4_REG),a
 ld a,#1
 ldh (_HDMA5_REG),a
 xor a
 ldh (_VBK_REG),a
 ld a,(_strip_index)
 inc a
 ld (_strip_index),a
 ret
 __endasm;
}
static void row_step(void){CRITICAL{if(ready()){
 row_one();if((STAT_REG&3)!=1)field.video_fault=1;if(strip_index==2)strip_pending=0;
}}}
/* Four tile/attribute pairs per short critical section; timer IRQs may run
 * between batches. The map ring is populated outside the visible viewport. */
static void strip_pump(void){
 if(!strip_pending)return;
 if(strip_stride==1){while(strip_pending&&ready())row_step();return;}
 column_pump();if(strip_index==32)strip_pending=0;
}
void ff3_field_strip(uint16_t address,uint8_t stride) NONBANKED {
 strip_address=address;strip_stride=stride;strip_index=0;strip_pending=1;
}
static void publish_irq(void) NONBANKED {
 /* GBDK's default VBlank handler transfers the selected OAM page first. */
 /* A timer edge may already be waiting behind OAM DMA. Service it before
  * the first row/column batch: otherwise a previous audio dispatch plus DMA
  * and this batch can coalesce two timer edges at an unlucky phase. The
  * timer never touches field descriptors, ROM banks, scroll or VRAM. */
 __asm ei
 nop
 di __endasm;
 if(field.pending){SCX_REG=field.scroll_x;SCY_REG=field.scroll_y;field.pending=0;}
 /* Guarantee a bounded first transfer before a pending timer ISR. Admit it
  * before the remaining row bank/column batches; never mask a whole strip. */
 if(strip_pending){if(strip_stride==1)row_step();
  /* A prior timer-priority batch can leave index 30. Do not send four
   * pairs past 32: equality-based completion would then wait for wrap. */
  else if(column_ready()){column_batch(((IF_REG&TIM_IFLAG)||strip_index>=30)?2:4);if((STAT_REG&3)!=1)field.video_fault=1;if(strip_index==32)strip_pending=0;}
 }
 __asm ei __endasm;
 strip_pump();
 __asm di __endasm;
}
static uint8_t field_video_ready(void) NONBANKED {return !field.pending&&!strip_pending&&!field.render_busy&&!field.npc_busy&&!field.event_busy;}
void ff3_field_video_init(void) NONBANKED {if(!ff3_scene_video_attach(FF3_VIDEO_FIELD,publish_irq,field_video_ready,0))field.video_fault=1;}
uint8_t ff3_field_video_suspend(void) NONBANKED {ff3_field_flush();ff3_text_drain();return ff3_scene_video_detach(FF3_VIDEO_FIELD);}
void ff3_field_publish(uint8_t page,uint8_t x,uint8_t y) NONBANKED {
 CRITICAL{field.scroll_x=x;field.scroll_y=y;_shadow_OAM_base=page;field.pending=1;}
}
void ff3_field_flush(void) NONBANKED {
 while(field.pending||strip_pending){ff3_text_service();__asm halt __endasm;}
}
