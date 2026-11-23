#pragma bank 11
#include <gb/cgb.h>
#include <string.h>
#include <stddef.h>
#include "map-display.h"
FF3MapWorkspace __at(0xd000) map_workspace;
typedef char workspace_contract[(sizeof(FF3MapWorkspace)==2031&&offsetof(FF3MapWorkspace,collision)==0x687&&offsetof(FF3MapWorkspace,properties)==0x787)?1:-1];
#define map_tiles map_workspace.tiles
#define map_properties map_workspace.properties
#define map_collision map_workspace.collision
#define metas map_workspace.metas
#define attributes map_workspace.attributes
#define row map_workspace.row
#define attr_row map_workspace.attr_row
#define tile map_workspace.tile
#define palette map_workspace.palette
static uint8_t load(uint8_t kind,uint16_t id,void *out,uint16_t bytes){FF3Asset a;return ff3_asset_open(kind,id,&a)&&a.length==bytes&&ff3_asset_read(&a,0,out,bytes);}
uint8_t ff3_map_display(uint8_t world,uint8_t id,uint8_t x,uint8_t y) BANKED {
 FF3Asset gfx,font;uint16_t property=id+(world?256u:0u),selection=id+(world>=2?256u:0u),t,address,index;
 uint8_t select[2],set,cx,cy,m,q;
 if(x>44||y>46){asset_error=4;return 0;}
 /* Asset load currently uses a dark screen. IRQ/audio scheduling must be
  * integrated before this is promoted to the game's transition renderer. */
 DISPLAY_OFF;
 if(!load(FF3_PROPERTIES,property,map_properties,16)||!load(FF3_SELECTION,selection,select,2))return 0;
 set=map_properties[0]>>5;
 if(!load(FF3_LAYOUT,select[0],map_tiles,1024)||!load(FF3_METAS,set,metas,512)||!load(FF3_ATTRIBUTES,set,attributes,128)||!load(FF3_COLLISION,set,map_collision,256)||!load(FF3_PALETTE,property,palette,32)||!ff3_asset_open(FF3_GRAPHICS,select[1],&gfx)||!ff3_asset_open(FF3_FONT,0,&font))return 0;
 if(gfx.length!=1792||font.length!=2304){asset_error=5;return 0;}
 VBK_REG=0;
 for(t=0;t<256;t++){
  if(!ff3_asset_read(t<112?&gfx:&font,(t<112?t:t-112)*16,tile,16))return 0;
  address=t<128?0x9000u+t*16:0x8800u+(t-128)*16;memcpy((void*)address,tile,16);
 }
 memset((void*)0x9800,0,1024);VBK_REG=1;memset((void*)0x9800,0,1024);
 for(cy=0;cy<18;cy++){
  for(cx=0;cx<20;cx++){index=(uint16_t)((y+cy)>>1)*32+((x+cx)>>1);m=map_tiles[index];if(m>=128){asset_error=6;return 0;}q=((y+cy)&1)*2+((x+cx)&1);row[cx]=metas[(uint16_t)m*4+q];attr_row[cx]=attributes[m];}
  VBK_REG=0;memcpy((void*)(0x9800u+(uint16_t)cy*32),row,20);VBK_REG=1;memcpy((void*)(0x9800u+(uint16_t)cy*32),attr_row,20);
 }
 VBK_REG=0;set_bkg_palette(0,4,palette);SCX_REG=SCY_REG=0;LCDC_REG=0x81;
 if(CURRENT_BANK!=11){asset_error=7;return 0;}return 1;
}
