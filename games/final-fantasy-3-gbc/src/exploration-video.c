#include <gb/cgb.h>
#include "exploration.h"
#include "text-vblank.h"
uint8_t __at(0xdc00) field_oam[160];
static volatile uint16_t strip_address;
static volatile uint8_t strip_pending,strip_index,strip_stride;
static uint8_t ready(void){uint8_t ly=LY_REG;return ly>=144&&ly<=148&&(STAT_REG&3)==1;}
/* Four tile/attribute pairs per short critical section; timer IRQs may run
 * between batches. The map ring is populated outside the visible viewport. */
static void strip_pump(void){uint8_t j,i=strip_index;uint16_t address=strip_address;
 while(strip_pending&&ready()){CRITICAL{if(ready())for(j=0;j<4;j++){
  VBK_REG=0;*(volatile uint8_t*)address=text_staging[i];VBK_REG=1;*(volatile uint8_t*)address=text_staging[32+i];VBK_REG=0;
  if((STAT_REG&3)!=1)field.video_fault=1;address+=strip_stride;i++;
 }}if(i==32)strip_pending=0;}strip_index=i;strip_address=address;
}
void ff3_field_strip(uint16_t address,uint8_t stride) NONBANKED {
 strip_address=address;strip_stride=stride;strip_index=0;strip_pending=1;
 while(strip_pending){ff3_text_service();__asm halt __endasm;}
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
 while(field.pending){ff3_text_service();__asm halt __endasm;}
}
