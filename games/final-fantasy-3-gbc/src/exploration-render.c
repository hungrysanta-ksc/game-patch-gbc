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
/* Adjacent horizontal cells share one original metatile/attribute lookup. */
static void row_cells(uint8_t y){
 uint8_t x=field.cache_x,i=0,m,pos,attr;const uint8_t *p,*map=map_workspace.tiles+(uint16_t)((y&63)>>1)*32;
 while(i<32){m=((x|y)&64)?map_workspace.properties[3]:map[x>>1];if(m>=128){field.error=1;m=0;}
  p=map_workspace.metas+(uint16_t)m*4+(y&1)*2;attr=map_workspace.attributes[m];pos=x&31;
  field_staging[pos]=p[x&1];field_staging[pos+32]=attr;i++;
  if(!(x&1)&&i<32){field_staging[pos+1]=p[1];field_staging[pos+33]=attr;i++;x=(x+2)&127;}
  else x=(x+1)&127;
 }
}
static void row(uint8_t y,uint8_t boot){uint16_t a=0x9800u+(uint16_t)(y&31)*32;
 ff3_field_flush();row_cells(y);
 if(boot){VBK_REG=0;memcpy((void*)a,field_staging,32);VBK_REG=1;memcpy((void*)a,field_staging+32,32);VBK_REG=0;}
 else ff3_field_strip(a,1);
}
static void column(uint8_t x){uint8_t i;
 for(i=0;i<32;i++)cell(x,(field.cache_y+i)&127,&field_staging[((field.cache_y+i)&31)*2],&field_staging[((field.cache_y+i)&31)*2+1]);
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
static void swap_npc_draw(void){uint8_t *a=object_part1+npc_draw[0],j,t;
 for(j=0;j<4;j++){t=a[j+4];a[j+4]=npc_draw[j+1];npc_draw[j+1]=t;}
 t=a[14];a[14]=npc_draw[5];npc_draw[5]=t;t=a[15];a[15]=npc_draw[6];npc_draw[6]=t;
}
static uint8_t npc_object(uint8_t *o,uint8_t n,uint8_t i){
 uint8_t *a=object_part1+i,*b=object_part2+i,phase,type,clock,base;int16_t px,py;uint16_t pose;
  px=(((uint16_t)a[4]*16+a[6]-field.camera_x+512)&1023)-512;
  py=(((uint16_t)a[5]*16+a[7]-field.camera_y+512)&1023)-515;
  /* A walking phase can shift one pixel left/up; retain the edge candidates. */
  if(field.face!=i&&(px<=-16||px>=161||py<=-16||py>=145))return n;
  pose=(((uint16_t)a[15]<<8)|a[14])-0xb41a;
  base=i;type=a[1]&0xf0;clock=field.mode?field.dialogue_frame:field.frame;
  if(!type)phase=((a[6]|a[7])<<1)&8;
  else if(!(type&0x40))phase=0;
  else{if(type&128)clock=(type&16)?clock<<1:clock>>1;phase=clock&8;if((type&0x50)==0x50&&(clock&16))base-=8;}
  if(field.face==i&&((a[13]&128)||(field.mode==2&&!(type&0x30)))){pose=(field.direction&1)?16:(field.direction&2)?0:(field.direction&4)?48:32;a[13]&=127;phase=0;base=i;}
  else if(phase&&!type){if(a[7])px--;else py--;}
  if(px<=-16||px>=160||py<=-16||py>=144)return n;
  pose+=phase+b[5];n=quad(o,n,px,py,base,field_npc_poses+pose,b[1]);
 return n;
}
/* Separate composition and scanline accounting to bound SM83 stack spills. */
static uint8_t objects(uint8_t *o){
 uint8_t i,n=0,phase,slot;int16_t px,py;uint16_t pose;
 phase=(field.subx|field.suby)&8;pose=field_player_poses[field.direction&15]+phase+16;px=72;py=61;
 if(phase){if(field.suby)px--;else py--;}
 n=quad(o,n,px,py,192,field_player_poses+pose,field.current);
 if(!field.mode&&npc_draw_valid)swap_npc_draw();
 for(slot=0;slot<12;slot++){i=(!field.mode&&(field.frame&1))?176-slot*16:slot*16;if(!object_part1[i])continue;
  n=npc_object(o,n,i);
 }
 if(!field.mode&&npc_draw_valid)swap_npc_draw();
 return n;
}
/* Mark the two ends of each eight-line interval, then prefix-sum it.
 * OAM Y is biased by 16; only lines 16..159 contribute to the LCD limit. */
static uint8_t line_peak(const uint8_t *o,uint8_t n){
 uint8_t y,count=0,peak=0;uint8_t *line;
 memset(text_staging,0,168);
 while(n--){y=*o;o+=4;text_staging[y]++;text_staging[y+8]--;}
 line=text_staging;for(y=0;y<160;y++){count+=*line++;if(y>=16&&count>peak)peak=count;}
 return peak;
}
uint8_t ff3_field_render(uint8_t boot) BANKED {
 uint8_t i,page,tx,ty,*o;uint16_t begin,stage,elapsed;FF3Asset a;
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
 object_oam_count=objects(o);object_line_peak=line_peak(o,object_oam_count);
 if(object_line_peak>10){field.error=9;return 0;}
 elapsed=ff3_clock_now()-stage;if(elapsed>field.max_oam_ticks)field.max_oam_ticks=elapsed;stage=ff3_clock_now();
 if(boot){_shadow_OAM_base=page;SCX_REG=(uint8_t)field.camera_x;SCY_REG=(uint8_t)field.camera_y;LCDC_REG=0x83;}
 else ff3_field_publish(page,(uint8_t)field.camera_x,(uint8_t)field.camera_y);
 field.oam_page=page;field.draws++;
 elapsed=ff3_clock_now()-stage;if(elapsed>field.max_publish_ticks)field.max_publish_ticks=elapsed;elapsed=ff3_clock_now()-begin;if(elapsed>field.max_render_ticks)field.max_render_ticks=elapsed;
 field.render_busy=0;return 1;
}
