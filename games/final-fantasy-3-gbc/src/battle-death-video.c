#pragma bank 124
#include <string.h>
#include "battle-death-video.h"
#include "battle-animation-video.h"
#include "battle-resident-bg.h"
#include "battle-effect-freeze.h"
#include "battle-live-command.h"
#include "battle-terrain.h"
#include "battle-workspace.h"
#include "battle-cell-pool.h"
#include "text-vblank.h"
#include "memory.h"
#include "platform.h"
#include "death-assets.h"
#include "resident-bg-assets.h"
#include "hit-assets.h"
uint8_t resident_dead,death_video_error;
volatile uint8_t death_video_picture;
volatile uint16_t death_prepare_max,death_preparations;
volatile uint32_t death_prepare_ticks;
static uint8_t active;
/* After command/status commit, before another animation owner. Persistent
 * removed mask is in battle DATA; settled residual OAM is WRAM6[0,128).
 * Both COW pools live above immutable patterns AND both terrain pages. */
#define cell ((uint8_t*)0xd600)
#define erase ((uint8_t*)0xd628)
#define glyph ((uint8_t*)0xd630)
#define residual ((uint8_t*)0xd740)
#define flash_oam ((uint8_t*)0xd780)
#define previous_x ((uint8_t*)0xd7c0)
#define death ((Ff3Death*)0xd800)
#define map battle_workspace.map
extern uint8_t __at(0xd6a0) animation_base[160];
extern uint8_t __at(0xdc00) party_oam0[160];
extern uint8_t __at(0xdd00) party_oam1[160];
extern volatile uint8_t party_profile,party_page,party_pending,party_work,native_request,native_argument;
extern uint8_t next_page;
void ff3_native_service(void) NONBANKED;
void ff3_party_copy(uint8_t bank,const void*src,void*dst,uint16_t n) NONBANKED;
void ff3_resident_fix(void) NONBANKED;
static uint8_t pattern(const ResidentBgAsset*a,uint8_t id){uint8_t kind;
 if(!id)return 0;ff3_party_copy(a->bank,a->patterns+(uint16_t)id*16,glyph,16);
 kind=ff3_cell_mask(glyph,erase);if(!kind)return id;if(kind==1)return 0;
 id=ff3_cell_pool_tile(glyph);if(cell_pool_error)death_video_error=1;return id;
}
/* Like the existing terrain stamp kernel: stay in fixed ROM while selecting
 * the immutable lookup bank once, rather than switching for every byte. */
static void mask_cell(const Ff3Death*d,uint8_t mask,uint8_t back) NONBANKED {uint8_t saved=CURRENT_BANK,p,k,owner,y,bits,j;uint16_t at;
 memset(erase,0,8);SWITCH_ROM(123);
 for(p=0;p<2;p++){k=6+p*17;owner=cell[k];if(!owner||!((resident_dead|(d?mask:0))&owner))continue;
  for(y=0;y<8;y++){bits=cell[k+9+y];if(!bits)continue;
   if(resident_dead&owner)erase[y]|=bits;
   else {j=cell[k+1+y];at=((uint16_t)d->x[(j-48)>>3]*8+(j&7))*20+cell[0]+(back?5120u:0u);erase[y]|=bits&~death_stamps[at];}
  }
 }SWITCH_ROM(saved);
}
static uint8_t changed(void){const DeathAsset*a=death_assets+party_profile-4;uint8_t slot,row,dirty=0,cursor,old,lo,hi;
 for(slot=0;slot<8;slot++)if((animation_state.mask&~resident_dead)&(128>>slot)){
  ff3_party_copy(a->bank,a->bounds+(uint16_t)slot*26,cell,26);
  for(row=0;row<13;row++){lo=cell[row*2];hi=cell[row*2+1];if(lo==255)continue;cursor=death->x[row];old=previous_x[row];
   if(!death->frame){if(a->back?lo<=cursor+3:hi+3>=cursor)dirty=1;}
   else if(cursor!=old){if(a->back?(old<=hi&&cursor+3>=lo):(old>=lo&&cursor<=hi+3))dirty=1;}
  }
 }memcpy(previous_x,death->x,13);return dirty;
}
static uint8_t next_cell(uint8_t bank,const uint8_t*p,uint8_t i,uint8_t count,uint8_t mask) NONBANKED {uint8_t saved=CURRENT_BANK;
 p+=(uint16_t)i*40;SWITCH_ROM(bank);while(i<count&&!((p[6]|p[23])&mask)){i++;p+=40;}SWITCH_ROM(saved);return i;
}
uint8_t ff3_enemy_build(uint8_t page,uint8_t flash,const Ff3Death*d,uint8_t mask) BANKED {
 const DeathAsset*a;const ResidentBgAsset*b;const HitFlashAsset*h;uint8_t i,j,bits,id,n=0,affected;uint16_t at,address,begin=ff3_clock_now(),elapsed;
 if(party_profile<4||party_profile>=DEATH_PROFILES+4||page>1||flash>8||resident_scroll||effect_signed){death_video_error=2;return 0;}
 a=death_assets+party_profile-4;b=resident_bg_assets+party_profile;h=hit_flash_assets+party_profile;
 affected=resident_dead|(d?mask:0);
 /* Original dead_mask also contains absent slots. Count only owners with
  * actual cell dots, without altering the source death/removal mask. */
 i=affected&a->present;
 if(!ff3_cell_pool_begin(a->pool+page*a->half,a->half,(i&(i-1))!=0)){death_video_error=1;return 0;}
 memset(residual,0,64);
 /* Reuse the spatial base in bulk. Visit only cells owned by removed or
  * wiping slots; unrelated actors need no glyph or mask work. */
 if(flash){for(at=0;at<704;at+=176){ff3_party_copy(h->bank,h->maps+(uint16_t)(flash-1)*704+at,map+at,176);ff3_native_service();}ff3_party_copy(h->bank,h->objects+(uint16_t)(flash-1)*64,residual,64);}
 else{
  for(i=0;i<11;i++){ff3_party_copy(b->bank,b->maps+(uint16_t)i*56,map+(uint16_t)i*32,32);ff3_party_copy(b->bank,b->maps+616+(uint16_t)i*56,map+352+(uint16_t)i*32,32);ff3_native_service();}
  if(b->count>8){death_video_error=4;return 0;}ff3_party_copy(b->bank,b->objects,cell,(uint16_t)b->count*5);
  for(i=0;i<b->count;i++){j=i*5;if(cell[j+1]||cell[j]>=160)continue;residual[n*4]=cell[j+2]+16;residual[n*4+1]=cell[j]+8;residual[n*4+2]=cell[j+3];residual[n*4+3]=cell[j+4];n++;}
 }
 for(i=next_cell(a->bank,a->cells,0,a->count,affected);i<a->count;i=next_cell(a->bank,a->cells,i+1,a->count,affected)){
  ff3_party_copy(a->bank,a->cells+(uint16_t)i*40,cell,40);mask_cell(d,mask,a->back);bits=0;for(j=0;j<8;j++)bits|=erase[j];
  if(!bits)continue;at=(uint16_t)cell[1]*32+cell[0];map[at]=pattern(b,map[at]);
  for(j=0;j<16;j++)if(residual[j*4]==32+cell[1]*8&&residual[j*4+1]==8+cell[0]*8){id=pattern(b,residual[j*4+2]);if(id)residual[j*4+2]=id;else residual[j*4]=0;break;}
  if(death_video_error)return 0;ff3_native_service();
 }
 if(!ff3_cell_pool_finish()){death_video_error=1;return 0;}address=page?0x9c40:0x9840;
 for(at=0;at<704;at+=176){memcpy(text_staging,map+at,176);ff3_text_copy(at>=352,address+at%352,text_staging,176);ff3_native_service();}
 if(!flash&&!d){if(n>8){death_video_error=4;return 0;}if(!ff3_wram_copy(6,(uint16_t)page*64,residual,64,1)){death_video_error=5;return 0;}}
 elapsed=ff3_clock_now()-begin;death_prepare_ticks+=elapsed;if(elapsed>death_prepare_max)death_prepare_max=elapsed;death_preparations++;return 1;
}
void ff3_enemy_saved(uint8_t page,uint8_t*out) BANKED {if(!ff3_wram_copy(6,(uint16_t)page*64,out,64,0))death_video_error=5;}
void ff3_death_video_reset(void) BANKED {active=resident_dead=death_video_error=0;death_video_picture=255;death_prepare_max=death_preparations=0;death_prepare_ticks=0;ff3_cell_pool_reset();}
static void publish(uint8_t page){next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}animation_video_frames++;if(animation_video_probe)animation_video_gate=1;}
uint8_t ff3_death_video(uint8_t owner) BANKED {uint8_t page,bg,*out;
 if(owner!=10&&owner!=13)return 2;if(death_video_error)return 3;
 if(!active){
  if(effect_signed||!command_phase||animation_state.layout==9||party_profile<4||party_profile>=DEATH_PROFILES+4)return 2;
  if(!ff3_live_command_remove(animation_state.mask,owner==10)){death_video_error=6;return 3;}
  memset(death,0,sizeof(*death));death->back=death_assets[party_profile-4].back;
  if(!ff3_death_start(death)){death_video_error=7;return 3;}memcpy(previous_x,death->x,13);active=1;effect_freeze_cache_valid=0;
  while(native_request){ff3_native_service();__asm halt __endasm;}native_argument=0x31;native_request=7;
 }
 party_work=2;
 if(death->done){resident_dead|=animation_state.mask;
  /* The last original picture already erased every selected dot. Keep its
   * map and COW pool as the canonical survivor surface, like BCCC/BB44. */
  out=party_page?party_oam1:party_oam0;memset(residual,0,64);memcpy(residual,out+128,32);
  if(!ff3_wram_copy(6,(uint16_t)resident_page*64,residual,64,1)){death_video_error=5;goto fault;}
  active=0;ff3_resident_retain();party_work=0;return 1;
 }
 if(death->wait==2&&changed()){bg=resident_page^1;if(!ff3_enemy_build(bg,0,death,animation_state.mask))goto fault;
  page=party_page^1;out=page?party_oam1:party_oam0;memcpy(out,animation_base,160);memset(out,0,32);memcpy(out+128,residual,32);resident_page=bg;ff3_terrain_prepare(bg);death_video_picture=death->frame;publish(page);
 }else {death_video_picture=death->frame;
  /* BB31 removes temporary numeral objects even before the stencil reaches
   * an enemy. Reusing the unchanged BG must not reuse those old objects. */
  if(!death->frame&&death->wait==2){page=party_page^1;out=page?party_oam1:party_oam0;memcpy(out,animation_base,160);publish(page);}
  else publish(party_page);
 }
 if(!ff3_death_ack(death,death->ticket)){death_video_error=7;goto fault;}party_work=0;return 0;
 fault:party_work=0;return 3;
}
