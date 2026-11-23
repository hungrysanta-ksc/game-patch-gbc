#include <gb/cgb.h>
#include <string.h>
#include "composition-window.h"
#include "text-vblank.h"
#ifdef FF3_BATTLE_TIMELINE
#include "battle-timeline.h"
#endif
uint8_t scene_palette[96];
uint8_t __at(0xdc00) scene_oam0[160];
uint8_t __at(0xdd00) scene_oam1[160];
volatile uint8_t scene_pending;
static volatile uint8_t next_page,next_palette,next_x,next_y;
void ff3_scene_rom_copy(uint8_t bank,const void *source,void *target,uint16_t count) NONBANKED {
 uint8_t saved=CURRENT_BANK;SWITCH_ROM(bank);memcpy(target,source,count);SWITCH_ROM(saved);
}
/* Timer IRQs remain enabled during the palette copy; they do not use BCPS or
 * OCPS. The old BG/OBJ storage stays pinned until this VBlank publication. */
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
static void publish_irq(void) NONBANKED {
#ifdef FF3_BATTLE_TIMELINE
 if(battle_active){ff3_battle_vblank();return;}
#endif
 if(!scene_pending)return;
 __asm ei __endasm;
 if(next_palette)palette_copy();
 if((STAT_REG&3)!=1||LY_REG>152)scene_error=8;
 SCX_REG=next_x;SCY_REG=next_y;LCDC_REG=0x83|(next_page?8:0);scene_pending=0;
 __asm di __endasm;
}
#ifdef FF3_BATTLE_TIMELINE
/* GBDK 4.5.0 refresh_OAM() uses the fixed C000 shadow buffer. Its HRAM
 * entry .refresh_OAM reads __shadow_OAM_base, as the standard VBL does. */
void ff3_battle_oam_refresh(void) __naked {__asm
 .globl .refresh_OAM
 jp .refresh_OAM
 __endasm;
}
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
void ff3_scene_video_init(void) NONBANKED {CRITICAL{add_VBL(publish_irq);}}
void ff3_scene_publish(uint8_t page,uint8_t palette,uint8_t x,uint8_t y) NONBANKED {
 CRITICAL{next_page=page;next_palette=palette;next_x=x;next_y=y;_shadow_OAM_base=page?0xdd:0xdc;scene_pending=1;}
 while(scene_pending){ff3_text_service();__asm halt __endasm;}
}
