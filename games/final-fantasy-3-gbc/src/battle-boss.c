#pragma bank 10
#include <gb/cgb.h>
#include <string.h>
#include "battle-boss.h"
#include "boss-assets.h"
#include "battle-workspace.h"
#include "text-vblank.h"
#include "platform.h"
void ff3_party_copy(uint8_t bank,const void*source,void*dest,uint16_t n) NONBANKED;
void ff3_party_palette(uint8_t bg,uint8_t first,uint8_t count,const uint8_t*data) NONBANKED;
void ff3_native_service(void) NONBANKED;
uint8_t boss_error,boss_started;
uint32_t boss_pattern_bytes,boss_map_bytes;
uint16_t boss_steps;
static uint8_t profile,active,pending,chunk,shift,have_page,initialized,slots[2][136];
static uint16_t difference;
static uint16_t allocation;
static uint8_t batch_first,batch_count;
#define scratch battle_workspace.boss
void ff3_boss_reset(uint8_t p) BANKED {
 const BossAsset*a=boss_assets+p;profile=p;active=pending=boss_started=have_page=initialized=0;difference=0x7ff;memset(slots,0,sizeof(slots));
 ff3_party_copy(a->bank,a->palette+32,text_staging,32);ff3_party_palette(1,4,4,text_staging);
}
uint8_t ff3_boss_queue(uint8_t g,uint8_t block,uint8_t s) BANKED {
 const BossAsset*a=boss_assets+profile;
 if(pending||g!=a->graphic||block>=a->chunks||s>7){boss_error=1;return 0;}
 chunk=block;shift=s;pending=boss_started=1;return 1;
}
static uint8_t allocate(const BossAsset*a){
 while(allocation<256){uint8_t i=allocation++;if(!scratch.used[i]){scratch.used[i]=1;return i;}}boss_error=2;return 0;
}
static uint8_t compose(const BossAsset*a,uint8_t id) NONBANKED {
 uint8_t y,n,s,lo,hi,mask,v,c,dst,route[8],saved=CURRENT_BANK,bank=a->bank,lut_bank=a->lut_bank;uint16_t off;const uint8_t*raw=a->raw,*luts=a->luts,*p,*lut;
 ff3_party_copy(a->program_bank,a->program+(uint16_t)id*72,scratch.bindings,72);
 ff3_party_copy(a->bank,a->routes+(uint16_t)id*8,route,8);memset(scratch.tiles,0,32);SWITCH_ROM(bank);
 /* Original alternating source-byte shift, then immutable spatial selectors.
  * Palette routing is applied to whole bitplanes, not individual pixels. */
 for(y=0;y<8;y++){
  p=scratch.bindings+y*9;n=*p++;
  while(n--){off=p[0]|((uint16_t)p[1]<<8);if((off>>6)<=chunk){
   SWITCH_ROM(bank);lo=raw[off];hi=raw[off+8];s=(off>>6)==chunk?shift:0;
   if(off&1){lo<<=s;hi<<=s;}else{lo>>=s;hi>>=s;}
   lut=luts+((uint16_t)p[2]<<8);SWITCH_ROM(lut_bank);lo=lut[lo];hi=lut[hi];
   for(c=1;c<4;c++){mask=c==1?(lo&~hi):c==2?(hi&~lo):(lo&hi);if(!mask)continue;
    v=route[p[3]*4+c];if(v==255){boss_error=3;SWITCH_ROM(saved);return 0;}
    dst=y*2+((v&128)?16:0);if(v&1)scratch.tiles[dst]|=mask;if(v&2)scratch.tiles[dst+1]|=mask;
   }
  }p+=4;}
  if(y&1)ff3_native_service();
 }SWITCH_ROM(saved);return 1;
}
static void flush(void){if(batch_count){ff3_text_copy(1,0x8000+(uint16_t)batch_first*16,text_staging,(uint16_t)batch_count*16);boss_pattern_bytes+=(uint16_t)batch_count*16;batch_count=0;ff3_native_service();}}
static void append(uint8_t tile,const uint8_t*data){if(batch_count&&(tile!=batch_first+batch_count||batch_count==16))flush();if(!batch_count)batch_first=tile;memcpy(text_staging+(uint16_t)batch_count*16,data,16);batch_count++;}
void ff3_boss_prepare(uint8_t page,uint8_t*out) BANKED {
 const BossAsset*a=boss_assets+profile;uint8_t i,id,d[5],tile,count=a->cells+a->residuals,row,rows[12];uint16_t begin,end,k,changed=0,dirty,base;
 if(!boss_started)return;if(page>1||(page==active&&have_page)){boss_error=4;return;}
 memcpy(slots[page],slots[active],count);memset(scratch.used,0,256);
 for(i=0;i<count;i++)scratch.used[slots[active][i]]=1;
 allocation=a->base;batch_count=0;
 if(pending){
  ff3_party_copy(a->bank,a->index+(uint16_t)chunk*2,d,4);begin=d[0]|((uint16_t)d[1]<<8);end=d[2]|((uint16_t)d[3]<<8);
  for(k=begin;k<end;k++){
   ff3_party_copy(a->bank,a->list+k,&id,1);ff3_party_copy(a->bank,a->cells_data+(uint16_t)id*5,d,5);
   if(!compose(a,id))return;changed|=(uint16_t)1<<(d[1]-2);
   tile=allocate(a);if(boss_error)return;slots[page][id]=tile;append(tile,scratch.tiles);ff3_native_service();
   if(d[4]!=255){tile=allocate(a);if(boss_error)return;slots[page][a->cells+d[4]]=tile;append(tile,scratch.tiles+16);ff3_native_service();}
  }flush();pending=0;boss_steps++;
 }
 dirty=(initialized&(1<<page))?(difference|changed):0x7ff;initialized|=1<<page;base=page?0x9c40:0x9840;
 ff3_party_copy(a->bank,a->rows,rows,12);
 for(row=0;row<11;row++)if(dirty&((uint16_t)1<<row)){
  k=(uint16_t)row*32;memset(battle_workspace.map+k,0,32);memset(battle_workspace.map+352+k,8,32);
  for(i=rows[row];i<rows[row+1];i++){ff3_party_copy(a->bank,a->cells_data+(uint16_t)i*5,d,5);battle_workspace.map[k+d[0]]=slots[page][i];battle_workspace.map[352+k+d[0]]=8+d[2];}ff3_native_service();
 }
 /* The cell scratch is dead now. Gather adjacent dirty rows into bounded
  * descriptors; no retained page state lives in this shared workspace. */
 for(row=0;row<11;){if(!(dirty&((uint16_t)1<<row))){row++;continue;}i=row;while(row<11&&row-i<4&&(dirty&((uint16_t)1<<row)))row++;
  k=(uint16_t)i*32;end=(uint16_t)(row-i)*32;memcpy(text_staging,battle_workspace.map+k,end);ff3_text_copy(0,base+k,text_staging,end);ff3_native_service();memcpy(text_staging,battle_workspace.map+352+k,end);ff3_text_copy(1,base+k,text_staging,end);ff3_native_service();boss_map_bytes+=end*2;
 }
 /* Keep the old page/patterns untouched until VBlank publishes this page.
  * Its next use repairs exactly the rows that now differ. */
 difference=changed;active=page;have_page=1;
 if(a->residuals>8){boss_error=5;return;}
 ff3_party_copy(a->bank,a->objects,out+96,a->residuals*4);
 for(i=0;i<a->residuals;i++)out[98+i*4]=slots[page][a->cells+out[98+i*4]];
}
