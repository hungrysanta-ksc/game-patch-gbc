#pragma bank 13
#include <gb/cgb.h>
#include <string.h>
#include "field-objects.h"
uint8_t object_part1[192],object_part2[192];
volatile uint8_t object_count,object_oam_count,object_line_peak;
static uint16_t object_palette[8];

uint8_t ff3_objects_init(uint8_t world,uint8_t list,const uint8_t *flags) BANKED {
 FF3Asset a,speeds;uint8_t data[49],i,n,id,packed,speed,terrain;uint16_t at,pointer;
 /* Validate the complete list before modifying resident object state. */
 if(!ff3_asset_open(FF3_PLACEMENTS,list,&a))return 0;
 if(a.length>49||a.length%4!=1){asset_error=10;return 0;}
 if(!ff3_asset_read(&a,0,data,a.length))return 0;
 n=(a.length-1)/4;if(data[n*4]){asset_error=10;return 0;}
 for(i=0;i<n;i++)if(!data[i*4]||data[i*4+1]>=32||data[i*4+2]>=32){asset_error=10;return 0;}
 if(!ff3_asset_open(FF3_NPC_SPEED,0,&speeds))return 0;
 memset(object_part1,0,sizeof(object_part1));object_count=n;
 for(i=0;i<n;i++){
  at=(uint16_t)i*16;id=data[i*4];packed=data[i*4+3];
  object_part1[at+10]=id;
  object_part1[at]=(flags[(id>>3)+(world?32:0)]&(1u<<(id&7)))?id:0;
  object_part1[at+2]=object_part1[at+4]=data[i*4+1];
  object_part1[at+3]=object_part1[at+5]=data[i*4+2];
  object_part1[at+1]=packed&0xf0;
  switch(packed&3){case 0:pointer=0xb43a;break;case 1:pointer=0xb44a;break;case 2:pointer=0xb42a;break;default:pointer=0xb41a;break;}
  object_part1[at+14]=(uint8_t)pointer;object_part1[at+15]=pointer>>8;
  object_part2[at+5]=(packed<<4)&0xc0;
  terrain=map_workspace.tiles[(uint16_t)data[i*4+2]*32+data[i*4+1]];
  if(terrain>=128){asset_error=11;return 0;}
  terrain=map_workspace.collision[(uint16_t)terrain*2]&0x37;
  object_part2[at]=object_part2[at+1]=terrain;object_part2[at+6]=terrain&3;
  if(!ff3_asset_read(&speeds,id+(world?256u:0u),&speed,1))return 0;
  object_part2[at+2]=speed&15;object_part2[at+3]=speed>>4;
 }
 return 1;
}

uint8_t ff3_objects_display(uint8_t world,uint8_t id,uint8_t x,uint8_t y,uint8_t phase) BANKED {
 FF3Asset selection,gfx,poses,pal;uint16_t at,t,pose;
 uint8_t slot,q,j,line,count,graphic,record[8],tile[16],flags,terrain;
 int16_t px,py,sx,sy;
 if(x>44||y>46||phase>1){asset_error=4;return 0;}
 DISPLAY_OFF;memset(shadow_OAM,0,160);object_oam_count=object_line_peak=0;
 if(!ff3_asset_open(FF3_NPC_SELECTION,0,&selection)||!ff3_asset_open(FF3_NPC_POSES,0,&poses)||!ff3_asset_open(FF3_NPC_PALETTE,id+(world?256u:0u),&pal)||!ff3_asset_read(&pal,0,object_palette,16))return 0;
 VBK_REG=1;memset((void*)0x8000,0,3072);
 for(slot=0;slot<12;slot++){
  at=(uint16_t)slot*16;
  if(!object_part1[at+10])continue;
  /* Original loader supplies graphics even for currently hidden objects. */
  if(!ff3_asset_read(&selection,object_part1[at+10]+(world>=2?256u:0u),&graphic,1)||!ff3_asset_open(FF3_NPC_GRAPHICS,graphic,&gfx))return 0;
  for(t=0;t<256;t+=16){if(!ff3_asset_read(&gfx,t,tile,16))return 0;memcpy((void*)(0x8000u+at*16+t),tile,16);}
  if(!object_part1[at])continue;
  px=(int16_t)object_part1[at+4]*16-(int16_t)x*8;
  /* B1EE..B20F carry chain, plus NES OAM's visible Y+1: -3 pixels. */
  py=(int16_t)object_part1[at+5]*16-(int16_t)y*8-3;
  pose=((uint16_t)object_part1[at+15]<<8)|object_part1[at+14];
  pose=pose-0xb41a+object_part2[at+5]+phase*8;
  if(!ff3_asset_read(&poses,pose,record,8))return 0;
  terrain=object_part2[at+1];
  for(q=0;q<4;q++){
   sx=px+(q&1)*8;sy=py+(q>=2?8:0);
   if(sx<=-8||sx>=160||sy<=-8||sy>=144)continue;
   if(object_oam_count>=40){asset_error=12;goto rejected;}
   j=(q==1?2:q==2?1:q)*2;flags=record[j+1];
   if(terrain&(q<2?0x14:0x24))flags^=0x20;
   shadow_OAM[object_oam_count].y=(uint8_t)(sy+16);
   shadow_OAM[object_oam_count].x=(uint8_t)(sx+8);
   shadow_OAM[object_oam_count].tile=slot*16+record[j];
   shadow_OAM[object_oam_count].prop=8+(flags&1)+((flags&0x40)?0x20:0)+((flags&0x80)?0x40:0)+((flags&0x20)?0x80:0);
   object_oam_count++;
  }
 }
 for(line=0;line<144;line++){
  count=0;for(j=0;j<object_oam_count;j++)if((int16_t)line>=(int16_t)shadow_OAM[j].y-16&&(int16_t)line<(int16_t)shadow_OAM[j].y-8)count++;
  if(count>object_line_peak)object_line_peak=count;
 }
 if(object_line_peak>10){asset_error=13;goto rejected;}
 VBK_REG=0;set_sprite_palette(0,2,object_palette);LCDC_REG=0x83;return 1;
rejected:
 /* Development failure: keep the background and expose diagnostics. A later
  * gameplay renderer must resolve the budget; silently dropping NPCs is not OK. */
 memset(shadow_OAM,0,160);VBK_REG=0;LCDC_REG=0x81;return 0;
}
