#include <gb/cgb.h>
#include "composition-cache.h"
#include "text-vblank.h"
uint8_t __at(0xda50) cache_palette[80];
uint8_t __at(0xdb00) cache_oam0[160];
uint8_t __at(0xdc00) cache_oam1[160];
volatile uint8_t cache_pending;
static volatile uint8_t next_page,next_palette;
/* Timer IRQs remain enabled during the palette copy; they do not use BCPS or
 * OCPS. The old BG/OBJ storage stays pinned until this VBlank publication. */
static void palette_copy(void) __naked {__asm
 ld hl,#_cache_palette
 ld a,#0x80
 ldh (_BCPS_REG),a
 ld c,#0x69
 ld b,#64
92001$:
 ld a,(hl+)
 ldh (c),a
 dec b
 jr nz,92001$
 ld a,#0x80
 ldh (_OCPS_REG),a
 ld c,#0x6b
 ld b,#16
92002$:
 ld a,(hl+)
 ldh (c),a
 dec b
 jr nz,92002$
 ret
 __endasm;
}
static void publish_irq(void) NONBANKED {
 if(!cache_pending)return;
 __asm ei __endasm;
 if(next_palette)palette_copy();
 if((STAT_REG&3)!=1||LY_REG>152)cache_error=8;
 LCDC_REG=0x93|(next_page?8:0);cache_pending=0;
 __asm di __endasm;
}
void ff3_cache_video_init(void) NONBANKED {CRITICAL{add_VBL(publish_irq);}}
void ff3_cache_publish(uint8_t page,uint8_t palette) NONBANKED {
 CRITICAL{next_page=page;next_palette=palette;_shadow_OAM_base=page?0xdc:0xdb;cache_pending=1;}
 while(cache_pending){ff3_text_service();__asm halt __endasm;}
}
