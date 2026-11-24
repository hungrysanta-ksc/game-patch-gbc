#pragma bank 15
#include <string.h>
#include "battle-item-render.h"
#include "battle-item-data.h"
#include "platform.h"
#include "composition-window.h"
extern uint16_t scene_keys[128];
extern uint8_t scene_input[256];
void ff3_native_service(void) NONBANKED;
uint8_t ff3_item_byte(uint8_t column,uint8_t row,uint8_t actor,uint8_t quantity) BANKED {
 if(!column)return ff3_game_state[0x203u+(uint16_t)actor*64+(row>=2?2:0)+quantity];
 return ff3_game_state[0xc0u+(column-1)*4+row+(quantity?32:0)];
}
uint8_t ff3_item_eligible(uint8_t id,uint8_t actor) BANKED {uint8_t v,job=ff3_game_state[0x100u+(uint16_t)actor*64];if(job>=22)return 0;ff3_scene_rom_copy(ITEM_USE_BANK,item_usable+(uint16_t)job*256+id,&v,1);return v;}
uint8_t ff3_item_property(uint8_t id) BANKED {uint8_t v;ff3_scene_rom_copy(ITEM_USE_BANK,item_properties+id,&v,1);return v;}
uint8_t ff3_item_width(uint8_t id) BANKED {uint8_t v;ff3_scene_rom_copy(7,item_widths+id,&v,1);return v;}
static void bits(uint8_t *out,uint8_t tile,uint8_t y,uint8_t mask){uint8_t at=tile*16+y*2;out[at]|=mask;out[at+1]|=mask;}
void ff3_item_render_row(uint8_t column,uint8_t tile_row,uint8_t selected_row,uint8_t offset,uint8_t actor,uint8_t *out) BANKED {
 uint8_t kind=!column?0:column==1?1:column==8?3:2,yy,y,r,first=255,i,id=0,qty=0,tens=0,ones=0,x,shift,g,sy,usable=1,mask;uint16_t name;uint8_t *names=(uint8_t*)scene_keys;ItemName n;
 ff3_scene_rom_copy(ITEM_BASE_BANK,item_base+(uint16_t)kind*960+(uint16_t)tile_row*160,out,160);
 ff3_scene_rom_copy(ITEM_BASE_BANK,item_digits,scene_input,192);
 for(yy=0;yy<8;yy++){ff3_native_service();y=tile_row*8+yy;if(y<9||y>=41)continue;r=(y-9)>>3;
  if(r!=first){first=r;id=ff3_item_byte(column,r,actor,0);qty=ff3_item_byte(column,r,actor,1);tens=qty<10?255:(qty/10)%10;ones=qty%10;name=(!column&&!(r&1))?256+(r>>1):id;
   ff3_scene_rom_copy(7,item_names+name,&n,sizeof(n));ff3_scene_rom_copy(n.bank,n.data,names,128);usable=!column||ff3_item_eligible(id,actor);ff3_native_service();
  }
  sy=(y-9)&7;shift=r==selected_row?offset:0;
  if((!column&&!(r&1))||id)for(x=0;x<5;x++){i=(shift>>3)+x;mask=i<16?names[sy*16+i]<<(shift&7):0;if((shift&7)&&i<15)mask|=names[sy*16+i+1]>>(8-(shift&7));if(x==4)mask&=0xf0;bits(out,2+x,yy,mask);}
  if(!column&&!(r&1))continue;
  for(x=0;x<3;x++){g=!x?10:x==1?tens:ones;if(g!=255){mask=scene_input[g*16+sy*2];bits(out,6+x,yy,mask>>4);bits(out,7+x,yy,mask<<4);}}
  if(!usable){mask=scene_input[11*16+sy*2];bits(out,0,yy,mask>>4);bits(out,1,yy,mask<<4);}
 }
}
