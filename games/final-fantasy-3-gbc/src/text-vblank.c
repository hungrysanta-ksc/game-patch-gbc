#include <gb/cgb.h>
#include <string.h>
#include "text-vblank.h"
void (*text_idle)(void);
volatile uint8_t text_transfer_busy,text_transfer_fault,text_transfer_max_ly;
volatile uint16_t text_transfer_chunks,text_transfer_bytes,text_transfer_frames,text_transfer_max_frames;
uint8_t __at(0xd950) text_staging[256];
static volatile uint8_t pending,owner,transfer_bank,transfer_rom_bank;
#ifdef FF3_EFFECTS
static volatile uint8_t transfer_dma_length,restore_block;
static uint16_t restore_page;
/* Membership scratch has no live owner after OAM is restored. */
extern uint8_t __at(0xd380) effect_members[320];

#endif
static volatile uint16_t transfer_source,transfer_address,transfer_count;
#ifdef FF3_EFFECTS
static void restore_next(void){uint8_t first=effect_members[restore_block++],bank;
 if(first==255){transfer_count=0;return;}
 transfer_count=(uint16_t)effect_members[restore_block++]*16;
 if(first==72){transfer_source=0xd480u;transfer_address=0x84a0u;transfer_bank=0;transfer_rom_bank=4;pending=9;return;}
 bank=first>=36;transfer_source=0xd000u+(uint16_t)first*16;transfer_address=restore_page+(uint16_t)(first-bank*36)*16;transfer_bank=bank;
}

extern uint8_t resident_effect_clone_valid;
static void invalidate_clone(uint8_t bank,uint16_t address,uint16_t count){
 if(bank&&address<0x9800u&&(address>=0x9000u||count>0x9000u-address))resident_effect_clone_valid=0;
}
#endif
void ff3_text_service(void) NONBANKED {if(text_idle)text_idle();}
/* LY resets from 153 to 0 before VBlank ends. Two reads can accidentally
 * combine 153 >= 144 with 0 <= 150; sample once, including under DI. */
/* Allow one scanline for descriptor/register setup: DMA starts by line 150. */
static uint8_t ready(void){uint8_t ly=LY_REG;return ly>=144&&ly<=149&&(STAT_REG&3)==1;}
static void measured(void){uint8_t ly=LY_REG;if(ly>text_transfer_max_ly)text_transfer_max_ly=ly;if((STAT_REG&3)!=1||!(LCDC_REG&128))text_transfer_fault=1;}
/* Fixed-ROM callers. ROM-source DMA maps and restores its bank entirely
 * inside one bounded DI section; no BANKED calls or timer bank changes.
 * Ordinary updates remain 128 bytes; double-speed initial loads use 256.
 * Other descriptors reference WRAM. The owner prevents main/ISR reentry. */
static void pump(void){uint8_t taken=0,i,saved;uint16_t n,limit;
 CRITICAL{if(pending&&!owner&&ready()){owner=1;taken=1;}}
 if(!taken)return;
 if(pending==1||pending==6||pending==7
#ifdef FF3_EFFECTS
 ||pending==8||pending==9
#endif
 ){
  while(transfer_count&&ready()){
   limit=pending==1?128:256;n=transfer_count>limit?limit:transfer_count;taken=0;
   CRITICAL{if(ready()){
    __asm
     .globl _ff3_text_dma_begin
     _ff3_text_dma_begin = .
    __endasm;
    saved=CURRENT_BANK;if(pending==6){
     __asm
      .globl _ff3_text_rom_dma_begin
      _ff3_text_rom_dma_begin = .
     __endasm;
     SWITCH_ROM(transfer_rom_bank);
    }
    VBK_REG=transfer_bank;HDMA1_REG=transfer_source>>8;HDMA2_REG=(uint8_t)transfer_source;
    HDMA3_REG=transfer_address>>8;HDMA4_REG=(uint8_t)transfer_address;

#ifdef FF3_EFFECTS
    if(pending==8||pending==9){
     transfer_dma_length=(n>>4)-1;
     __asm
       .globl _ff3_text_wram_dma_begin
      _ff3_text_wram_dma_begin = .
      ldh a,(_IE_REG)
      push af
      xor a
      ldh (_IE_REG),a
      ld a,(_transfer_rom_bank)
      ldh (_SVBK_REG),a
      ld a,(_transfer_dma_length)
      ldh (_HDMA5_REG),a
      ld a,#1
      ldh (_SVBK_REG),a
      pop af
      ldh (_IE_REG),a
      .globl _ff3_text_wram_dma_end
      _ff3_text_wram_dma_end = .
     __endasm;
    }else
#endif
    HDMA5_REG=(n>>4)-1;
    VBK_REG=0;if(pending==6){
     SWITCH_ROM(saved);
     __asm
      .globl _ff3_text_rom_dma_end
      _ff3_text_rom_dma_end = .
     __endasm;
    }measured();
    __asm
     .globl _ff3_text_dma_end
     _ff3_text_dma_end = .
    __endasm;
    taken=1;
   }}
   if(!taken)break;
   if(pending!=7)transfer_source+=n;
   transfer_address+=n;transfer_count-=n;text_transfer_chunks++;text_transfer_bytes+=n;

#ifdef FF3_EFFECTS
   if(pending==8&&!transfer_count)restore_next();
#endif
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
  * Permit timer IRQs between the bounded DMA critical sections. */
 __asm ei __endasm;
 pump();
 __asm di __endasm;
}
void ff3_text_video_init(void) NONBANKED {CRITICAL{add_VBL(video_irq);}}
static void finish(void){while(pending){pump();if(pending){ff3_text_service();if(pending){__asm halt __endasm;}}}}
void ff3_text_copy(uint8_t bank,uint16_t address,const uint8_t *data,uint16_t count) NONBANKED {
 if(!count)return;
 if(pending||count>256||((uint16_t)data|address|count)&15||(uint16_t)data<0xd950||(uint16_t)data>0xda50-count){text_transfer_fault=1;return;}
#ifdef FF3_EFFECTS
 invalidate_clone(bank,address,count);
#endif
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
void ff3_text_rom_copy(uint8_t bank,uint16_t address,uint8_t rom_bank,const uint8_t *data,uint16_t count) NONBANKED {
 if(!count)return;
 if(pending||!(KEY1_REG&128)||bank>1||!rom_bank||*(const uint8_t*)0x148>7||rom_bank>=((uint16_t)2<<*(const uint8_t*)0x148)||((uint16_t)data|address|count)&15||address<0x8000u||address>=0x9800u||count>0x9800u-address||(uint16_t)data<0x4000u||(uint16_t)data>=0x8000u||count>0x8000u-(uint16_t)data){text_transfer_fault=1;return;}
#ifdef FF3_EFFECTS
 invalidate_clone(bank,address,count);
#endif
 transfer_source=(uint16_t)data;transfer_address=address;transfer_count=count;transfer_bank=bank;transfer_rom_bank=rom_bank;pending=6;finish();
}
void ff3_text_clear_map(uint8_t bank) NONBANKED {
 if(pending||!(KEY1_REG&128)||bank>1){text_transfer_fault=1;return;}
 memset(text_staging,0,256);transfer_source=(uint16_t)text_staging;transfer_address=0x9800;transfer_count=2048;transfer_bank=bank;pending=7;finish();
}


#ifdef FF3_EFFECTS
/* One synchronous lifetime covers all dirty runs. VBlank consumes the next
 * resident span without waking the foreground producer between spans. */
uint8_t ff3_text_restore_map(uint8_t page,const uint8_t *dirty,uint8_t pairs) NONBANKED {uint8_t i=0,n=0,first;
 if(pending||!(KEY1_REG&128)||(SVBK_REG&7)!=1||page>1||pairs>1){text_transfer_fault=1;return 0;}
 /* Prepare all spans in foreground, as the original NMI consumes prepared
  * descriptors. No dirty-bit scanning belongs inside the VBlank budget. */
 while(i<72){if(!(dirty[i>>3]&(1<<(i&7)))){i++;continue;}first=i;
  do{i++;}while(i<72&&i!=36&&(dirty[i>>3]&(1<<(i&7))));effect_members[n++]=first;effect_members[n++]=i-first;
 }
 if(pairs){effect_members[n++]=72;effect_members[n++]=16;}effect_members[n]=255;
 restore_page=page?0x9c00u:0x9800u;restore_block=0;transfer_rom_bank=3;restore_next();if(!transfer_count)return 1;if(pending!=9)pending=8;finish();return 1;
}

#endif
