#include <gb/cgb.h>
#include <string.h>
#include "text-vblank.h"
void (*text_idle)(void);
volatile uint8_t text_transfer_busy,text_transfer_fault,text_transfer_max_ly;
volatile uint16_t text_transfer_chunks,text_transfer_bytes,text_transfer_frames,text_transfer_max_frames;
uint8_t __at(0xd950) text_staging[256];
static volatile uint8_t pending,owner,transfer_bank;
static volatile uint16_t transfer_source,transfer_address,transfer_count;
void ff3_text_service(void) NONBANKED {if(text_idle)text_idle();}
/* LY resets from 153 to 0 before VBlank ends. Two reads can accidentally
 * combine 153 >= 144 with 0 <= 150; sample once, including under DI. */
/* Allow one scanline for descriptor/register setup: DMA starts by line 150. */
static uint8_t ready(void){uint8_t ly=LY_REG;return ly>=144&&ly<=149&&(STAT_REG&3)==1;}
static void measured(void){uint8_t ly=LY_REG;if(ly>text_transfer_max_ly)text_transfer_max_ly=ly;if((STAT_REG&3)!=1||!(LCDC_REG&128))text_transfer_fault=1;}
/* Fixed-ROM callers; the descriptor references only WRAM, regardless of the
 * asset/audio ROM bank interrupted. The owner prevents main/ISR reentry. */
static void pump(void){uint8_t taken=0,n,i;
 CRITICAL{if(pending&&!owner&&ready()){owner=1;taken=1;}}
 if(!taken)return;
 if(pending==1){
  while(transfer_count&&ready()){
   n=transfer_count>128?128:(uint8_t)transfer_count;taken=0;
   CRITICAL{if(ready()){
    VBK_REG=transfer_bank;HDMA1_REG=transfer_source>>8;HDMA2_REG=(uint8_t)transfer_source;
    HDMA3_REG=transfer_address>>8;HDMA4_REG=(uint8_t)transfer_address;HDMA5_REG=(n>>4)-1;
    VBK_REG=0;measured();taken=1;
   }}
   if(!taken)break;
   transfer_source+=n;transfer_address+=n;transfer_count-=n;text_transfer_chunks++;text_transfer_bytes+=n;
  }
  if(!transfer_count)pending=0;
 }else if(pending==5){
  /* One palette per bounded critical section; the timer can run between
   * palettes. Reuse the transfer descriptor and keep the source in WRAM. */
  while(transfer_count&&ready()){
   taken=0;
   CRITICAL{if(ready()){
    if(transfer_bank){BCPS_REG=0x80|(uint8_t)transfer_address;for(i=0;i<8;i++)BCPD_REG=((const uint8_t*)transfer_source)[i];}
    else {OCPS_REG=0x80|(uint8_t)transfer_address;for(i=0;i<8;i++)OCPD_REG=((const uint8_t*)transfer_source)[i];}
    measured();taken=1;
   }}
   if(!taken)break;
   transfer_source+=8;transfer_address+=8;transfer_count--;
  }
  if(!transfer_count)pending=0;
 }else{
  CRITICAL{if(ready()){
   if(pending==2){BCPS_REG=0xb8;for(i=0;i<8;i++)BCPD_REG=text_staging[i];}
   else if(pending==3){WX_REG=7;WY_REG=80;LCDC_REG|=0xe0;}
   else HIDE_WIN;
   measured();pending=0;
  }}
 }
 owner=0;
}
static void video_irq(void) NONBANKED {
 /* Timer preserves registers and never touches the descriptor, banks or VRAM.
  * Permit timer IRQs between the bounded 128-byte DMA critical sections. */
 __asm ei __endasm;
 pump();
 __asm di __endasm;
}
void ff3_text_video_init(void) NONBANKED {CRITICAL{add_VBL(video_irq);}}
static void finish(void){while(pending){pump();if(pending){ff3_text_service();if(pending){__asm halt __endasm;}}}}
void ff3_text_copy(uint8_t bank,uint16_t address,const uint8_t *data,uint16_t count) NONBANKED {
 if(!count)return;
 if(pending||count>256||((uint16_t)data|address|count)&15||(uint16_t)data<0xd950||(uint16_t)data>0xda50-count){text_transfer_fault=1;return;}
 transfer_source=(uint16_t)data;transfer_address=address;transfer_count=count;transfer_bank=bank;pending=1;finish();
}
void ff3_text_video(uint8_t visible) NONBANKED {
 if(!visible&&!(LCDC_REG&0x20))return;
 pending=visible?3:4;finish();
}
void ff3_text_palette(const uint16_t *colors) NONBANKED {memcpy(text_staging,colors,8);pending=2;finish();}
void ff3_text_palette_range(uint8_t bg,uint8_t first,uint8_t count,const uint8_t *data) NONBANKED {
 if(!count)return;
 if(pending||bg>1||first>=8||count>8-first||(uint16_t)data<0xd950||(uint16_t)data>0xda50-(uint16_t)count*8){text_transfer_fault=1;return;}
 transfer_source=(uint16_t)data;transfer_address=(uint16_t)first*8;transfer_count=count;transfer_bank=bg;pending=5;finish();
}
