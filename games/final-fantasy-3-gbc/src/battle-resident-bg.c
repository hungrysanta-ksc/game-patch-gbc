#ifdef FF3_SCENE_LAYOUT
#pragma bank 116
#endif
#include <gb/cgb.h>
#include <string.h>
#include "battle-resident-bg.h"
#include "resident-bg-assets.h"
#include "text-vblank.h"
#include "memory.h"
#include "platform.h"
#include "battle-workspace.h"
#ifdef FF3_EFFECTS
#include "battle-effect-freeze.h"
uint8_t resident_effect_clone_valid;
#endif
void ff3_native_service(void) NONBANKED;
void ff3_party_copy(uint8_t bank,const void*src,void*dst,uint16_t n) NONBANKED;
void ff3_party_palette(uint8_t bg,uint8_t first,uint8_t count,const uint8_t*data) NONBANKED;
volatile uint8_t resident_scroll,resident_page,resident_error;
volatile uint16_t resident_map_bytes,resident_map_updates;
volatile uint16_t resident_max_fill,resident_max_transfer,resident_max_service;
static uint16_t service_ticks;
static uint8_t measuring;
static void service(void){uint16_t begin=ff3_clock_now();ff3_native_service();if(measuring)service_ticks+=ff3_clock_now()-begin;}
static uint8_t active_profile;
static uint8_t cached[2];
uint8_t resident_fixed;
Ff3BattleWorkspace __at(0xd200) battle_workspace;
#define resident_map battle_workspace.map
static void transfer(uint8_t bank,uint16_t address,const uint8_t*src,uint16_t n){uint16_t offset=0,size;
 while(offset<n){size=n-offset;if(size>256)size=256;memcpy(text_staging,src+offset,size);ff3_text_copy(bank,address+offset,text_staging,size);offset+=size;service();}
}
void ff3_resident_load(uint8_t profile) FF3_RESIDENT_BANKED {uint8_t saved=CURRENT_BANK,bank;const ResidentBgAsset*a;
 if(profile>=RESIDENT_PROFILES){resident_error=1;return;}active_profile=profile;a=resident_bg_assets+profile;
#ifdef FF3_EFFECTS
 resident_effect_clone_valid=0;ff3_effect_cache_reset();
#endif
 memset((void*)0xd4c0,0xa6,16);
 if(a->count>16||a->bytes>4096){resident_error=2;return;}
 memset(text_staging,0,256);ff3_party_palette(1,0,4,text_staging);
 for(bank=0;bank<2;bank++)ff3_text_clear_map(bank);
 ff3_text_rom_copy(1,0x8000,a->bank,a->patterns,a->bytes);
 ff3_party_copy(a->bank,a->palette,text_staging,32);
 // Four original BG palettes also supply the separate color-residual OBJ.
 ff3_party_palette(1,0,4,text_staging);ff3_party_palette(0,4,4,text_staging);
 cached[0]=cached[1]=255;resident_page=0;resident_fixed=0;
}
void ff3_resident_fix(void) NONBANKED {resident_fixed=1;cached[0]=cached[1]=255;}
#ifdef FF3_EFFECTS
#if defined(FF3_STONE) || defined(FF3_BOSS)
#error Mutable enemy patterns require a new effect resource ownership contract
#endif
/* The effects build reserves tiles 0..127 for immutable resident graphics.
 * Terrain begins at/above 128; boss/stone writers are excluded by the build.
 * Magic borrows this prefix only while the signed clone is visible, and must
 * restore it before releasing ownership. Use the canonical ROM, not a second
 * VRAM->WRAM archive of the same data. Original B589/B175 keep BG resident. */
uint8_t ff3_resident_effect_copy(uint16_t address,uint16_t count) FF3_RESIDENT_BANKED {
 const ResidentBgAsset*a=resident_bg_assets+active_profile;
 if(!resident_fixed||(address!=0x8000&&address!=0x9000)||!count||(count&15)||count>2048||a->bytes<2048)return 0;
 /* Keep the signed bank-1 clone until scene reload or a transfer overlaps
  * it. The unsigned borrowed prefix still restores on every release. */
 if(address==0x9000&&count==2048&&resident_effect_clone_valid)return 1;
 ff3_text_rom_copy(1,address,a->bank,a->patterns,count);
 if(address==0x9000&&count==2048)resident_effect_clone_valid=1;return 1;
}
#endif
#ifdef FF3_STONE
void ff3_terrain_base_cell(uint8_t x,uint8_t y,uint8_t*out) NONBANKED;
void ff3_terrain_base_row(uint8_t page,uint8_t row,uint8_t*out) NONBANKED;
void ff3_resident_base_pattern(uint8_t tile,uint8_t*out) NONBANKED {uint8_t saved=CURRENT_BANK;const ResidentBgAsset*a=resident_bg_assets+active_profile;
 SWITCH_ROM(a->bank);memcpy(out,a->patterns+(uint16_t)tile*16,16);SWITCH_ROM(saved);
}
void ff3_resident_base_cell(uint8_t x,uint8_t y,uint8_t*out) NONBANKED {uint8_t saved=CURRENT_BANK,t;uint16_t at;const ResidentBgAsset*a=resident_bg_assets+active_profile;
 if(y<2){ff3_terrain_base_cell(x,y,out);return;}memset(out,0,17);out[16]=8;if(y>=13)return;
 at=(uint16_t)(y-2)*56+x;SWITCH_ROM(a->bank);t=a->maps[at];out[16]=a->maps[616+at];memcpy(out,a->patterns+(uint16_t)t*16,16);SWITCH_ROM(saved);
}
void ff3_resident_base_row(uint8_t page,uint8_t row,uint8_t*out) NONBANKED {uint8_t saved=CURRENT_BANK;uint16_t at;const ResidentBgAsset*a=resident_bg_assets+active_profile;
 if(row<2){ff3_terrain_base_row(page,row,out);return;}memset(out,0,64);if(row>=13)return;
 at=(uint16_t)(row-2)*56;SWITCH_ROM(a->bank);memcpy(out,a->maps+at,32);memcpy(out+32,a->maps+616+at,32);SWITCH_ROM(saved);
}
#endif
static uint8_t contains(uint8_t origin,uint8_t coarse){uint8_t delta;if(origin>=56)return 0;delta=coarse+56-origin;if(delta>=56)delta-=56;return delta<12;}
void ff3_resident_prepare(const Ff3EntryDisplay*s,uint8_t page,uint8_t*oam) FF3_RESIDENT_BANKED {
 uint8_t saved=CURRENT_BANK,y,i,world,n=24,coarse,hidden=s->ticket==0,origin,delta,count;uint16_t scroll,base,from,to,x,begin,elapsed;const ResidentBgAsset*a=resident_bg_assets+active_profile;const uint8_t*r;
 if((s->enemy_scroll&15)||page>1){resident_error=3;return;}
 scroll=(uint16_t)(s->enemy_scroll>>4)*14+((s->enemy_table&1)?224:0);if(scroll>=448)scroll-=448;
 coarse=scroll>>3;
 memset(oam+96,0,64);
 if(!hidden){ff3_party_copy(a->bank,a->objects,text_staging,(uint16_t)a->count*5);r=text_staging;
  for(i=0;i<a->count;i++,r+=5){x=(uint16_t)r[0]|((uint16_t)r[1]<<8);x=x+448-scroll;if(x>=448)x-=448;
   if(x>=160&&x<=440)continue;if(n>=40){resident_error=4;break;}
   oam[n*4]=r[2]+16;oam[n*4+1]=(uint8_t)(x>440?x-440:x+8);oam[n*4+2]=r[3];oam[n*4+3]=r[4];n++;
  }
 }
 // Keep a 32-column neighborhood resident. The 21 visible columns may move
 // through it without any map upload. OAM and BG pages have separate owners.
 if(resident_fixed){if(scroll){resident_error=5;return;}if(cached[page]==0){resident_page=page;resident_scroll=0;return;}origin=0;}
 else {page=resident_page;
 if(hidden){resident_scroll=0;if(cached[page]==254)return;page^=1;origin=254;}
 else {
  if(contains(cached[page],coarse)||contains(cached[page^1],coarse)){
   if(!contains(cached[page],coarse))page^=1;
   delta=coarse+56-cached[page];if(delta>=56)delta-=56;
   resident_scroll=(delta<<3)|(scroll&7);resident_page=page;return;
  }
  page^=1;origin=coarse;
  if(s->battle_type!=0x88){origin=coarse+45;if(origin>=56)origin-=56;}
 }}
 begin=ff3_clock_now();service_ticks=0;measuring=1;memset(resident_map,0,704);
 if(!hidden)for(y=0;y<11;y++){
  world=origin;from=(uint16_t)y*56;to=(uint16_t)y*32;count=56-world;if(count>32)count=32;
  ff3_party_copy(a->bank,a->maps+from+world,resident_map+to,count);ff3_party_copy(a->bank,a->maps+616+from+world,resident_map+352+to,count);
  if(count<32){ff3_party_copy(a->bank,a->maps+from,resident_map+to+count,32-count);ff3_party_copy(a->bank,a->maps+616+from,resident_map+352+to+count,32-count);}
  service();
 }
 elapsed=ff3_clock_now()-begin;if(elapsed>resident_max_fill)resident_max_fill=elapsed;begin=ff3_clock_now();
 base=page?0x9c40:0x9840;transfer(0,base,resident_map,352);transfer(1,base,resident_map+352,352);
 elapsed=ff3_clock_now()-begin;if(elapsed>resident_max_transfer)resident_max_transfer=elapsed;
 measuring=0;if(service_ticks>resident_max_service)resident_max_service=service_ticks;
 cached[page]=origin;resident_page=page;
 if(!hidden){delta=coarse+56-origin;if(delta>=56)delta-=56;resident_scroll=(delta<<3)|(scroll&7);}
 resident_map_bytes+=704;resident_map_updates++;
}
