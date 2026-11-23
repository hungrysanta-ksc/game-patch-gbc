#pragma bank 10
#include <gb/cgb.h>
#include <string.h>
#include "exploration.h"
#include "text-vblank.h"
#include "platform.h"
#include "exploration-art.h"
static void cell(uint8_t x,uint8_t y,uint8_t *tile,uint8_t *attr){uint8_t m;
 x&=127;y&=127;m=((x|y)&64)?map_workspace.properties[3]:map_workspace.tiles[(uint16_t)(y>>1)*32+(x>>1)];
 if(m>=128){field.error=1;m=0;}*tile=map_workspace.metas[(uint16_t)m*4+(y&1)*2+(x&1)];*attr=map_workspace.attributes[m];
}
static void row(uint8_t y,uint8_t boot){uint8_t i;uint16_t a=0x9800u+(uint16_t)(y&31)*32;
 ff3_field_flush();for(i=0;i<32;i++)cell((field.cache_x+i)&127,y,&field_staging[(field.cache_x+i)&31],&field_staging[32+((field.cache_x+i)&31)]);
 if(boot){VBK_REG=0;memcpy((void*)a,field_staging,32);VBK_REG=1;memcpy((void*)a,field_staging+32,32);VBK_REG=0;}
 else ff3_field_strip(a,1);
}
static void column(uint8_t x){uint8_t i;
 for(i=0;i<32;i++)cell(x,(field.cache_y+i)&127,&field_staging[(field.cache_y+i)&31],&field_staging[32+((field.cache_y+i)&31)]);
 ff3_field_strip(0x9800u+(x&31),32);
}
/* Complete quads take the direct path; edge sprites preserve the source order
 * and clipping. Build-time conversion already supplies CGB flip/palette bits. */
static uint8_t quad(uint8_t *o,uint8_t n,int16_t x,int16_t y,uint8_t base,const uint8_t *r,uint8_t terrain){
 uint8_t *p=o+((uint16_t)n<<2),sx=(uint8_t)(x+8),sy=(uint8_t)(y+16),hi=(terrain&0x14)?128:0,lo=(terrain&0x24)?128:0,q;int16_t xx,yy;
 if(x>=-7&&x<152&&y>=-7&&y<136){
  if(n>36){field.error=6;return n;}
  *p++=sy;*p++=sx;*p++=base+r[0];*p++=r[1]^hi;
  *p++=sy;*p++=sx+8;*p++=base+r[2];*p++=r[3]^hi;
  *p++=sy+8;*p++=sx;*p++=base+r[4];*p++=r[5]^lo;
  *p++=sy+8;*p++=sx+8;*p++=base+r[6];*p=r[7]^lo;return n+4;
 }
 for(q=0;q<4;q++){xx=x+(q&1)*8;yy=y+(q>=2?8:0);if(xx<=-8||xx>=160||yy<=-8||yy>=144)continue;
  if(n==40){field.error=6;return n;}*p++=(uint8_t)(yy+16);*p++=(uint8_t)(xx+8);*p++=base+r[q*2];*p++=r[q*2+1]^(q<2?hi:lo);n++;}
 return n;
}
uint8_t ff3_field_render(uint8_t boot) BANKED {
 uint8_t i,j,n=0,phase,page,count,peak=0,sy,tx,ty,*o,*hist;int16_t px,py;uint16_t pose,begin,stage,elapsed;FF3Asset a;
 if(!boot&&(field.pending||field.upload_pending))return 0;
 field.render_busy=1;begin=ff3_clock_now();
 field.camera_x=((((uint16_t)((field.x+7)&63)<<4)+field.subx)-72)&1023;
 field.camera_y=((((uint16_t)((field.y+7)&63)<<4)+field.suby)-64)&1023;
 tx=((field.camera_x>>3)-4)&127;ty=((field.camera_y>>3)-4)&127;
 if(boot){DISPLAY_OFF;field.cache_x=tx;field.cache_y=ty;for(i=0;i<32;i++)row((ty+i)&127,1);
  if(!ff3_asset_open(FF3_NPC_GRAPHICS,FIELD_GRAPHIC,&a)||!ff3_asset_read(&a,0,text_staging,256)){field.error=7;return 0;}
  VBK_REG=1;memcpy((void*)0x8c00,text_staging,256);VBK_REG=0;set_sprite_palette(2,2,field_player_palette);
 }else{
  if(tx!=field.cache_x){if(((tx-field.cache_x)&127)==1){field.cache_x=tx;column((tx+31)&127);}else if(((field.cache_x-tx)&127)==1){field.cache_x=tx;column(tx);}else field.error=8;}
  if(ty!=field.cache_y){if(((ty-field.cache_y)&127)==1){field.cache_y=ty;row((ty+31)&127,0);}else if(((field.cache_y-ty)&127)==1){field.cache_y=ty;row(ty,0);}else field.error=8;}
 }
 stage=ff3_clock_now();elapsed=stage-begin;if(elapsed>field.max_bg_ticks)field.max_bg_ticks=elapsed;
 page=(_shadow_OAM_base==0xc0)?0xdc:0xc0;o=page==0xdc?field_oam:(uint8_t*)shadow_OAM;memset(o,0,160);
 phase=(field.subx|field.suby)&8;pose=field_player_poses[field.direction&15]+phase+16;px=72;py=61;
 if(phase){if(field.suby)px--;else py--;}
 n=quad(o,n,px,py,192,field_player_poses+pose,field.current);
 for(i=0;i<192;i+=16){if(!object_part1[i])continue;
  px=(((uint16_t)object_part1[i+4]*16+object_part1[i+6]-field.camera_x+512)&1023)-512;
  py=(((uint16_t)object_part1[i+5]*16+object_part1[i+7]-field.camera_y+512)&1023)-515;
  if(px<=-16||px>=160||py<=-16||py>=144)continue;
  pose=(((uint16_t)object_part1[i+15]<<8)|object_part1[i+14])-0xb41a;
  if(field.face==i&&(object_part1[i+13]&128)){pose=(field.direction&1)?16:(field.direction&2)?0:(field.direction&4)?48:32;object_part1[i+13]&=127;}
  pose+=object_part2[i+5];n=quad(o,n,px,py,i,field_npc_poses+pose,object_part2[i+1]);
 }
 object_oam_count=n;
 memset(text_staging,0,144);hist=o;
 for(i=0;i<n;i++){sy=*hist;hist+=4;
  if(sy>=16&&sy<=152){uint8_t *line=text_staging+sy-16;for(j=0;j<8;j++){count=++*line++;if(count>peak)peak=count;}}
  else for(j=0;j<8;j++){py=(int16_t)sy-16+j;if(py>=0&&py<144){count=++text_staging[py];if(count>peak)peak=count;}}
 }
 object_line_peak=peak;
 if(object_line_peak>10){field.error=9;return 0;}
 elapsed=ff3_clock_now()-stage;if(elapsed>field.max_oam_ticks)field.max_oam_ticks=elapsed;stage=ff3_clock_now();
 if(boot){_shadow_OAM_base=page;SCX_REG=(uint8_t)field.camera_x;SCY_REG=(uint8_t)field.camera_y;LCDC_REG=0x83;}
 else ff3_field_publish(page,(uint8_t)field.camera_x,(uint8_t)field.camera_y);
 field.oam_page=page;field.draws++;
 elapsed=ff3_clock_now()-stage;if(elapsed>field.max_publish_ticks)field.max_publish_ticks=elapsed;elapsed=ff3_clock_now()-begin;if(elapsed>field.max_render_ticks)field.max_render_ticks=elapsed;
 field.render_busy=0;return 1;
}
