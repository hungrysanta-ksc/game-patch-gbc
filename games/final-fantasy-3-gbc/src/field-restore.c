/* E7F8 -> E803/E81B, deliberately omitting E811's fresh NPC load.
 * RAM context is already restored. Replace only display resources; keep
 * positions, NPC motion/event state, dynamic tiles and GameState intact. */
#pragma bank 77
#include <gb/cgb.h>
#include <string.h>
#include "exploration.h"
#include "scene-loop.h"
#include "text-vblank.h"
void ff3_native_service(void) NONBANKED;
static uint8_t upload(const FF3Asset*a,uint8_t bank,uint16_t source,uint16_t dest,uint16_t count){uint16_t n;
 while(count){n=count>256?256:count;
  if(!ff3_asset_read(a,source,text_staging,n))return 0;
  VBK_REG=bank;memcpy((void*)dest,text_staging,n);VBK_REG=0;
  source+=n;dest+=n;count-=n;ff3_native_service();
 }return 1;
}
uint8_t ff3_field_restore_display(void) BANKED {
 FF3Asset selection,gfx,font,pal;uint8_t s[2],slot,graphic;uint16_t i;
 /* No old callbacks or OAM DMA survive this boundary. A dark transition is
  * legal here; timer/producer continue throughout every bounded upload. */
 DISPLAY_OFF;HIDE_WIN;VBK_REG=0;
 if(!ff3_asset_open(FF3_SELECTION,field.map+(field.world>=2?256u:0u),&selection)||!ff3_asset_read(&selection,0,s,2))return 0;
 if(!ff3_asset_open(FF3_GRAPHICS,s[1],&gfx)||!ff3_asset_open(FF3_FONT,0,&font))return 0;
 if(gfx.length!=1792||font.length!=2304)return 0;
 if(!upload(&gfx,0,0,0x9000,1792)||!upload(&font,0,0,0x9700,256)||!upload(&font,0,256,0x8800,2048))return 0;
 set_bkg_palette(0,4,map_workspace.palette);ff3_native_service();
 if(!ff3_asset_open(FF3_NPC_SELECTION,0,&selection)||!ff3_asset_open(FF3_NPC_PALETTE,field.map+(field.world?256u:0u),&pal)||!ff3_asset_read(&pal,0,text_staging,16))return 0;
 set_sprite_palette(0,2,(const palette_color_t*)text_staging);ff3_native_service();
 for(i=0;i<3072;i+=256){VBK_REG=1;memset((void*)(0x8000u+i),0,256);VBK_REG=0;ff3_native_service();}
 for(slot=0;slot<12;slot++){
  graphic=object_part1[(uint16_t)slot*16+10];if(!graphic)continue;
  if(!ff3_asset_read(&selection,graphic+(field.world>=2?256u:0u),&graphic,1)||!ff3_asset_open(FF3_NPC_GRAPHICS,graphic,&gfx)||gfx.length!=256)return 0;
  if(!upload(&gfx,1,0,0x8000u+(uint16_t)slot*256,256))return 0;
 }
 /* CGB LCD mode is a scene resource too: battle may have used signed BG,
  * alternate map and tall OBJ. The field renderer publishes all of these. */
 memset(shadow_OAM,0,160);memset(field_oam,0,160);_shadow_OAM_base=0;
 WX_REG=7;WY_REG=80;VBK_REG=0;LCDC_REG=0x03;
 return ff3_field_render(1);
}
