#pragma bank 42
#include <gb/cgb.h>
#include <string.h>
#include "battle-live-ui.h"
#include "live-ui-assets.h"
#include "battle-workspace.h"
#include "text-vblank.h"
#ifdef FF3_EFFECTS
#include "battle-effect-freeze.h"
#endif
void ff3_party_copy(uint8_t bank,const void*source,void*dest,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
volatile uint8_t live_ui_request,live_ui_error,live_ui_ready;
volatile uint8_t live_ui_transfer;
uint8_t live_ui_input[18];
static uint8_t hp[60],words[5][14],lengths[5],mask,primed;
uint16_t live_ui_updates,live_ui_pattern_bytes;
#define rowdata battle_workspace.map
#define line (battle_workspace.map+352)
#define glyph (battle_workspace.map+480)
static void text(const uint8_t*ids,uint8_t count,uint8_t x,uint8_t y,uint8_t compact,uint8_t row){uint8_t i,id,advance,yy,top=row*8,bits,v,shift;uint16_t at;
 if(y>=top+8||y+(compact?7:8)<=top)return;
 for(i=0;i<count;i++){id=ids[i];
  if(compact){if(id>11){live_ui_error=5;return;}ff3_party_copy(43,live_ui_hp_glyphs+(uint16_t)id*16,glyph,16);advance=6;}
  else{ff3_party_copy(43,live_ui_glyphs+(uint16_t)id*16,glyph,16);ff3_party_copy(43,live_ui_advances+id,&advance,1);}
  for(yy=0;yy<(compact?7:8);yy++)if(y+yy>=top&&y+yy<top+8){
   /* HP is native 5x7 ink with one blank column, never resampled NES ink. */
   bits=glyph[yy*2]&glyph[yy*2+1];
   at=(uint16_t)(x>>3)*16+(y+yy-top)*2;shift=x&7;v=bits>>shift;rowdata[at]|=v;rowdata[at+1]|=v;
   if(shift&&x/8<19){v=bits<<(8-shift);rowdata[at+16]|=v;rowdata[at+17]|=v;}
  }x+=advance;ff3_native_service();
 }
}
static void render(uint8_t dirty){uint8_t row,l,r[6],yy,x,top,bottom,i;uint16_t offset,dest;
 for(row=0;row<5;row++)if(dirty&(1<<row)){
  memset(rowdata,0,320);
  for(l=0;l<6;l++)if(!l||(mask&(1<<(l-1)))){
   ff3_party_copy(43,live_ui_rect+(uint16_t)l*6,r,6);top=row*8;if(top<r[1])top=r[1];bottom=row*8+8;if(bottom>r[1]+r[3])bottom=r[1]+r[3];
   for(yy=top;yy<bottom;yy++){offset=r[4]+((uint16_t)r[5]<<8)+(uint16_t)(yy-r[1])*(r[2]/4);ff3_party_copy(43,live_ui_boxes+offset,line,r[2]/4);dest=(uint16_t)(r[0]/8)*16+(yy-row*8)*2;for(x=0;x<r[2]/4;x+=2){rowdata[dest]=line[x];rowdata[dest+1]=line[x+1];dest+=16;}ff3_native_service();}
   if(!l){for(i=0;i<4;i++){text(hp+i*15,6,53,5+i*8,0,row);text(hp+i*15+6,9,103,5+i*8,1,row);}}
   else text(words[l-1],lengths[l-1],r[0]+4,r[1]+3,0,row);
   ff3_native_service();
  }
  dest=0x8700+(uint16_t)row*320;
  live_ui_transfer=1;for(offset=0;offset<320;offset+=160){memcpy(text_staging,rowdata+offset,160);ff3_text_copy(0,dest+offset,text_staging,160);
#ifdef FF3_EFFECTS
   if(effect_signed&&!row)ff3_text_copy(0,dest+offset+0x1000,text_staging,offset?96:160);
#endif
   ff3_native_service();}live_ui_transfer=0;live_ui_pattern_bytes+=320;
 }
 live_ui_updates++;
}
void ff3_live_ui_reset(void) BANKED {live_ui_ready=live_ui_request=mask=primed=0;memset(lengths,0,5);ff3_party_copy(43,live_ui_seed,hp,60);}
#ifdef FF3_SCENE_LAYOUT
extern uint8_t ff3_game_state[1024];
/* 32/95E1: four displayed decimal positions (low four of the original
 * five-digit conversion), blank leading zeroes, visible units zero. */
void ff3_live_ui_party_hp(void) BANKED {
 uint8_t i,k,j,d,seen,*out,*c;uint16_t n,div;
 for(i=0;i<4;i++)for(k=0;k<2;k++){
  c=ff3_game_state+256+(uint16_t)i*64+12+k*2;n=c[0]|((uint16_t)c[1]<<8);
  while(n>=10000)n-=10000;out=hp+i*15+6+k*5;seen=0;div=1000;
  for(j=0;j<4;j++){d=0;while(n>=div){n-=div;d++;}if(d||j==3)seen=1;out[j]=seen?d+1:0;div/=10;}
  hp[i*15+10]=11;
 }
}
void ff3_live_ui_records(const uint8_t*records) BANKED {
 uint8_t i,k,j,d,seen,*out;uint16_t n,div;
 for(i=0;i<4;i++)for(k=0;k<2;k++){
  const uint8_t*c=records+(uint16_t)i*64+3+k*2;n=c[0]|((uint16_t)c[1]<<8);
  while(n>=10000)n-=10000;out=hp+i*15+6+k*5;seen=0;div=1000;
  for(j=0;j<4;j++){d=0;while(n>=div){n-=div;d++;}if(d||j==3)seen=1;out[j]=seen?d+1:0;div/=10;}hp[i*15+10]=11;
 }if(live_ui_ready)render(31);
}
#endif
/* Original entry owns the initial menu resources already. Prepare one row
 * beside each of its first five pictures; do not expose the menu early. */
void ff3_live_ui_prime(void) BANKED {if(primed<5){render(1<<primed);primed++;}}
void ff3_live_ui_update(void) BANKED {uint8_t row,i,kind,index,count,top,bottom,dirty=0;
 if(live_ui_error)return;
 if(!live_ui_ready){
  if(primed!=5){live_ui_error=4;return;}
  ff3_party_copy(43,live_ui_palette,text_staging,8);ff3_text_palette_range(1,3,1,text_staging);
  /* Both BG pages share the menu reservation. Entry/boss transfers stop at
   * row 12. UI patterns 112..211 never alias party/status OBJ 0..111. */
  live_ui_transfer=1;memset(text_staging,0,160);for(row=0;row<5;row++)for(i=0;i<20;i++)text_staging[row*32+i]=112+row*20+i;
  ff3_text_copy(0,0x99a0,text_staging,160);ff3_native_service();ff3_text_copy(0,0x9da0,text_staging,160);ff3_native_service();
  memset(text_staging,0,160);for(row=0;row<5;row++)memset(text_staging+row*32,3,20);
  ff3_text_copy(1,0x99a0,text_staging,160);ff3_native_service();ff3_text_copy(1,0x9da0,text_staging,160);ff3_native_service();
  live_ui_transfer=0;live_ui_ready=1;
 }
 if(!live_ui_request)return;
 kind=live_ui_input[0];index=live_ui_input[1];count=live_ui_input[2];
 if(kind<1||kind>3||index>=(kind==3?4:5)||count>(kind==3?15:14)||(kind==3&&count!=15)||(kind==2&&count)){live_ui_error=1;return;}
 for(i=0;i<count;i++)if(live_ui_input[3+i]>=LIVE_UI_GLYPHS){live_ui_error=2;return;}
 if(kind==1){uint8_t width=0,advance;for(i=0;i<count;i++){ff3_party_copy(43,live_ui_advances+live_ui_input[3+i],&advance,1);width+=advance;}ff3_party_copy(43,live_ui_rect+(uint16_t)(index+1)*6+2,&advance,1);if(width>advance-7){live_ui_error=3;return;}memcpy(words[index],live_ui_input+3,count);lengths[index]=count;mask|=1<<index;}
 else if(kind==2)mask&=~(1<<index);
 else memcpy(hp+index*15,live_ui_input+3,15);
 if(kind==3){top=5+index*8;bottom=top+8;}else {ff3_party_copy(43,live_ui_rect+(uint16_t)(index+1)*6+1,&top,1);bottom=top+14;}
 for(row=top/8;row<=(bottom-1)/8;row++)dirty|=1<<row;
 render(dirty);live_ui_request=0;
}
