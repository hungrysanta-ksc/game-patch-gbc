#pragma bank 12
#include <string.h>
#include "battle-stone.h"
#include "stone-assets.h"
#include "text-vblank.h"
void ff3_party_copy(uint8_t bank,const void*src,void*dst,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
void ff3_resident_base_cell(uint8_t x,uint8_t y,uint8_t*out) NONBANKED;
void ff3_resident_base_row(uint8_t page,uint8_t row,uint8_t*out) NONBANKED;
volatile uint8_t stone_error;
volatile uint16_t stone_pattern_bytes,stone_map_bytes;
uint8_t __at(0xd600) stone_patterns[768];
static const uint8_t top[4]={0,4,6,10},rows[4]={5,4,5,4};
static uint8_t profile_id,kind[4],col[4],cached[2][8],valid[2],count,extra_count;
static uint16_t old_rows[2],keys[40];
static uint8_t attrs[40],extra_pos[8][2],extra_tiles[8][16],base[17],glyph[16],colors[16];
static uint8_t objects[2][32],object_count[2];
static void append(uint8_t page,uint8_t*oam){uint8_t i,n=0;
 for(i=0;i<40;i++)if(oam[i*4])n=i+1;
 if(n+object_count[page]>40){stone_error=5;return;}
 memcpy(oam+n*4,objects[page],object_count[page]*4);
}
static uint8_t any(const uint8_t*p){uint8_t i,v=0;for(i=0;i<16;i++)v|=p[i];return v;}
void ff3_stone_reset(uint8_t profile) BANKED {profile_id=profile;memset(kind,3,4);memset(col,0,4);memset(valid,0,2);old_rows[0]=old_rows[1]=0;stone_error=0;memset((void*)0xd900,0xa9,16);}
uint8_t ff3_stone_change(uint8_t actor,const uint8_t*w,uint8_t back) BANKED {uint8_t x;
 if(actor>=4||w[0]!=3||w[1]>3||w[3]||w[7]||w[4]!=(actor&1?6:8)||w[2]!=(w[1]==3?0:actor*8))return 0;
 x=(w[5]&31)-(back?2:10);if(back?(x!=0&&x!=2&&x!=6):(x!=16&&x!=18&&x!=12))return 0;
 /* Confused non-stone actors still issue source clear descriptors. Stone
  * in the enemy area requires a separate BG/residual ownership adapter. */
 if(w[1]!=3&&x==(back?6:12))return 0;
 if(kind[actor]<3&&col[actor]!=x)return 0;
 kind[actor]=w[1];col[actor]=x;return 1;
}
static void read_glyph(uint8_t slot,uint8_t x,uint8_t y){const StoneAsset*a=stone_assets+profile_id;
 ff3_party_copy(a->bank,a->glyphs+(uint16_t)(slot*3+kind[slot])*160+(uint16_t)((y-top[slot])*2+x-col[slot])*16,glyph,16);
}
void ff3_stone_prepare(uint8_t page,uint8_t*oam) BANKED {
 uint8_t slot,x,y,i,pal,row,v,mapped,mask,changed,n,lo,hi;uint16_t key,dirty=0,at;uint8_t*out;
 const StoneAsset*a=stone_assets+profile_id;if(page>1){stone_error=1;return;}
 changed=!valid[page]||memcmp(cached[page],kind,4)||memcmp(cached[page]+4,col,4);
 if(!changed){append(page,oam);return;}
 // Reconstruct at most forty dirty 8x8 cells, never the whole screen.
 count=extra_count=0;ff3_party_copy(a->bank,a->colors,colors,16);
 for(slot=0;slot<4;slot++)if(kind[slot]<3)for(y=top[slot];y<top[slot]+rows[slot];y++)for(x=col[slot];x<col[slot]+2;x++){
  read_glyph(slot,x,y);ff3_native_service();if(!any(glyph))continue;key=(uint16_t)y*32+x;for(i=0;i<count&&keys[i]!=key;i++);if(i==count){if(count==40){stone_error=2;return;}keys[count++]=key;}
 }
 for(i=0;i<count;i++){
  x=keys[i]&31;y=keys[i]>>5;dirty|=(uint16_t)1<<y;ff3_resident_base_cell(x,y,base);pal=base[16]&3;if(!any(base))pal=3;
  out=stone_patterns+(uint16_t)i*16;memcpy(out,base,16);memset(text_staging,0,16);
  for(slot=0;slot<4;slot++)if(kind[slot]<3&&x>=col[slot]&&x<col[slot]+2&&y>=top[slot]&&y<top[slot]+rows[slot]){
   read_glyph(slot,x,y);for(row=0;row<16;row+=2){
    lo=glyph[row];hi=glyph[row+1];mask=~(lo|hi);text_staging[row]&=mask;text_staging[row+1]&=mask;
    if(pal==3){out[row]=(out[row]&mask)|lo;out[row+1]=(out[row+1]&mask)|hi;continue;}
    // Three bit masks represent all eight pixels. Only a color-boundary
    // cell needs remapping; ordinary stone cells keep their bitplanes.
    for(v=1;v<4;v++){mask=v==1?(lo&~hi):v==2?(hi&~lo):(lo&hi);mapped=colors[pal*4+v];
     if(mapped==255){if(v&1)text_staging[row]|=mask;if(v&2)text_staging[row+1]|=mask;}
     else {out[row]&=~mask;out[row+1]&=~mask;if(mapped&1)out[row]|=mask;if(mapped&2)out[row+1]|=mask;}
    }
   }ff3_native_service();
  }
  attrs[i]=8+pal;
  if(any(text_staging)){if(extra_count==8){stone_error=3;return;}extra_pos[extra_count][0]=x*8;extra_pos[extra_count][1]=y*8;memcpy(extra_tiles[extra_count++],text_staging,16);}
  ff3_native_service();
 }
 if(count+extra_count>48){stone_error=4;return;}
 for(i=0;i<extra_count;i++)memcpy(stone_patterns+(uint16_t)(count+i)*16,extra_tiles[i],16);
 if(changed){
  for(at=0;at<(uint16_t)(count+extra_count)*16;at+=n){n=(uint16_t)(count+extra_count)*16-at>128?128:(count+extra_count)*16-at;memcpy(text_staging,stone_patterns+at,n);ff3_text_copy(1,0x8000+(uint16_t)(150+page*48)*16+at,text_staging,n);stone_pattern_bytes+=n;ff3_native_service();}
  dirty|=old_rows[page];
  for(y=0;y<14;y++)if(dirty&((uint16_t)1<<y)){
   ff3_resident_base_row(page,y,text_staging);
   for(i=0;i<count;i++)if((keys[i]>>5)==y){x=keys[i]&31;text_staging[x]=150+page*48+i;text_staging[32+x]=attrs[i];}
   // Palette attributes and IDs occupy different VRAM banks; both go to
   // the inactive map before its single VBlank publication.
   ff3_text_copy(0,(page?0x9c00:0x9800)+(uint16_t)y*32,text_staging,32);memmove(text_staging,text_staging+32,32);
   ff3_text_copy(1,(page?0x9c00:0x9800)+(uint16_t)y*32,text_staging,32);stone_map_bytes+=64;ff3_native_service();
  }
  old_rows[page]=0;for(i=0;i<count;i++)old_rows[page]|=(uint16_t)1<<(keys[i]>>5);
  memcpy(cached[page],kind,4);memcpy(cached[page]+4,col,4);valid[page]=1;
 }
 // Append after actual party/enemy owners. Blank hidden objects may be
 // reused; no on-screen tile is removed to obtain an OAM slot.
 object_count[page]=extra_count;
 for(i=0;i<extra_count;i++){objects[page][i*4]=extra_pos[i][1]+16;objects[page][i*4+1]=extra_pos[i][0]+8;objects[page][i*4+2]=150+page*48+count+i;objects[page][i*4+3]=15;}
 append(page,oam);
}
