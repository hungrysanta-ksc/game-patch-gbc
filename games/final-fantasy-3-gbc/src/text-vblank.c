#include <gb/cgb.h>
#include "text-vblank.h"
void (*text_idle)(void);
volatile uint8_t text_transfer_busy,text_transfer_fault,text_transfer_max_ly;
volatile uint16_t text_transfer_chunks,text_transfer_bytes,text_transfer_frames,text_transfer_max_frames;
uint8_t __at(0xd950) text_staging[256];
void ff3_text_service(void) NONBANKED {if(text_idle)text_idle();}
/* Recheck inside the short critical section: the timer ISR can return after
 * the LCD has left VBlank. Never wait with interrupts disabled. Reserve the
 * final three scanlines, including LY's early reset on line 153. */
static uint8_t ready(void){return LY_REG>=144&&LY_REG<=150&&(STAT_REG&3)==1;}
static void wait(void){while(!ready()){ff3_text_service();__asm halt __endasm;}}
static void measured(void){uint8_t ly=LY_REG;if(ly>text_transfer_max_ly)text_transfer_max_ly=ly;if((STAT_REG&3)!=1||!(LCDC_REG&128))text_transfer_fault=1;}
void ff3_text_copy(uint8_t bank,uint16_t address,const uint8_t *data,uint16_t count) NONBANKED {
 uint8_t n,done;
 if(((uint16_t)data|address|count)&15){text_transfer_fault=1;return;}
 /* GDMA: at most eight 16-byte blocks (~61 us), not one long interrupt stall.
  * Staging is WRAM; asset-bank switches cannot change the transfer source. */
 while(count){n=count>128?128:(uint8_t)count;done=0;
  do{ff3_text_service();wait();CRITICAL{if(ready()){
   VBK_REG=bank;HDMA1_REG=(uint16_t)data>>8;HDMA2_REG=(uint8_t)(uint16_t)data;
   HDMA3_REG=address>>8;HDMA4_REG=(uint8_t)address;HDMA5_REG=(n>>4)-1;
   VBK_REG=0;measured();done=1;
  }}}while(!done);
  text_transfer_chunks++;text_transfer_bytes+=n;address+=n;data+=n;count-=n;
 }
}
void ff3_text_video(uint8_t visible) NONBANKED {uint8_t done=0;do{ff3_text_service();wait();CRITICAL{if(ready()){if(visible){WX_REG=7;WY_REG=80;LCDC_REG|=0xe0;}else HIDE_WIN;measured();done=1;}}}while(!done);}
void ff3_text_palette(const uint16_t *colors) NONBANKED {uint8_t i,done=0;const uint8_t *p=(const uint8_t*)colors;do{ff3_text_service();wait();CRITICAL{if(ready()){BCPS_REG=0xb8;for(i=0;i<8;i++)BCPD_REG=p[i];measured();done=1;}}}while(!done);}
