#pragma bank 63
#include <string.h>
#include "battle-hit-video.h"
#include "battle-effect-freeze.h"
#include "battle-animation-video.h"
#include "battle-strike-video.h"
#include "battle-party-oam.h"
#include "battle-entry-tail.h"
#include "battle-action-oam.h"
#include "battle-resident-bg.h"
#include "battle-terrain.h"
#include "text-vblank.h"
#include "hit-assets.h"
uint8_t hit_cover[2],hit_error;
static uint8_t active,frame,actor,cover,protected_id,home_x,home_y,saved[4],push,old_page,flash_page,enemy;
static int8_t fit_x;
extern Ff3PartyOam party_state;
extern Ff3EntryTail status_tail;
extern uint8_t __at(0xd600) animation_source[160];
extern uint8_t __at(0xd6a0) animation_base[160];
extern uint8_t __at(0xdc00) party_oam0[160];
extern uint8_t __at(0xdd00) party_oam1[160];
extern volatile uint8_t party_page,party_pending,party_profile,party_work,native_request,native_argument;
extern uint8_t next_page;
void ff3_party_copy(uint8_t bank,const void*source,void*dest,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
void ff3_resident_fix(void) NONBANKED;
static uint8_t first(uint8_t mask){uint8_t i;for(i=0;i<4;i++)if(mask&(128>>i))return i;return 0;}
static void sound(uint8_t v){while(native_request){ff3_native_service();__asm halt __endasm;}native_argument=v&127;native_request=7;}
static void publish(uint8_t page){next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}animation_video_frames++;if(animation_video_probe)animation_video_gate=1;}
void ff3_hit_reset(void) BANKED {active=frame=hit_error=0;}
static uint8_t party_picture(uint8_t damaging,uint8_t covered){uint8_t i,j,*q,*d,page=party_page^1,*out=page?party_oam1:party_oam0;int16_t x,y,lo=255,hi=-255;
 memset(animation_source,240,160);if(!ff3_party_oam(&party_state,animation_source))return 0;
 if(damaging&&frame==4*cover){q=animation_source+actor*24;for(j=0;j<6;j++,q+=4){if(!q[1])continue;x=party_state.battle_type==0x88?(int8_t)q[3]-16:(int16_t)q[3]-80;if(x<lo)lo=x;if(x>hi)hi=x;}
  fit_x=0;if(party_state.battle_type==0x88){if(lo<1)fit_x=1-lo;}else if(hi>151)fit_x=151-hi;
 }
 memcpy(out,animation_base,160);q=animation_source;d=out+32;
 for(i=0;i<4;i++)for(j=0;j<6;j++,q+=4,d+=4){x=party_state.battle_type==0x88?(int8_t)q[3]-16:(int16_t)q[3]-80;y=(int16_t)q[0]-33-(covered&&i==actor?protected_id:i)*4;
  if(damaging&&i==actor)x+=fit_x;
  if(q[1]&&(x<0||x>152||y<0||y>136))return 0;
  d[0]=q[1]?y+16:0;d[1]=x+8;d[2]=q[1];d[3]=(q[2]&3)|((q[2]&64)>>1)|((q[2]&128)>>1);
 }
 if(!ff3_action_oam_finish(out,8,24,0))return 0;publish(page);return 1;
}
uint8_t ff3_hit_video(uint8_t owner) BANKED {uint8_t i,page,*out,body,damaging;uint16_t at,n;const HitFlashAsset*a=hit_flash_assets+party_profile;
 if(owner!=20&&owner!=31)return 2;
 if(effect_signed)return 2;
 if(!active){frame=0;
  if(owner==31){if(animation_state.magic==9)return 1;if(!animation_state.flash_mask||(animation_state.flash_mask&(animation_state.flash_mask-1)))return 2;
   for(enemy=0;enemy<8&&!(animation_state.flash_mask&(128>>enemy));enemy++);
   if(animation_state.flash_palette!=3||resident_scroll)return 2;
   old_page=resident_page;flash_page=old_page^1;party_work=2;
   /* Compile palette-bound cells once, then alternate immutable maps for the
    * eight original waits. UI occupies both pages; terrain owns its prefix. */
   for(at=0;at<704;at+=176){n=at<352?0:1;ff3_party_copy(a->bank,a->maps+(uint16_t)enemy*704+at,text_staging,176);ff3_text_copy(n,(flash_page?0x9c40:0x9840)+at%352,text_staging,176);ff3_native_service();}
   active=31;
  }else{actor=animation_state.actor;if(actor>3||status_tail.jobs[actor]>=22||(status_tail.motion.status[actor]&~0x17))return 2;
   cover=hit_cover[0]!=0;protected_id=first(hit_cover[1]);if(cover){if(first(hit_cover[0])!=actor||protected_id==actor)return 2;for(i=0;i<4;i++)if(status_tail.motion.status[i]||party_state.pose[i]!=2)return 2;}
   home_x=party_state.x[actor];home_y=party_state.y[actor];memcpy(saved,party_state.pose,4);push=strike_critical?16:8;fit_x=0;
   if(!ff3_action_oam_begin(animation_base,8,24)){hit_error=1;return 3;}party_work=2;
   ff3_text_rom_copy(0,0x8390,59,hit_job_tiles+(uint16_t)status_tail.jobs[actor]*96,96);
   if(cover){party_state.x[actor]=party_state.x[protected_id]-24;party_state.y[actor]=party_state.y[protected_id];}
   active=20;
  }
 }
 party_work=2;ff3_native_service();
 if(active==31){if(frame==8){active=0;ff3_resident_fix();party_work=0;return 1;}
  page=party_page^1;out=page?party_oam1:party_oam0;memcpy(out,animation_base,160);memset(animation_source,240,160);
  if(!(frame&1)){ff3_party_copy(a->bank,a->objects+(uint16_t)enemy*64,animation_source,64);memcpy(out,animation_source,32);memcpy(out+128,animation_source+32,32);ff3_party_copy(a->bank,a->attributes+(uint16_t)enemy*64,animation_source,64);resident_page=flash_page;}
  else{ff3_party_copy(a->bank,a->normal,animation_source,64);resident_page=old_page;}
  /* The whole page must fit, including residual colors and all four actors. */
  if(!ff3_action_oam_begin(out,0,40)||!ff3_action_oam_finish(out,0,40,0)){hit_error=2;goto fault;}
  ff3_terrain_prepare(resident_page);publish(page);frame++;goto pending;
 }
 body=frame-4*cover;
 if(cover&&frame<4){if(!frame){if(!party_picture(0,1)){hit_error=3;goto fault;}}else publish(party_page);frame++;goto pending;}
 if(!(animation_state.hits[0]|animation_state.hits[1]))body=20;
 if(body<20){damaging=body<18;
  if(!(body&1)){if(!body)sound(strike_critical?0xc6:0xb0);
   party_state.x[actor]=(cover?party_state.x[protected_id]-24:home_x)+(damaging?push+((body>>1)&1):0);
   if(damaging)party_state.pose[actor]=(status_tail.motion.status[actor]&5)?15:4;else memcpy(party_state.pose,saved,4);
   if(!party_picture(damaging,cover)){hit_error=3;goto fault;}
  }else publish(party_page);
  frame++;goto pending;
 }
 if(cover){i=(animation_state.hits[0]|animation_state.hits[1])?frame-24:frame-4;
  if(i<4){if(!i){party_state.x[actor]=home_x;party_state.y[actor]=home_y;memcpy(party_state.pose,saved,4);if(!party_picture(0,0)){hit_error=3;goto fault;}}else publish(party_page);frame++;goto pending;}
 }
 active=0;party_work=0;return 1;
 pending:party_work=0;return 0;
 fault:party_work=0;return 3;
}
