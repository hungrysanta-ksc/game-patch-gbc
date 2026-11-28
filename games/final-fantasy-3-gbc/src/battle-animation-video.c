#pragma bank 49
#include <string.h>
#include "battle-animation-video.h"
#include "battle-numerals.h"
#include "battle-party-oam.h"
#include "battle-effect-freeze.h"
#include "battle-strike-video.h"
#include "battle-hit-video.h"
#include "battle-magic-video.h"
#include "effect-assets.h"
#include "text-vblank.h"
#include "platform.h"
#ifdef FF3_SCENE_LAYOUT
#include "battle-live-command.h"
#include "battle-death-video.h"
#include "battle-live-party.h"
#endif
Ff3Animation animation_state;
volatile uint8_t animation_video_error,animation_video_owner;
volatile uint16_t animation_video_frames;
volatile uint8_t animation_video_probe,animation_video_gate;
static Ff3Numerals numbers;
/* Exclusive action owner; neither entry nor stone preparation may run here. */
uint8_t __at(0xd600) animation_source[160];
uint8_t __at(0xd6a0) animation_base[160];
uint8_t __at(0xd740) animation_lines[144];
uint8_t __at(0xd7d0) animation_linework[144];
static uint8_t active,number_active,resources,anchors[16];
static uint8_t number_template[160],group_first[8],group_size[8];
static int16_t group_adjust[8];
extern volatile uint8_t party_profile,party_page,party_pending,party_work;
extern uint8_t next_page;
extern uint8_t __at(0xdc00) party_oam0[160];
extern uint8_t __at(0xdd00) party_oam1[160];
extern Ff3PartyOam party_state;
void ff3_party_copy(uint8_t bank,const void*source,void*dest,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
static void lines(void){uint8_t i,j,y;memset(animation_lines,0,144);
 for(i=8;i<40;i++)if(animation_base[i*4])for(j=0;j<8;j++){y=animation_base[i*4]-16+j;if(y<144)animation_lines[y]++;}}
static void capture(void){if(party_page)memcpy(animation_base,party_oam1,160);else memcpy(animation_base,party_oam0,160);memset(animation_base,0,32);lines();}
/* Publish all nonblank source numeral glyphs. Capacity failure is explicit,
 * before changing the visible page; dense fallback is a separate owner. */
static uint8_t present(uint8_t commit){uint8_t i,j,target=0,count=0,page=party_page^1,*out=page?party_oam1:party_oam0,*p,x,y,t;int16_t dx,dy,left,right;uint8_t slot;
 if(number_active){memcpy(out,number_template,160);memcpy(animation_linework,animation_lines,144);
  for(i=0;i<numbers.count/4;i++)if(group_size[i]){dy=(int16_t)animation_source[i*16]+group_adjust[i];if(dy<0)dy=0;if(dy>136)dy=136;y=dy;
   p=out+group_first[i]*4;for(j=0;j<group_size[i];j++,p+=4)p[0]=y+16;
   for(j=0;j<8;j++){animation_linework[y+j]+=group_size[i];if(animation_linework[y+j]>10)return 0;}
  }goto publish;
 }
 memcpy(out,animation_base,160);memcpy(animation_linework,animation_lines,144);
 for(i=0;i<numbers.count/4;i++){
  if(numbers.enemy){while(target<8&&numbers.types[target]==255)target++;slot=target++;if(slot>=8)return 0;}else slot=i;
  p=animation_source+i*16;
  if(numbers.enemy){dx=(int16_t)anchors[slot*2]-p[3];dy=(int16_t)anchors[slot*2+1]-(numbers.bottom[slot]+1);}
  else{dx=numbers.back?-16:-80;dy=10+slot*24-(44+slot*28);
   /* Keep the complete visible numeral group inside V6. In a back attack,
    * a rear-row four-digit group starts 2px left of the smaller viewport. */
   left=255;right=-255;for(j=0;j<4;j++)if(p[j*4+1]&&p[j*4]<239){int16_t px=(int16_t)p[j*4+3]+dx;if(px<left)left=px;if(px>right)right=px;}
   if(left<0)dx-=left;else if(right>152)dx-=right-152;
  }
  group_adjust[i]=dy+1;group_first[i]=count;
  /* Clamp a whole glyph vertically, never discard the clipped rows. */
  dy+=p[0]+1;if(dy<0)dy=0;if(dy>136)dy=136;y=(uint8_t)dy+16;
  for(j=0;j<4;j++,p+=4){t=p[1];if(!t||p[0]>=239)continue;if(t<0x56||t>0x76)return 0;
   if(count==(effect_signed?32:8))return 0;x=(uint8_t)(p[3]+dx);if(x>152)return 0;
   out[count*4]=y;out[count*4+1]=x+8;out[count*4+2]=223+t-0x56;out[count*4+3]=3;count++;
  }
  group_size[i]=count-group_first[i];
 }
 for(i=0;i<count;i++)for(j=0;j<8;j++){y=out[i*4]-16+j;if(++animation_linework[y]>10)return 0;}
 if(!commit)return 1;
 memcpy(number_template,out,160);
 publish:
 next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}animation_video_frames++;if(animation_video_probe)animation_video_gate=1;return 1;
}
void ff3_animation_video_reset(void) BANKED {active=number_active=resources=0;animation_video_error=animation_video_owner=animation_video_gate=0;animation_video_frames=0;ff3_strike_reset();ff3_hit_reset();ff3_magic_reset();}
uint8_t ff3_animation_video(uint8_t op,uint8_t effect,uint8_t result) BANKED {(void)result;
 if(animation_video_error)return 3;
 if(animation_video_gate)return 0;
 /* 13/14 own status commit before death. Never replace it by effect 22. */
 if(op!=11&&op!=12){
#ifdef FF3_SCENE_LAYOUT
  if((op!=13&&op!=14)||!command_phase)return 2;
  if(!active&&!ff3_live_command_commit(op==14)){animation_video_error=7;return 3;}
  effect=22;
#else
  return 2;
#endif
 }
 if(!active){memset((uint8_t*)&animation_state+88,0,sizeof(animation_state)-88);animation_state.effect=op==12?23:effect;
  if(!ff3_animation_start(&animation_state)){animation_video_error=1;return 3;}active=1;capture();
 }
 if(animation_state.done){active=0;return 1;}
 animation_video_owner=animation_state.request;
#ifdef FF3_SCENE_LAYOUT
 if(animation_video_owner==7){if(!ff3_live_party_refresh(animation_state.status)){animation_video_error=8;return 3;}
  if(!ff3_animation_ack(&animation_state,animation_state.ticket)){animation_video_error=6;return 3;}capture();resources=0;return 0;}
 if(animation_video_owner==10||animation_video_owner==13){uint8_t r=ff3_death_video(animation_video_owner);if(r==1){if(!ff3_animation_ack(&animation_state,animation_state.ticket)){animation_video_error=6;return 3;}capture();resources=0;return 0;}return r;}
#endif
 if(animation_video_owner==18){uint8_t r=ff3_strike_video();if(r==1){if(!ff3_animation_ack(&animation_state,animation_state.ticket)){animation_video_error=6;return 3;}capture();resources=0;return 0;}return r;}
 if(animation_video_owner==20||animation_video_owner==31){uint8_t r=ff3_hit_video(animation_video_owner);if(r==1){if(!ff3_animation_ack(&animation_state,animation_state.ticket)){animation_video_error=6;return 3;}capture();resources=0;return 0;}return r;}
 if(animation_video_owner==29){uint8_t r=ff3_magic_video();if(r==1){if(!ff3_animation_ack(&animation_state,animation_state.ticket)){animation_video_error=6;return 3;}capture();resources=0;return 0;}return r;}
 if(animation_video_owner!=28)return 2;
 party_work=2;ff3_native_service();
 if(!number_active){
  ff3_party_copy(50,effect_seeds+(uint16_t)party_profile*96,&numbers,96);memcpy(numbers.values,animation_state.numbers,16);numbers.enemy=animation_state.target_enemy;
  memcpy(numbers.x,party_state.x,4);memcpy(numbers.y,party_state.y,4);ff3_party_copy(50,effect_anchors+(uint16_t)party_profile*16,anchors,16);
  if(!ff3_numerals_start(&numbers,animation_source)){animation_video_error=2;goto fault;}
  if(numbers.done){if(!ff3_animation_ack(&animation_state,animation_state.ticket)){animation_video_error=3;goto fault;}party_work=0;return 0;}
  if(!present(0)){if(!effect_signed&&ff3_effect_freeze())lines();if(!effect_signed||!present(0)){animation_video_error=4;goto fault;}}
  if(!resources){ff3_text_rom_copy(0,0x8df0,50,effect_tiles,528);ff3_party_copy(50,effect_palette,text_staging,8);ff3_text_palette_range(0,3,1,text_staging);resources=1;}
  if(!present(1)){animation_video_error=4;goto fault;}number_active=1;party_work=0;return 0;
 }
 /* AD91/F8C5 waits for one NMI after preparing OAM. Prepare the next
  * picture while this one is visible; present() owns the next VBlank.
  * A second foreground timer wait here would double the frame period. */
 if(!ff3_numerals_ack(&numbers,numbers.ticket,animation_source)){animation_video_error=5;goto fault;}
 if(numbers.done){number_active=0;if(!ff3_animation_ack(&animation_state,animation_state.ticket)){animation_video_error=6;goto fault;}}
 else{if(!present(1)){animation_video_error=4;goto fault;}}
 party_work=0;return 0;
 fault:party_work=0;return 3;
}
