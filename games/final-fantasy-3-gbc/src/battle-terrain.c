#include <gb/cgb.h>
#include <string.h>
#include "battle-terrain.h"
#include "terrain-assets.h"
#include "text-vblank.h"
#include "memory.h"
#include "platform.h"
void ff3_native_service(void) NONBANKED;
volatile uint8_t terrain_fault,terrain_scroll;
volatile uint16_t terrain_max_step;
uint8_t __at(0xd0c0) terrain_masked[64];
uint8_t __at(0xd100) terrain_source[256];
uint8_t __at(0xd500) terrain_pixels[160];
static uint8_t dirty[2],active_profile,base_tile;
static const uint8_t *terrain_binding_ptr,*terrain_luts_ptr;
static uint8_t terrain_batch;
/* Fixed D0C0 source and D500 destination pages; the compiler bounds every
 * record. Apply exactly the same bit-selection LUT as the host oracle. */
static void apply_batch(void) __naked {__asm
 ld hl,#_terrain_binding_ptr
 ld a,(hl+)
 ld h,(hl)
 ld l,a
001$:
 ld a,(hl+)
 add a,#0xc0
 ld e,a
 ld d,#0xd0
 ld a,(de)
 ld b,a
 ld a,(hl+)
 ld e,a
 inc hl
 ld a,(hl+)
 cpl
 ld c,a
 ld d,#0xd5
 ld a,(de)
 and c
 ld c,a
 push de
 ld a,(hl+)
 push hl
 ld h,a
 ld l,b
 ld a,(_terrain_luts_ptr)
 add a,l
 ld l,a
 ld a,(_terrain_luts_ptr+1)
 adc a,h
 ld h,a
 ld a,(hl)
 or c
 pop hl
 pop de
 ld (de),a
 ld a,(_terrain_batch)
 dec a
 ld (_terrain_batch),a
 jr nz,001$
 ld a,l
 ld (_terrain_binding_ptr),a
 ld a,h
 ld (_terrain_binding_ptr+1),a
 ret
 __endasm;
}
static void raster(void) NONBANKED {SCX_REG=terrain_scroll;}
static uint8_t terrain_registered;
void ff3_terrain_init(void) NONBANKED {CRITICAL{if(!terrain_registered){add_LCD(raster);add_LCD(nowait_int_handler);terrain_registered=1;}LYC_REG=11;STAT_REG=0x40;IE_REG|=LCD_IFLAG;}}
void ff3_terrain_shutdown(void) NONBANKED {CRITICAL{if(terrain_registered){IE_REG&=~LCD_IFLAG;STAT_REG=0;IF_REG&=~LCD_IFLAG;remove_LCD(raster);remove_LCD(nowait_int_handler);terrain_registered=0;}}}
void ff3_terrain_reset(void) NONBANKED {memset(terrain_pixels,0,160);dirty[0]=dirty[1]=3;}
void ff3_terrain_load(uint8_t profile) NONBANKED {uint8_t saved=CURRENT_BANK,page,bank,i,row,offset;const TerrainAsset*a;
 if(profile>=TERRAIN_PROFILES){terrain_fault=1;return;}active_profile=profile;a=terrain_assets+profile;base_tile=a->base;
 if(base_tile>236){terrain_fault=2;return;}
 SWITCH_ROM(a->bank);memcpy(terrain_source,a->source,256);SWITCH_ROM(saved);
 memset((void*)0xd5a0,0xa8,16);ff3_terrain_reset();
 for(page=0;page<2;page++)for(bank=0;bank<2;bank++){
  memset(text_staging,0,64);offset=base_tile+page*10;
  for(row=0;row<2;row++){
   ff3_native_service();SWITCH_ROM(a->bank);
   for(i=0;i<20;i++)text_staging[row*32+i]=bank?a->attributes[row*20+i]:a->map[row*20+i]+offset;
   SWITCH_ROM(saved);
  }
  ff3_text_copy(bank,page?0x9c00:0x9800,text_staging,64);ff3_native_service();
 }
}
void ff3_terrain_step(const Ff3EntryDisplay*s) NONBANKED {uint8_t saved=CURRENT_BANK,row,n;uint16_t at,end,begin,elapsed;const TerrainAsset*a=terrain_assets+active_profile;
 if(s->phase!=FF3_ENTRY_TERRAIN)return;begin=ff3_clock_now();
 if(!ff3_entry_terrain(s,terrain_source,terrain_masked)){terrain_fault=3;return;}
 row=s->row;SWITCH_ROM(a->bank);at=(uint16_t)a->spans[row*2]|((uint16_t)a->spans[row*2+1]<<8);end=(uint16_t)a->spans[row*2+2]|((uint16_t)a->spans[row*2+3]<<8);
 terrain_binding_ptr=a->bindings+at;terrain_luts_ptr=a->luts;
 while(at<end){n=end-at>160?32:(end-at)/5;terrain_batch=n;apply_batch();at+=(uint16_t)n*5;
  SWITCH_ROM(saved);ff3_native_service();SWITCH_ROM(a->bank);
 }SWITCH_ROM(saved);
 if(row<2){dirty[0]|=1<<row;dirty[1]|=1<<row;}
 elapsed=ff3_clock_now()-begin;if(elapsed>terrain_max_step)terrain_max_step=elapsed;
}
uint8_t terrain_dma_mask;
static uint8_t terrain_dma_hi0,terrain_dma_lo0,terrain_dma_hi1,terrain_dma_lo1;
void ff3_terrain_prepare(uint8_t page) NONBANKED {uint16_t dest;
 if(page>1){terrain_fault=4;return;}
 dest=0x8000+((uint16_t)base_tile+page*10)*16;
 terrain_dma_hi0=dest>>8;terrain_dma_lo0=dest;dest+=80;
 terrain_dma_hi1=dest>>8;terrain_dma_lo1=dest;
 terrain_dma_mask=dirty[page];dirty[page]=0;
}
#ifdef FF3_STONE
void ff3_terrain_base_cell(uint8_t x,uint8_t y,uint8_t*out) NONBANKED {uint8_t saved=CURRENT_BANK,t;const TerrainAsset*a=terrain_assets+active_profile;
 SWITCH_ROM(a->bank);t=a->map[y*20+x];out[16]=a->attributes[y*20+x];SWITCH_ROM(saved);memcpy(out,terrain_pixels+(uint16_t)t*16,16);
}
void ff3_terrain_base_row(uint8_t page,uint8_t row,uint8_t*out) NONBANKED {uint8_t saved=CURRENT_BANK,i;const TerrainAsset*a=terrain_assets+active_profile;
 memset(out,0,64);SWITCH_ROM(a->bank);for(i=0;i<20;i++){out[i]=a->map[row*20+i]+base_tile+page*10;out[32+i]=a->attributes[row*20+i];}SWITCH_ROM(saved);
}
#endif
/* The descriptor is immutable before pending publication. Keep register setup
 * and each 80-byte DMA bounded; permit TIMA between the two chunks. */
void ff3_terrain_publish(void) NONBANKED __naked {__asm
 ei
 ld a,(_terrain_dma_mask)
 bit 0,a
 jr z,002$
 di
 ldh a,(#0x44)
 cp #144
 jr c,009$
 cp #150
 jr nc,009$
 ld a,#1
 ldh (#0x4f),a
 ld a,#0xd5
 ldh (#0x51),a
 xor a
 ldh (#0x52),a
 ld a,(_terrain_dma_hi0)
 ldh (#0x53),a
 ld a,(_terrain_dma_lo0)
 ldh (#0x54),a
 ld a,#4
 ldh (#0x55),a
 xor a
 ldh (#0x4f),a
 ei
002$:
 ld a,(_terrain_dma_mask)
 bit 1,a
 jr z,003$
 di
 ldh a,(#0x44)
 cp #144
 jr c,009$
 cp #150
 jr nc,009$
 ld a,#1
 ldh (#0x4f),a
 ld a,#0xd5
 ldh (#0x51),a
 ld a,#0x50
 ldh (#0x52),a
 ld a,(_terrain_dma_hi1)
 ldh (#0x53),a
 ld a,(_terrain_dma_lo1)
 ldh (#0x54),a
 ld a,#4
 ldh (#0x55),a
 xor a
 ldh (#0x4f),a
 ei
003$:
 xor a
 ld (_terrain_dma_mask),a
 ret
009$:
 ld a,#5
 ld (_terrain_fault),a
 ei
 ret
 __endasm;
}
