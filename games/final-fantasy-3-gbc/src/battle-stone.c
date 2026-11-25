#pragma bank 12
#include <string.h>
#include "battle-stone.h"
#include "stone-assets.h"
#include "text-vblank.h"
#include "battle-workspace.h"
void ff3_party_copy(uint8_t bank,const void*src,void*dst,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
extern volatile uint8_t party_work;
void ff3_resident_base_pattern(uint8_t tile,uint8_t*out) NONBANKED;
void ff3_resident_base_cell(uint8_t x,uint8_t y,uint8_t*out) NONBANKED;
void ff3_resident_base_row(uint8_t page,uint8_t row,uint8_t*out) NONBANKED;
volatile uint8_t stone_error;
volatile uint16_t stone_pattern_bytes,stone_map_bytes;
volatile uint16_t stone_cells_built,stone_cells_reused;
uint8_t __at(0xd600) stone_patterns[768];
static const uint8_t top[4]={0,4,6,10},rows[4]={5,4,5,4};
static uint8_t profile_id,kind[4],col[4],cached[2][8],valid[2],count,extra_count;
/* Tags: cell key bits 0..8, residual identity bit 9, extra-plane presence
 * bit 11, BG palette bits 12..13, active map owner bit 14.
 * 0xffff invalidates a masked-enemy slot.
 * Each page describes its actual retained VRAM, independent of scratch. */
static uint16_t tags[2][48],occupied[12];
static uint8_t signatures[2][48],free_slot;
#define keys battle_workspace.stone.keys
#define flags battle_workspace.stone.flags
#define slots battle_workspace.stone.slots
#define extras battle_workspace.stone.extras
#define cell_sig battle_workspace.stone.cell_sig
#define cell_base battle_workspace.stone.base
#define glyph battle_workspace.stone.glyph
#define cell_colors battle_workspace.stone.colors
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
void ff3_stone_reset(uint8_t profile) BANKED {const StoneAsset*a=stone_assets+profile;profile_id=profile;memset(kind,3,4);memset(col,0,4);memset(valid,0,2);memset(masked_count,0,2);memset(tags,255,sizeof(tags));ff3_party_copy(a->bank,a->occupied,occupied,24);stone_error=0;memset((void*)0xd900,0xa9,16);}
uint8_t ff3_stone_change(uint8_t actor,const uint8_t*w,uint8_t back) BANKED {uint8_t x;
 if(actor>=4||w[0]!=3||w[1]>3||w[3]||w[7]||w[4]!=(actor&1?6:8)||w[2]!=(w[1]==3?0:actor*8))return 0;
 x=(w[5]&31)-(back?2:10);if(back?(x!=0&&x!=2&&x!=6):(x!=16&&x!=18&&x!=12))return 0;
 if(kind[actor]<3&&col[actor]!=x)return 0;
 kind[actor]=w[1];col[actor]=x;return 1;
}
static void read_glyph(uint8_t slot,uint8_t x,uint8_t y){const StoneAsset*a=stone_assets+profile_id;
 ff3_party_copy(a->bank,a->glyphs+(uint16_t)(slot*3+kind[slot])*160+(uint16_t)((y-top[slot])*2+x-col[slot])*16,glyph,16);
}
static uint8_t find(uint8_t page,uint16_t key,uint8_t sig,uint8_t span){uint8_t i;for(i=0;i<span;i++)if((tags[page][i]&2047)==key&&signatures[page][i]==sig)return i;return 255;}
/* Reservation is complete before the first allocation. No slot is freed
 * during this prepare, so advance once instead of rescanning its prefix. */
static uint8_t allocate(uint8_t span){while(free_slot<span){uint8_t i=free_slot++;if(!flags[i]){flags[i]=1;return i;}}stone_error=4;return 255;}
void ff3_stone_prepare(uint8_t page,uint8_t*oam) BANKED {
 uint8_t slot,x,y,i,pal,row,v,mapped,mask,changed,n,lo,hi,total,j,half,sig,hit,has_extra;uint16_t key,dirty[2]={0,0},at;uint8_t*out;
 const StoneAsset*a=stone_assets+profile_id;if(page>1){stone_error=1;return;}
 changed=!valid[page]||memcmp(cached[page],kind,4)||memcmp(cached[page]+4,col,4);
 if(!changed){append(page,oam);return;}
 // Allocation/composition can meet a costly source audio tick. Use the
 // established three-tick target only for actual ownership changes.
 party_work=2;ff3_native_service();
 // Occupancy comes only from immutable original glyph bits. Tags describe
 // retained VRAM slots, not precomposed pictures or a hash approximation.
 count=extra_count=free_slot=0;memset(flags,0,48);memset(slots,255,40);memset(extras,255,40);ff3_party_copy(a->bank,a->colors,cell_colors,16);
 for(slot=0;slot<4;slot++)if(kind[slot]<3)for(y=top[slot];y<top[slot]+rows[slot];y++)for(x=col[slot];x<col[slot]+2;x++){
  if(!(occupied[slot*3+kind[slot]]&((uint16_t)1<<((y-top[slot])*2+x-col[slot]))))continue;key=(uint16_t)y*32+x;for(i=0;i<count&&keys[i]!=key;i++);if(i==count){if(count==40){stone_error=2;return;}keys[count++]=key;}ff3_native_service();
 }
 // Reserve every retained owner before allocating any changed cell. This
 // prevents an early miss from evicting a later actor's unchanged tile.
 for(i=0;i<count;i++){
  key=keys[i];x=key&31;y=key>>5;sig=255;
  // All accepted columns are even. Cell coordinates plus the four 2-bit
  // source kinds identify the exact glyph offsets and overlay order.
  for(slot=0;slot<4;slot++)if(kind[slot]<3&&x>=col[slot]&&x<col[slot]+2&&y>=top[slot]&&y<top[slot]+rows[slot])sig=(sig&~(3<<(slot*2)))|(kind[slot]<<(slot*2));
  cell_sig[i]=sig;j=find(page,key,sig,a->span);slots[i]=j;
  if(j==255||!(tags[page][j]&16384))dirty[x>>4]|=(uint16_t)1<<y;
  if(j!=255){flags[j]=1;if(tags[page][j]&2048){extras[i]=find(page,key|512,sig,a->span);if(extras[i]!=255)flags[extras[i]]=1;}}
  ff3_native_service();
 }
 for(j=0;j<a->span;j++)if(tags[page][j]!=65535&&(tags[page][j]&16384)){key=tags[page][j]&511;if(!flags[j])dirty[(key&31)>>4]|=(uint16_t)1<<(key>>5);tags[page][j]&=~16384;}
 for(i=0;i<count;i++){
  key=keys[i];x=key&31;y=key>>5;sig=cell_sig[i];j=slots[i];hit=j!=255;has_extra=hit&&(tags[page][j]&2048)!=0;
  if(has_extra&&extras[i]==255)hit=0;
  if(hit){pal=(tags[page][j]>>12)&3;stone_cells_reused++;}
  else {
  if(j==255){j=allocate(a->span);if(stone_error)return;slots[i]=j;}
  stone_cells_built++;ff3_resident_base_cell(x,y,cell_base);pal=cell_base[16]&3;if(!any(cell_base))pal=3;
  out=stone_patterns+(uint16_t)j*16;memcpy(out,cell_base,16);memset(text_staging,0,16);
  for(slot=0;slot<4;slot++)if(kind[slot]<3&&x>=col[slot]&&x<col[slot]+2&&y>=top[slot]&&y<top[slot]+rows[slot]){
   read_glyph(slot,x,y);for(row=0;row<16;row+=2){
    lo=glyph[row];hi=glyph[row+1];mask=~(lo|hi);text_staging[row]&=mask;text_staging[row+1]&=mask;
    if(pal==3){out[row]=(out[row]&mask)|lo;out[row+1]=(out[row+1]&mask)|hi;continue;}
    // Three bit masks represent all eight pixels. Only a color-boundary
    // cell needs remapping; ordinary stone cells keep their bitplanes.
    for(v=1;v<4;v++){mask=v==1?(lo&~hi):v==2?(hi&~lo):(lo&hi);mapped=cell_colors[pal*4+v];
     if(mapped==255){if(v&1)text_staging[row]|=mask;if(v&2)text_staging[row+1]|=mask;}
     else {out[row]&=~mask;out[row+1]&=~mask;if(mapped&1)out[row]|=mask;if(mapped&2)out[row+1]|=mask;}
    }
   }ff3_native_service();
  }
  has_extra=any(text_staging);j=slots[i];flags[j]=2;tags[page][j]=key|((uint16_t)pal<<12)|(has_extra?2048:0);signatures[page][j]=sig;
  }
  tags[page][slots[i]]|=16384;
  if(has_extra){
   if(extra_count==24){stone_error=3;return;}if(count+extra_count>=a->span){stone_error=4;return;}
   // Cell count is already known. Write residual patterns and the inactive
   // OAM page directly; a second 384-byte tile scratch buffer is redundant.
   if(!hit){j=extras[i];if(j==255){j=allocate(a->span);if(stone_error)return;extras[i]=j;}memcpy(stone_patterns+(uint16_t)j*16,text_staging,16);flags[j]=2;tags[page][j]=key|512;signatures[page][j]=sig;}
   objects[page][extra_count*4]=y*8+16;objects[page][extra_count*4+1]=x*8+8;
   objects[page][extra_count*4+2]=a->base+page*a->span+extras[i];objects[page][extra_count*4+3]=15;extra_count++;
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
  ff3_resident_base_pattern(out[2],cell_base);memcpy(text_staging,cell_base,16);
  for(slot=0;slot<4;slot++)if(kind[slot]<3&&x>=col[slot]&&x<col[slot]+2&&y>=top[slot]&&y<top[slot]+rows[slot]){
   read_glyph(slot,x,y);for(row=0;row<16;row+=2){mask=~(glyph[row]|glyph[row+1]);text_staging[row]&=mask;text_staging[row+1]&=mask;}
  }
  if(memcmp(cell_base,text_staging,16)){
   if(total==a->span||masked_count[page]==16){stone_error=4;return;}
   v=allocate(a->span);if(stone_error)return;
   n=masked_count[page]++;masked[page][n][0]=out[0];masked[page][n][1]=out[1];masked[page][n][2]=a->base+page*a->span+v;
   memcpy(stone_patterns+(uint16_t)v*16,text_staging,16);flags[v]=2;tags[page][v]=65535;total++;
  }ff3_native_service();
 }

 if(changed){
  for(i=0;i<a->span;){if(flags[i]!=2){i++;continue;}j=i;while(i<a->span&&flags[i]==2&&i-j<8)i++;n=(i-j)*16;at=(uint16_t)j*16;memcpy(text_staging,stone_patterns+at,n);ff3_text_copy(1,0x8000+(uint16_t)(a->base+page*a->span)*16+at,text_staging,n);stone_pattern_bytes+=n;ff3_native_service();}
  for(y=0;y<14;y++)if((dirty[0]|dirty[1])&((uint16_t)1<<y)){
   ff3_resident_base_row(page,y,text_staging);
   for(i=0;i<count;i++)if((keys[i]>>5)==y){x=keys[i]&31;text_staging[x]=a->base+page*a->span+slots[i];text_staging[32+x]=8+((tags[page][slots[i]]>>12)&3);}
   // HDMA accepts aligned 16-byte spans. Publish only the half-row that
   // had or will have stone cells, retaining the other resident owners.
   for(half=0;half<2;half++)if(dirty[half]&((uint16_t)1<<y)){
    at=(page?0x9c00:0x9800)+(uint16_t)y*32+half*16;
    ff3_text_copy(0,at,text_staging+half*16,16);
    ff3_text_copy(1,at,text_staging+32+half*16,16);stone_map_bytes+=32;
   }ff3_native_service();
  }
  memcpy(cached[page],kind,4);memcpy(cached[page]+4,col,4);valid[page]=1;
 }
 // Append after actual party/enemy owners. Blank hidden objects may be
 // reused; no on-screen tile is removed to obtain an OAM slot.
 object_count[page]=extra_count;
 append(page,oam);
}
