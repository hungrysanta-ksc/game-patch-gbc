#pragma bank 12
#include <string.h>
#include "battle-stone.h"
#include "stone-assets.h"
#include "text-vblank.h"
void ff3_party_copy(uint8_t bank,const void*src,void*dst,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
void ff3_resident_base_pattern(uint8_t tile,uint8_t*out) NONBANKED;
void ff3_resident_base_cell(uint8_t x,uint8_t y,uint8_t*out) NONBANKED;
void ff3_resident_base_row(uint8_t page,uint8_t row,uint8_t*out) NONBANKED;
volatile uint8_t stone_error;
volatile uint16_t stone_pattern_bytes,stone_map_bytes;
uint8_t __at(0xd600) stone_patterns[768];
static const uint8_t top[4]={0,4,6,10},rows[4]={5,4,5,4};
static uint8_t profile_id,kind[4],col[4],cached[2][8],valid[2],count,extra_count;
static uint16_t old_half[2][2],keys[40];
static uint8_t attrs[40],base[17],glyph[16],colors[16];
static uint8_t objects[2][96],object_count[2],masked[2][16][3],masked_count[2];
static void append(uint8_t page,uint8_t*oam){uint8_t i,j,n=0;uint8_t*r;
 for(i=0;i<40;i++){r=oam+i*4;
  // Source pose zero references the verified all-zero bank-0 tile. Reuse
  // only empty owners, preserving source priority for every visible dot.
  if(!r[0]||(!(r[3]&8)&&!r[2]))continue;
  if(r[3]&8)for(j=0;j<masked_count[page];j++)if(r[0]==masked[page][j][0]&&r[1]==masked[page][j][1]){r[2]=masked[page][j][2];break;}
  memmove(oam+n*4,r,4);n++;
 }
 memset(oam+n*4,0,(40-n)*4);
 if(n+object_count[page]>40){stone_error=5;return;}
 memcpy(oam+n*4,objects[page],object_count[page]*4);
}
static uint8_t any(const uint8_t*p){uint8_t i,v=0;for(i=0;i<16;i++)v|=p[i];return v;}
void ff3_stone_reset(uint8_t profile) BANKED {profile_id=profile;memset(kind,3,4);memset(col,0,4);memset(valid,0,2);memset(masked_count,0,2);memset(old_half,0,sizeof(old_half));stone_error=0;memset((void*)0xd900,0xa9,16);}
uint8_t ff3_stone_change(uint8_t actor,const uint8_t*w,uint8_t back) BANKED {uint8_t x;
 if(actor>=4||w[0]!=3||w[1]>3||w[3]||w[7]||w[4]!=(actor&1?6:8)||w[2]!=(w[1]==3?0:actor*8))return 0;
 x=(w[5]&31)-(back?2:10);if(back?(x!=0&&x!=2&&x!=6):(x!=16&&x!=18&&x!=12))return 0;
 if(kind[actor]<3&&col[actor]!=x)return 0;
 kind[actor]=w[1];col[actor]=x;return 1;
}
static void read_glyph(uint8_t slot,uint8_t x,uint8_t y){const StoneAsset*a=stone_assets+profile_id;
 ff3_party_copy(a->bank,a->glyphs+(uint16_t)(slot*3+kind[slot])*160+(uint16_t)((y-top[slot])*2+x-col[slot])*16,glyph,16);
}
void ff3_stone_prepare(uint8_t page,uint8_t*oam) BANKED {
 uint8_t slot,x,y,i,pal,row,v,mapped,mask,changed,n,lo,hi,total,j,half;uint16_t key,dirty[2]={0,0},at;uint8_t*out;
 const StoneAsset*a=stone_assets+profile_id;if(page>1){stone_error=1;return;}
 changed=!valid[page]||memcmp(cached[page],kind,4)||memcmp(cached[page]+4,col,4);
 if(!changed){append(page,oam);return;}
 // Reconstruct at most forty dirty 8x8 cells, never the whole screen.
 count=extra_count=0;ff3_party_copy(a->bank,a->colors,colors,16);
 for(slot=0;slot<4;slot++)if(kind[slot]<3)for(y=top[slot];y<top[slot]+rows[slot];y++)for(x=col[slot];x<col[slot]+2;x++){
  read_glyph(slot,x,y);ff3_native_service();if(!any(glyph))continue;key=(uint16_t)y*32+x;for(i=0;i<count&&keys[i]!=key;i++);if(i==count){if(count==40){stone_error=2;return;}keys[count++]=key;}
 }
 for(i=0;i<count;i++){
  x=keys[i]&31;y=keys[i]>>5;dirty[x>>4]|=(uint16_t)1<<y;ff3_resident_base_cell(x,y,base);pal=base[16]&3;if(!any(base))pal=3;
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
  if(any(text_staging)){
   if(extra_count==24){stone_error=3;return;}if(count+extra_count>=a->span){stone_error=4;return;}
   // Cell count is already known. Write residual patterns and the inactive
   // OAM page directly; a second 384-byte tile scratch buffer is redundant.
   memcpy(stone_patterns+(uint16_t)(count+extra_count)*16,text_staging,16);
   objects[page][extra_count*4]=y*8+16;objects[page][extra_count*4+1]=x*8+8;
   objects[page][extra_count*4+2]=a->base+page*a->span+count+extra_count;objects[page][extra_count*4+3]=15;extra_count++;
  }
  ff3_native_service();
 }
 if(count+extra_count>a->span){stone_error=4;return;}
 total=count+extra_count;masked_count[page]=0;
 // The source stone map replaces BG cells. Mask native enemy residual
 // OBJ at the same cells so a palette adapter cannot outlive its BG owner.
 for(j=0;j<40;j++){
  out=oam+j*4;if(!out[0]||!(out[3]&8)||out[2]>=a->base)continue;
  x=(out[1]-8)>>3;y=(out[0]-16)>>3;if((out[3]&96)||(out[1]&7)||(out[0]&7)){stone_error=6;return;}
  // No stone can cover this cell: retain the immutable enemy tile and
  // avoid redundant bank copies/audio refill checkpoints on every clear.
  for(slot=0;slot<4;slot++)if(kind[slot]<3&&x>=col[slot]&&x<col[slot]+2&&y>=top[slot]&&y<top[slot]+rows[slot])break;
  if(slot==4)continue;
  ff3_resident_base_pattern(out[2],base);memcpy(text_staging,base,16);
  for(slot=0;slot<4;slot++)if(kind[slot]<3&&x>=col[slot]&&x<col[slot]+2&&y>=top[slot]&&y<top[slot]+rows[slot]){
   read_glyph(slot,x,y);for(row=0;row<16;row+=2){mask=~(glyph[row]|glyph[row+1]);text_staging[row]&=mask;text_staging[row+1]&=mask;}
  }
  if(memcmp(base,text_staging,16)){
   if(total==a->span||masked_count[page]==16){stone_error=4;return;}
   n=masked_count[page]++;masked[page][n][0]=out[0];masked[page][n][1]=out[1];masked[page][n][2]=a->base+page*a->span+total;
   memcpy(stone_patterns+(uint16_t)total*16,text_staging,16);total++;
  }ff3_native_service();
 }

 if(changed){
  for(at=0;at<(uint16_t)total*16;at+=n){n=(uint16_t)total*16-at>128?128:total*16-at;memcpy(text_staging,stone_patterns+at,n);ff3_text_copy(1,0x8000+(uint16_t)(a->base+page*a->span)*16+at,text_staging,n);stone_pattern_bytes+=n;ff3_native_service();}
  dirty[0]|=old_half[page][0];dirty[1]|=old_half[page][1];
  for(y=0;y<14;y++)if((dirty[0]|dirty[1])&((uint16_t)1<<y)){
   ff3_resident_base_row(page,y,text_staging);
   for(i=0;i<count;i++)if((keys[i]>>5)==y){x=keys[i]&31;text_staging[x]=a->base+page*a->span+i;text_staging[32+x]=attrs[i];}
   // HDMA accepts aligned 16-byte spans. Publish only the half-row that
   // had or will have stone cells, retaining the other resident owners.
   for(half=0;half<2;half++)if(dirty[half]&((uint16_t)1<<y)){
    at=(page?0x9c00:0x9800)+(uint16_t)y*32+half*16;
    ff3_text_copy(0,at,text_staging+half*16,16);
    ff3_text_copy(1,at,text_staging+32+half*16,16);stone_map_bytes+=32;
   }ff3_native_service();
  }
  old_half[page][0]=old_half[page][1]=0;
  for(i=0;i<count;i++)old_half[page][(keys[i]&31)>>4]|=(uint16_t)1<<(keys[i]>>5);
  memcpy(cached[page],kind,4);memcpy(cached[page]+4,col,4);valid[page]=1;
 }
 // Append after actual party/enemy owners. Blank hidden objects may be
 // reused; no on-screen tile is removed to obtain an OAM slot.
 object_count[page]=extra_count;
 append(page,oam);
}
