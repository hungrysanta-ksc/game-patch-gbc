#include <gb/cgb.h>
#include <string.h>
#include "composition-window.h"
#include "text-vblank.h"
#if defined(FF3_BATTLE_TIMELINE) || defined(FF3_NUMBER_TIMELINE)
#include "battle-timeline.h"
#endif
uint8_t scene_palette[96];
uint8_t __at(0xdc00) scene_oam0[160];
uint8_t __at(0xdd00) scene_oam1[160];
volatile uint8_t scene_pending;
static volatile uint8_t next_page,next_palette,next_x,next_y;
#ifdef FF3_BATTLE_STREAM
void ff3_battle_oam_refresh(void);
#endif
void ff3_scene_rom_copy(uint8_t bank,const void *source,void *target,uint16_t count) NONBANKED {
 uint8_t saved=CURRENT_BANK;SWITCH_ROM(bank);memcpy(target,source,count);SWITCH_ROM(saved);
}
/* Timer IRQs remain enabled during the palette copy; they do not use BCPS or
 * OCPS. The old BG/OBJ storage stays pinned until this VBlank publication. */
#ifdef FF3_BATTLE_STREAM
/* Eight writes per loop cut the publication cost without masking the audio
 * timer across the palette. BG/OBJ/OAM still publish in one early VBlank. */
static void palette_copy(void) __naked {__asm
 ld hl,#_scene_palette
 ld a,#0x80
 ldh (_BCPS_REG),a
 ld c,#0x69
 ld b,#8
92011$:
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 dec b
 jr nz,92011$
 ld a,#0x80
 ldh (_OCPS_REG),a
 ld c,#0x6b
 ld b,#4
92012$:
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 ld a,(hl+)
 ldh (c),a
 dec b
 jr nz,92012$
 ret
 __endasm;
}
#else
static void palette_copy(void) __naked {__asm
 ld hl,#_scene_palette
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
 ld b,#32
92002$:
 ld a,(hl+)
 ldh (c),a
 dec b
 jr nz,92002$
 ret
 __endasm;
}
#endif
static void publish_irq(void) NONBANKED {
#if defined(FF3_BATTLE_TIMELINE) || defined(FF3_NUMBER_TIMELINE)
 if(battle_active){ff3_battle_vblank();return;}
#endif
 if(!scene_pending)return;
#ifdef FF3_BATTLE_STREAM
 /* A delayed VBL handler must defer the entire publication, including OAM. */
 {uint8_t ly=LY_REG;if(ly<144||ly>145||(STAT_REG&3)!=1)return;}
 _shadow_OAM_base=next_page?0xdd:0xdc;ff3_battle_oam_refresh();
#endif
 __asm ei __endasm;
 if(next_palette)palette_copy();
 if((STAT_REG&3)!=1||LY_REG>152)scene_error=8;
 SCX_REG=next_x;SCY_REG=next_y;LCDC_REG=0x83|(next_page?8:0);scene_pending=0;
 __asm di __endasm;
}
#if defined(FF3_BATTLE_TIMELINE) || defined(FF3_BATTLE_STREAM)
/* GBDK 4.5.0 refresh_OAM() uses the fixed C000 shadow buffer. Its HRAM
 * entry .refresh_OAM reads __shadow_OAM_base, as the standard VBL does. */
void ff3_battle_oam_refresh(void) __naked {__asm
 .globl .refresh_OAM
 jp .refresh_OAM
 __endasm;
}
#endif
#if defined(FF3_BATTLE_TIMELINE) || defined(FF3_NUMBER_TIMELINE)
/* Called with interrupts disabled, during VBlank. Refresh OAM here because
 * GBDK's regular OAM copy can precede this handler. BG and OBJ change together. */
void ff3_battle_commit(uint8_t page,uint8_t palette) NONBANKED {
 _shadow_OAM_base=page?0xdd:0xdc;ff3_battle_oam_refresh();
 __asm ei __endasm;
 if(palette)palette_copy();
 if((STAT_REG&3)!=1||LY_REG>152)scene_error=8;
 SCX_REG=SCY_REG=0;LCDC_REG=0x83|(page?8:0);
 __asm di __endasm;
}
#endif
#ifdef FF3_NUMBER_TIMELINE
void ff3_number_commit(uint8_t page) NONBANKED {
 __asm di __endasm;
 if(battle_entry==255){ff3_battle_commit(page,1);return;}
 /* OAM buffering is independent of the pinned BG/OBJ graphics page. */
 _shadow_OAM_base=page?0xdd:0xdc;ff3_battle_oam_refresh();
 /* Allow the timer between DMA and scheduler bookkeeping, as in the
  * map commit path. Masking both together can lose a pending timer edge. */
 __asm ei __endasm;
 if((STAT_REG&3)!=1||LY_REG>152)scene_error=8;
}
#endif
void ff3_scene_video_init(void) NONBANKED {CRITICAL{add_VBL(publish_irq);}}
void ff3_scene_publish(uint8_t page,uint8_t palette,uint8_t x,uint8_t y) NONBANKED {
 CRITICAL{next_page=page;next_palette=palette;next_x=x;next_y=y;
#ifndef FF3_BATTLE_STREAM
 _shadow_OAM_base=page?0xdd:0xdc;
#endif
 scene_pending=1;}
 while(scene_pending){ff3_text_service();__asm halt __endasm;}
}
