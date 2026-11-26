#pragma bank 55
#include <string.h>
#include "battle-animation-video.h"
#include "battle-strike-video.h"
#include "battle-bow-video.h"
#include "battle-motion-sprites.h"
#include "battle-action-oam.h"
#include "battle-party-oam.h"
#include "battle-entry.h"
#include "battle-entry-tail.h"
#include "text-vblank.h"
#include "strike-assets.h"
uint8_t strike_weapons[2]={30,0},strike_error;
uint8_t strike_critical;
Ff3BattleRngCursor battle_rng_cursor;
uint8_t strike_rng_ready;
static uint8_t hit_point[2],bow_pair;
uint16_t strike_prepares,strike_reuses;
static uint8_t center[4],raw_actor[24];
uint8_t strike_picture; /* Existing picture-valid state, also observable without reading stale scratch. */
static uint8_t last_weapon,last_slice,last_x,last_y,last_pose,last_hand;
static uint8_t phase,actor,hand,frame,left,hits[2],kind[2],home,saved[4],pose;
extern Ff3PartyOam party_state;
extern Ff3EntryDisplay party_motion;
extern Ff3EntryTail status_tail;
extern uint8_t __at(0xd600) animation_source[160];
extern uint8_t __at(0xd6a0) animation_base[160];
extern uint8_t __at(0xd740) animation_lines[144];
extern uint8_t __at(0xdc00) party_oam0[160];
extern uint8_t __at(0xdd00) party_oam1[160];
extern volatile uint8_t party_page,party_pending,party_profile,party_work,native_request,native_argument;
extern uint8_t next_page;
void ff3_party_copy(uint8_t bank,const void*source,void*dest,uint16_t n) NONBANKED;
void ff3_native_service(void) NONBANKED;
/* 33/A389..A38B posts $B6 and immediately prepares the next picture.
 * Producer acknowledgement is not playback synchronization. Preserve an
 * occupied mailbox, but do not stall the caller after posting a new request;
 * bounded rendering checkpoints continue servicing the same timed queue. */
static void sound(uint8_t v){while(native_request){ff3_native_service();__asm halt __endasm;}native_argument=v&127;native_request=v==255?8:7;}
/* GBC projection is separate from the original actor/weapon and hit owners.
 * Preserve raw OAM order and the existing global-index audio checkpoints. */
static uint8_t project(uint8_t*out,uint8_t n,uint8_t first,uint8_t end,int16_t dx,int16_t dy){
 uint8_t i,a,*dst=out+n*4;const uint8_t*q=animation_source+first*4;int16_t x,y;
 for(i=first;i<end;i++,q+=4){
  if(!(i&7))ff3_native_service();if(!q[1])continue;
  x=(int16_t)q[3]+dx;y=(int16_t)q[0]+dy;
  if(n==40||x<0||x>152||y<0||y>136)return 255;
  a=q[2];*dst++=y+16;*dst++=x+8;*dst++=q[1];*dst++=(a&3)|((a&64)>>1)|((a&128)>>1);n++;
 }return n;
}
static uint8_t movement(uint8_t*out){uint8_t i,x,y,a,*dst;const uint8_t*q;
  memcpy(out,animation_base,160);dst=out+32+actor*24;q=raw_actor;
  for(i=0;i<6;i++,q+=4){x=q[3]-(party_state.battle_type==0x88?8:72);y=q[0]-17-actor*4;a=q[2];
   *dst++=(!x||x>=168||y<=8||y>=160)?0:y;*dst++=x;*dst++=q[1];*dst++=(a&3)|((a&64)>>1)|((a&128)>>1);
  }
  return ff3_action_oam_finish(out,8+actor*6,6,0);
}
static uint8_t publish(uint8_t weapon,uint8_t slice){uint8_t n=0,limit=22,page=party_page^1,*out=page?party_oam1:party_oam0,x,y,reverse;int16_t dx,dy;
 /* Identical source state still owns a source wait and VBlank publication.
  * Keep the current immutable shadow; never skip a frame or recompose it. */
 if(weapon!=255&&kind[hand]!=0&&kind[hand]!=9&&strike_picture&&last_weapon==weapon&&last_slice==slice&&last_x==party_state.x[actor]&&last_y==party_state.y[actor]&&last_pose==party_state.pose[actor]&&last_hand==hand){page=party_page;strike_reuses++;goto ready;}
 strike_prepares++;
 if(!ff3_party_actor_oam(&party_state,actor,raw_actor)){strike_error=2;return 0;}
 if(weapon!=255){
  /* A05E clears attack scratch, not the independent movement shadow. */
  memset(animation_source,240,160);
  /* A1BE/A1C8: harp reverses the usual actor/weapon OAM ordering. */
  reverse=(kind[hand]==0||kind[hand]==9)?0:hand^(kind[hand]==4);
  memcpy(animation_source+(reverse?16:0),raw_actor,24);
  if(kind[hand]==0||kind[hand]==9){if(!ff3_motion_fist(party_state.x[actor],party_state.y[actor],hand,party_state.battle_type==0x88,party_state.palette[actor]|party_state.override[actor],&battle_rng_cursor,animation_source+24)){strike_error=3;return 0;}}
  else if(!ff3_motion_sprite(weapon,party_state.x[actor],party_state.y[actor],0,party_state.battle_type==0x88,3,animation_source+(reverse?0:24))){strike_error=3;return 0;}
  if(slice!=255){
   if(kind[hand]==0||kind[hand]==9){limit=14;if(!ff3_motion_claw_hit(slice,center[0],center[1],hand,party_state.battle_type==0x88,&battle_rng_cursor,hit_point,animation_source+40)){strike_error=3;return 0;}}
   else if(kind[hand]!=1){limit=14;if(!ff3_motion_impact(slice,center[0],center[1],hand,party_state.battle_type==0x88,&battle_rng_cursor,hit_point,animation_source+40)){strike_error=3;return 0;}}
   else if(!ff3_motion_slice(slice,center[0],center[1],hand,party_state.battle_type==0x88,animation_source+40)){strike_error=3;return 0;}
  }
  n=project(out,0,0,10,party_state.battle_type==0x88?-16:-80,-33-actor*4);
  if(n==255){strike_error=4;return 0;}
  if(slice!=255){
   if(kind[hand]!=1){x=((uint8_t)(hit_point[0]-center[0])*7u)>>3;y=((uint8_t)(hit_point[1]-center[1])*7u)>>3;
    dx=(int16_t)center[2]+(party_state.battle_type==0x88?-(int16_t)x:x)-(party_state.battle_type==0x88?255-hit_point[0]:hit_point[0]);dy=(int16_t)center[3]+y-hit_point[1]+1;
   }else{dx=(int16_t)center[2]-(party_state.battle_type==0x88?255-center[0]:center[0]);dy=(int16_t)center[3]-center[1]+1;}
   n=project(out,n,10,limit,dx,dy);if(n==255){strike_error=4;return 0;}
  }
  if(!ff3_action_oam_finish(out,0,n,1)){strike_error=5;return 0;}
 }else{
  if(!movement(out)){strike_error=5;return 0;}
 }
 strike_picture=weapon!=255;last_weapon=weapon;last_slice=slice;last_x=party_state.x[actor];last_y=party_state.y[actor];last_pose=party_state.pose[actor];last_hand=hand;
 ready:next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}animation_video_frames++;if(animation_video_probe)animation_video_gate=1;return 1;
}
void ff3_strike_reset(void) BANKED {phase=strike_error=strike_picture=0;strike_prepares=strike_reuses=0;}
/* The source owner completes only supported weapon kinds. Other bodies
 * remain pending before changing party/resource state, never successful no-ops. */
uint8_t ff3_strike_video(void) BANKED {uint8_t i,w,s,page,*out;
 if(!phase){
  if(strike_critical||animation_state.actor>=4||!animation_state.target_enemy||animation_state.target>=8)return 2;
  for(i=0;i<2;i++){if(strike_weapons[i]>=88)return 2;ff3_party_copy(53,strike_props+strike_weapons[i]*3,kind+i,1);}
  bow_pair=(kind[0]==3&&kind[1]==8)||(kind[0]==8&&kind[1]==3);
  for(i=0;i<2;i++)if(!bow_pair&&kind[i]>2&&kind[i]!=4&&kind[i]!=9)return 2;
  if((kind[0]>1||kind[1]>1||(!kind[0]&&!kind[1]))&&(!strike_rng_ready||battle_rng_cursor.variant>1))return 2;
  actor=animation_state.actor;if(party_motion.status[actor])return 2; /* small/confused/status owners must load their own graphics */
  party_work=2;if(!ff3_action_oam_begin(animation_base,8+actor*6,6)){strike_error=5;party_work=0;return 3;}
  ff3_party_copy(54,(bow_pair?strike_arrow_centers:kind[0]!=1?strike_impact_centers:strike_centers)+(uint16_t)party_profile*32+animation_state.target*4,center,4);
  home=party_state.x[actor];memcpy(saved,party_state.pose,4);memcpy(party_motion.x,party_state.x,4);memcpy(party_motion.y,party_state.y,4);memcpy(party_motion.pose,party_state.pose,4);memcpy(party_motion.destination,party_state.x,4);
  party_motion.destination[actor]-=party_motion.rows[actor]?32:16;party_motion.frame=0;phase=1;hand=bow_pair?(kind[0]==3?0:1):0;
  /* 33/A077,A094: each original kind owns its hit cap, even an empty
   * hand whose A2F2 body subsequently returns without drawing. */
  /* A0F8..A10C/A24C copies right hits to left before either hand is capped. */
  for(i=0;i<2;i++){ff3_party_copy(53,strike_caps+kind[i],&w,1);s=animation_state.hits[kind[0]==4||kind[1]==4?0:i];hits[i]=s>=w?w-1:s;}
  if(bow_pair){hits[0]=hits[1]=animation_state.hits[0];ff3_party_copy(53,strike_caps+3,&w,1);if(hits[hand]>=w)hits[hand]=w-1;}
 }
 party_work=2;ff3_native_service();
 if(phase==1||phase==5){if(party_motion.x[actor]!=party_motion.destination[actor]){ff3_entry_motion_direction(&party_motion,phase==5);memcpy(party_state.x,party_motion.x,4);memcpy(party_state.y,party_motion.y,4);memcpy(party_state.pose,party_motion.pose,4);if(!publish(255,255))goto fault;goto pending;}
  memcpy(party_state.pose,saved,4);
  if(phase==5){ff3_text_rom_copy(0,0x8390,54,strike_restore+(uint16_t)party_profile*512,512);ff3_party_copy(54,strike_restore_pal+(uint16_t)party_profile*8,text_staging,8);ff3_text_palette_range(0,3,1,text_staging);if(!publish(255,255))goto fault;phase=6;goto pending;}
  ff3_text_rom_copy(0,0x8390,54,strike_jobs+(uint16_t)status_tail.jobs[actor]*256,256);
  for(i=0;i<2;i++)ff3_text_rom_copy(0,0x8490+(uint16_t)i*128,53,strike_patterns+(uint16_t)strike_weapons[i]*128,128);
  phase=2;
 }
 if(phase==2){while(hand<2&&!kind[hand]&&(kind[0]||kind[1]))hand++;if(hand==2){party_motion.destination[actor]=home;party_motion.frame=0;phase=5;goto pending;}
  if(!bow_pair&&hand&&kind[0]!=kind[1])ff3_party_copy(54,(kind[hand]!=1?strike_impact_centers:strike_centers)+(uint16_t)party_profile*32+animation_state.target*4,center,4);
  ff3_party_copy(53,strike_palettes+(uint16_t)strike_weapons[bow_pair?hand^1:hand]*8,text_staging,8);ff3_text_palette_range(0,3,1,text_staging);frame=0;left=hits[hand]?hits[hand]:1;phase=3;
  if(bow_pair){
   party_state.pose[actor]=hand?6:1;
   if(!ff3_party_actor_oam(&party_state,actor,raw_actor)){strike_error=2;goto fault;}
   ff3_party_copy(54,strike_angles+(uint16_t)party_profile*32+actor*8+animation_state.target,&w,1);
   if(!ff3_bow_begin(actor,party_state.x[actor],party_state.y[actor],hand,party_state.battle_type==0x88,hits[hand],w,center)){strike_error=6;goto fault;}phase=7;
  }
  if(kind[hand]==4)sound(0x8b); /* A1AD: once per hand, not per repeat. */
 }
 if(phase==7){
  s=ff3_bow_next(raw_actor,&battle_rng_cursor,animation_source);
  if(!s){phase=4;goto pending;}if(s==255){strike_error=6;goto fault;}
  if(bow_sound)sound(bow_sound);page=party_page;
  if(s==1){page^=1;out=page?party_oam1:party_oam0;w=ff3_bow_project(animation_source,out);if(w==255){strike_error=4;goto fault;}if(!ff3_action_oam_finish(out,0,w,1)){strike_error=5;goto fault;}strike_prepares++;}else strike_reuses++;
  strike_picture=2;next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}animation_video_frames++;if(animation_video_probe)animation_video_gate=1;goto pending;
 }
 if(phase==3){
  if(kind[hand]==0||kind[hand]==9){if(!frame)sound(0x8a);pose=hand?6:5;w=hand?13:4;s=hits[hand]?frame:255;}
  else if(kind[hand]==4){pose=hand?6:7;w=hand?15:14;s=frame>=8&&hits[hand]?frame:255;}
  else{if(!frame)sound(0xb6);pose=hand?(frame<4?7:6):(frame<4?5:1);w=hand?(frame<4?2:3):(frame<4?0:1);s=frame>=4&&hits[hand]?frame-4:255;}
  party_state.pose[actor]=pose;if(!publish(w,s))goto fault;
  if(++frame==(kind[hand]==4?16:8)){frame=0;if(!--left)phase=4;}goto pending;
 }
 if(phase==4){if(kind[hand]!=4)sound(255);memcpy(party_state.pose,saved,4);if(!publish(255,255))goto fault;hand=bow_pair?2:hand+1;phase=2;goto pending;}
 if(phase==6){memcpy(animation_state.hits,hits,2);phase=0;party_work=0;return 1;}
 pending:party_work=0;return 0;
 fault:party_work=0;return 3;
}
