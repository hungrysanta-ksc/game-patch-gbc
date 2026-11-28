#pragma bank 124
#include <string.h>
#include "battle-live-stone.h"
#include "live-stone-assets.h"
#include "battle-entry-tail.h"
#include "battle-effect-freeze.h"
#include "battle-resident-bg.h"
#include "battle-live-ui.h"
#include "battle-cell-pool.h"
#include "text-vblank.h"
#include "memory.h"
#include "resident-bg-assets.h"
extern Ff3EntryTail status_tail;
extern volatile uint8_t party_profile;
void ff3_party_copy(uint8_t bank,const void*src,void*dst,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
void ff3_resident_fix(void) NONBANKED;
uint8_t stone_live,stone_error,stone_state[4];
static const uint8_t top[]={0,4,6,10};
static uint8_t back(void){return status_tail.motion.battle_type==0x88;}
static uint8_t column(uint8_t state){uint8_t row=state>>2;return row==2?(back()?6:12):(back()?row*2:16+row*2);}
/* enemy_build has finished its spatial masks before this call. Reuse its
 * D600..D627 cell bytes and D628 erase rows; never add a second cell pool. */
void ff3_live_stone_reset(void) BANKED {stone_live=stone_error=0;memset(stone_state,3,4);}
uint8_t ff3_live_stone_change(uint8_t actor,const uint8_t*w) BANKED {uint8_t x,next,b=back();
 if(actor>3||w[0]!=3||w[1]>3||w[3]||w[7]||w[4]!=(actor&1?6:8)||w[2]!=(w[1]==3?0:actor*8)){stone_error=1;return 0;}
 x=(w[5]&31)-(b?2:10);
 if(w[1]!=3&&x!=(b?0:16)&&x!=(b?2:18)&&x!=(b?6:12)){stone_error=2;return 0;}
 next=w[1]==3?3:w[1]|((x==(b?6:12)?2:(x-(b?0:16))/2)<<2);if(next==stone_state[actor])return 1;
 if(!stone_live&&w[1]!=3){
  if(!ff3_resident_effect_copy(0x9000,2048)){stone_error=3;return 0;}
  ff3_text_rom_copy(0,0x9400,127,live_stone_patterns+(uint16_t)b*640,640);
  /* Only the terrain boundary needs OBJ. Its two immutable cells occupy
   * the existing gap between the live UI and numeral reservations. */
  ff3_text_rom_copy(0,0x8d40,127,live_stone_glyphs+(uint16_t)b*1920+32,32);
  stone_live=1;
 }
 stone_state[actor]=next;effect_freeze_cache_valid=0;ff3_resident_fix();
 ff3_live_ui_stone();return !stone_error;
}
/* WRAM6 [1056,1312): two page-owned stone residual lists, after the shared
 * COW dictionary. Entries are exact glyphs in that page's existing pool.
 * No extra VRAM arena, and no dependency on a completed transfer. */
#define base ((uint8_t*)0xd600)
#define source ((uint8_t*)0xd610)
#define mask ((uint8_t*)0xd628)
#define extra ((uint8_t*)0xd690)
static void read_pattern(const ResidentBgAsset*a,uint8_t id,uint8_t*out){
 if(!ff3_cell_pool_read_local(id,out))ff3_party_copy(a->bank,a->patterns+(uint16_t)id*16,out,16);
}
/* Work on complete bitplane rows. Besides avoiding per-pixel variable
 * shifts, this keeps SDCC's register pressure out of the large map owner. */
static uint8_t mix(const uint8_t*remap){
 uint8_t *dst=base,*src=source,*obj=extra,row,v,ink,m,lo,hi,changed=0,any=0;
 memset(extra,0,16);
 for(row=0;row<8;row++){
  ff3_native_service();lo=dst[0];hi=dst[1];
  for(v=1;v<4;v++){
   ink=(v&1?src[0]:~src[0])&(v&2?src[1]:~src[1]);m=remap[v];
   if(m==255){if(v&1)obj[0]|=ink;if(v&2)obj[1]|=ink;}
   else{dst[0]=(dst[0]&~ink)|(m&1?ink:0);dst[1]=(dst[1]&~ink)|(m&2?ink:0);}
  }
  changed|=(lo^dst[0])|(hi^dst[1]);any|=obj[0]|obj[1];dst+=2;src+=2;obj+=2;
 }return (changed?1:0)|(any?2:0);
}
uint8_t ff3_live_stone_map(uint8_t*m,uint8_t*residual,uint8_t page) BANKED {
 const ResidentBgAsset*a=resident_bg_assets+party_profile;
 uint8_t actor,kind,x,y,c,id,first,n,b=back(),col,row,v,pal,count=0,columns[4],columns_used=0,left,remap[16],palette[32],o[4];uint16_t at,start=1056+(uint16_t)page*128;
 if(!stone_live)return 1;
 ff3_party_copy(a->bank,a->palette,palette,32);memset(remap,255,16);
 for(pal=0;pal<4;pal++)for(v=0;v<4;v++){ff3_native_service();for(c=0;c<4;c++)if(palette[24+v*2]==palette[pal*8+c*2]&&palette[25+v*2]==palette[pal*8+c*2+1]){remap[pal*4+v]=c;break;}}
 left=b?0:12;for(actor=0;actor<4;actor++){columns[actor]=column(stone_state[actor]);if((stone_state[actor]&3)!=3)columns_used|=3<<(columns[actor]-left);}
 for(y=2;y<13;y++)for(x=left;x<left+8;x++){
  if(!(columns_used&(1<<(x-left))))continue;ff3_native_service();
  n=0;first=255;memset(source,0,16);
  for(actor=0;actor<4;actor++){kind=stone_state[actor]&3;if(kind==3||y<top[actor]||y>=top[actor]+5)continue;col=columns[actor];if(x<col||x>col+1)continue;c=(y-top[actor])*2+x-col;
   ff3_party_copy(127,live_stone_ids+(uint16_t)b*120+(actor*3+kind)*10+c,&id,1);if(id==255)continue;
   ff3_party_copy(127,live_stone_patterns+(uint16_t)b*640+(uint16_t)id*16,base,16);
   for(row=0;row<8;row++)mask[row]=base[row*2]|base[row*2+1];ff3_cell_paint_local(source,base,mask);first=id;n++;
  }if(!n)continue;
  at=(uint16_t)(y-2)*32+x;id=m[at];pal=m[352+at]&7;if(pal>3){stone_error=4;return 0;}
  for(row=0;row<8;row++)mask[row]=source[row*2]|source[row*2+1];
  /* Earlier party ink owns these pixels, including enemy color-boundary
   * objects. Apply the same footprint to the current death/flash residual. */
  for(c=0;c<16;c++)if(residual[c*4]==y*8+16&&residual[c*4+1]==x*8+8){read_pattern(a,residual[c*4+2],base);v=ff3_cell_mask_local(base,mask);if(v==1)residual[c*4]=0;else if(v==2)residual[c*4+2]=ff3_cell_pool_tile_local(base);}
  if(!id){m[at]=n==1?64+first:ff3_cell_pool_tile_local(source);m[352+at]=n==1?3:11;continue;}
  read_pattern(a,id,base);v=mix(remap+pal*4);
  if(v&1)m[at]=ff3_cell_pool_tile_local(base);
  if(v&2){if(count==24){stone_error=6;return 0;}o[0]=y*8+16;o[1]=x*8+8;o[2]=ff3_cell_pool_tile_local(extra);o[3]=31;if(!ff3_wram_copy(6,start+1+(uint16_t)count*4,o,4,1)){stone_error=7;return 0;}count++;}
  if(cell_pool_error){stone_error=5;return 0;}ff3_native_service();
 }
 if(!ff3_wram_copy(6,start,&count,1,1)){stone_error=7;return 0;}return !cell_pool_error;
}
#undef base
#undef source
#undef mask
#undef extra
void ff3_live_stone_footer(uint8_t*row) BANKED {uint8_t kind=stone_state[3]&3,x;uint8_t glyph[16],mask[8];
 if(kind==3)return;x=column(stone_state[3]);memset(mask,0,8);mask[0]=mask[1]=255;
 ff3_party_copy(127,live_stone_glyphs+(uint16_t)back()*1920+(9+kind)*160+96,glyph,16);ff3_cell_paint_local(row+(uint16_t)x*16,glyph,mask);
 ff3_party_copy(127,live_stone_glyphs+(uint16_t)back()*1920+(9+kind)*160+112,glyph,16);ff3_cell_paint_local(row+(uint16_t)(x+1)*16,glyph,mask);
}
void ff3_live_stone_objects(uint8_t*out,uint8_t shifted) BANKED {uint8_t x,i,j,n,o[4],first=shifted?8:0;uint16_t start=1056+(uint16_t)resident_page*128;
 if(!stone_live)return;
 /* CGB ignores OBJ bit 4; use it as a renderer-owned tag so a flash
  * residual with the same palette/tile range cannot be mistaken for stone. */
 for(i=0;i<40;i++)if(out[i*4+3]&16)out[i*4]=0;
 if(!ff3_wram_copy(6,start,&n,1,0)){stone_error=7;return;}
 if((stone_state[0]&3)==0)n+=2;
 for(i=0;i<n;i++){
  ff3_native_service();
  if((stone_state[0]&3)==0&&i<2){x=column(stone_state[0])*8;o[0]=24;o[1]=x+8+i*8;o[2]=212+i;o[3]=23;}
  else if(!ff3_wram_copy(6,start+1+(uint16_t)(i-((stone_state[0]&3)==0?2:0))*4,o,4,0)){stone_error=7;return;}
  for(j=first;j<first+24;j++)if(!out[j*4]||!out[j*4+2])break;
  if(j==first+24){for(j=shifted?0:32;j<(shifted?8:40);j++)if(!out[j*4]||!out[j*4+2])break;if(j==(shifted?8:40)){stone_error=6;return;}}
  memcpy(out+j*4,o,4);
 }
}
/* A live OBJ sharing a cell with stone may require more than four colors.
 * Keep that OBJ instead of approximating its palette in the frozen BG. */
uint8_t ff3_live_stone_overlap(uint8_t x,uint8_t y) BANKED {uint8_t actor,kind,c,tx,ty,id,b=back();
 for(actor=0;actor<4;actor++){kind=stone_state[actor]&3;if(kind==3)continue;
  tx=column(stone_state[actor])*8;if((uint16_t)x+8<=tx||x>=(uint16_t)tx+16)continue;
  for(c=0;c<10;c++){ty=(top[actor]+c/2)*8;if((uint16_t)y+8<=ty||y>=(uint16_t)ty+8)continue;
   ff3_party_copy(127,live_stone_ids+(uint16_t)b*120+(actor*3+kind)*10+c,&id,1);if(id!=255)return 1;
  }
 }return 0;
}
