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
extern Ff3EntryTail status_tail;
void ff3_party_copy(uint8_t bank,const void*src,void*dst,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
void ff3_resident_fix(void) NONBANKED;
uint8_t stone_live,stone_error,stone_state[4];
static const uint8_t top[]={0,4,6,10};
static uint8_t back(void){return status_tail.motion.battle_type==0x88;}
static uint8_t column(uint8_t state){return back()?((state>>2)*2):(16+(state>>2)*2);}
/* enemy_build has finished its spatial masks before this call. Reuse its
 * D600..D627 cell bytes and D628 erase rows; never add a second cell pool. */
static uint8_t joined(uint8_t a,uint8_t b,uint8_t facing){uint8_t i,*base=(uint8_t*)0xd600,*src=(uint8_t*)0xd610,*mask=(uint8_t*)0xd628;
 ff3_party_copy(127,live_stone_patterns+(uint16_t)facing*640+(uint16_t)a*16,base,16);
 ff3_party_copy(127,live_stone_patterns+(uint16_t)facing*640+(uint16_t)b*16,src,16);
 for(i=0;i<8;i++)mask[i]=src[i*2]|src[i*2+1];
 ff3_cell_paint_local(base,src,mask);return ff3_cell_pool_tile_local(base);
}
void ff3_live_stone_reset(void) BANKED {stone_live=stone_error=0;memset(stone_state,3,4);}
uint8_t ff3_live_stone_change(uint8_t actor,const uint8_t*w) BANKED {uint8_t x,next,b=back();
 if(actor>3||w[0]!=3||w[1]>3||w[3]||w[7]||w[4]!=(actor&1?6:8)||w[2]!=(w[1]==3?0:actor*8)){stone_error=1;return 0;}
 x=(w[5]&31)-(b?2:10);
 /* Confused forward columns need the mixed enemy/stone owner. Fail before
  * publishing rather than clearing enemy dots or dropping stone objects. */
 if(w[1]!=3&&x!=(b?0:16)&&x!=(b?2:18)){stone_error=2;return 0;}
 next=w[1]==3?3:w[1]|((x-(b?0:16))/2<<2);if(next==stone_state[actor])return 1;
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
uint8_t ff3_live_stone_map(uint8_t*m) BANKED {uint8_t actor,kind,x,y,c,id,b=back();uint16_t at;
 for(actor=0;actor<4;actor++){kind=stone_state[actor]&3;if(kind==3)continue;x=column(stone_state[actor]);
  for(c=0;c<10;c++){y=top[actor]+c/2;if(y<2||y>=13)continue;
   ff3_party_copy(127,live_stone_ids+(uint16_t)b*120+(actor*3+kind)*10+c,&id,1);if(id==255)continue;
   at=(uint16_t)(y-2)*32+x+(c&1);
   /* The supported source row columns are outside all registered enemy
    * ink. Check the actual current page, including death/flash changes. */
   if(m[at]){
    /* Consecutive source actors can share one GBC cell even when their
     * ink rows do not overlap. Append their exact union to the death pool. */
    if(m[352+at]!=3||m[at]<64||m[at]>=104){stone_error=4;return 0;}
    m[at]=joined(m[at]-64,id,b);m[352+at]=11;if(cell_pool_error){stone_error=5;return 0;}
   }else{m[at]=64+id;m[352+at]=3;}
  }ff3_native_service();
 }return 1;
}
void ff3_live_stone_footer(uint8_t*row) BANKED {uint8_t kind=stone_state[3]&3,x;uint8_t glyph[16],mask[8];
 if(kind==3)return;x=column(stone_state[3]);memset(mask,0,8);mask[0]=mask[1]=255;
 ff3_party_copy(127,live_stone_glyphs+(uint16_t)back()*1920+(9+kind)*160+96,glyph,16);ff3_cell_paint_local(row+(uint16_t)x*16,glyph,mask);
 ff3_party_copy(127,live_stone_glyphs+(uint16_t)back()*1920+(9+kind)*160+112,glyph,16);ff3_cell_paint_local(row+(uint16_t)(x+1)*16,glyph,mask);
}
void ff3_live_stone_objects(uint8_t*out) BANKED {uint8_t x;
 if((stone_state[0]&3)!=0)return;x=column(stone_state[0])*8;
 out[0]=24;out[1]=x+8;out[2]=212;out[3]=7;out[4]=24;out[5]=x+16;out[6]=213;out[7]=7;
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
