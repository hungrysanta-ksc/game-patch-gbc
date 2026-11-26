#pragma bank 55
#include <string.h>
#include "battle-animation-video.h"
#include "battle-strike-video.h"
#include "battle-motion-sprites.h"
#include "battle-party-oam.h"
#include "battle-entry.h"
#include "battle-entry-tail.h"
#include "text-vblank.h"
#include "strike-assets.h"
uint8_t strike_weapons[2]={30,0},strike_error;
uint8_t strike_critical;
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
static void sound(uint8_t v){while(native_request){ff3_native_service();__asm halt __endasm;}native_argument=v&127;native_request=v==255?8:7;while(native_request){ff3_native_service();__asm halt __endasm;}}
static uint8_t publish(uint8_t weapon,uint8_t slice){uint8_t i,j,n=0,y,a,page=party_page^1,*out=page?party_oam1:party_oam0,center[4];int16_t xx,yy,dx,dy;const uint8_t*q;
 memcpy(out,animation_base,160);memset(out,0,32);
 /* 33/A3E8/32/90EA moves the acting character into temporary OAM.
  * Reuse the scanline scratch for its original six records before counting. */
 if(!ff3_party_oam(&party_state,animation_lines)){strike_error=2;return 0;}
 ff3_native_service();
 if(!ff3_party_oam_v6(animation_lines,party_state.battle_type==0x88,out+32)){strike_error=2;return 0;}
 memset(animation_source,240,160);
 if(weapon!=255){
  memcpy(animation_source+(hand?16:0),animation_lines+actor*24,24);
  if(!ff3_motion_sprite(weapon,party_state.x[actor],party_state.y[actor],0,party_state.battle_type==0x88,3,animation_source+(hand?0:24))){strike_error=3;return 0;}
  if(slice!=255){ff3_party_copy(54,strike_centers+(uint16_t)party_profile*32+animation_state.target*4,center,4);
   if(!ff3_motion_slice(slice,center[0],center[1],hand,party_state.battle_type==0x88,animation_source+40)){strike_error=3;return 0;}}
  memset(out,0,160);dx=party_state.battle_type==0x88?-16:-80;dy=-33-actor*4;
  for(i=0;i<22;i++){
   if(!(i&7))ff3_native_service();
   if(i==10){if(slice==255)break;dx=(int16_t)center[2]-(party_state.battle_type==0x88?255-center[0]:center[0]);dy=(int16_t)center[3]-center[1]+1;}
   q=animation_source+i*4;if(!q[1])continue;xx=(int16_t)q[3]+dx;yy=(int16_t)q[0]+dy;
   if(n==40||xx<0||xx>152||yy<0||yy>136){strike_error=4;return 0;}a=q[2];out[n*4]=yy+16;out[n*4+1]=xx+8;out[n*4+2]=q[1];out[n*4+3]=(a&3)|((a&64)>>1)|((a&128)>>1);n++;
  }
  /* Remaining party and BG residuals follow original temporary-OAM priority.
   * No actor copy may remain in its old slots, including transparent rows. */
  for(i=8;i<40;i++){if(i>=8+actor*6&&i<14+actor*6)continue;q=animation_base+i*4;if(!q[0])continue;if(n==40){strike_error=4;return 0;}memcpy(out+n*4,q,4);n++;}
 }
 memset(animation_lines,0,144);for(i=0;i<40;i++){if(!(i&7))ff3_native_service();if(out[i*4]){y=out[i*4]-16;for(j=0;j<8;j++)if(y+j<144&&++animation_lines[y+j]>10){strike_error=5;return 0;}}}
 next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}animation_video_frames++;if(animation_video_probe)animation_video_gate=1;return 1;
}
void ff3_strike_reset(void) BANKED {phase=strike_error=0;}
/* The source owner completes only supported weapon kinds. Other bodies
 * remain pending before changing party/resource state, never successful no-ops. */
uint8_t ff3_strike_video(void) BANKED {uint8_t i,w,s;
 if(!phase){
  if(strike_critical||animation_state.actor>=4||!animation_state.target_enemy||animation_state.target>=8)return 2;
  for(i=0;i<2;i++){if(strike_weapons[i]>=88)return 2;ff3_party_copy(53,strike_props+strike_weapons[i]*3,kind+i,1);if(kind[i]!=1&&kind[i]!=0)return 2;}
  if(!kind[0]&&!kind[1])return 2;
  actor=animation_state.actor;if(party_motion.status[actor])return 2; /* small/confused/status owners must load their own graphics */
  home=party_state.x[actor];memcpy(saved,party_state.pose,4);memcpy(party_motion.x,party_state.x,4);memcpy(party_motion.y,party_state.y,4);memcpy(party_motion.pose,party_state.pose,4);memcpy(party_motion.destination,party_state.x,4);
  party_motion.destination[actor]-=party_motion.rows[actor]?32:16;party_motion.frame=0;phase=1;hand=0;
  /* 33/A077,A094: each original kind owns its hit cap, even an empty
   * hand whose A2F2 body subsequently returns without drawing. */
  for(i=0;i<2;i++){w=kind[i]?5:7;hits[i]=animation_state.hits[i]>=w?w-1:animation_state.hits[i];}
 }
 party_work=2;ff3_native_service();
 if(phase==1||phase==5){if(party_motion.x[actor]!=party_motion.destination[actor]){ff3_entry_motion_direction(&party_motion,phase==5);memcpy(party_state.x,party_motion.x,4);memcpy(party_state.y,party_motion.y,4);memcpy(party_state.pose,party_motion.pose,4);if(!publish(255,255))goto fault;goto pending;}
  memcpy(party_state.pose,saved,4);
  if(phase==5){ff3_text_rom_copy(0,0x8390,54,strike_restore+(uint16_t)party_profile*512,512);ff3_party_copy(54,strike_restore_pal+(uint16_t)party_profile*8,text_staging,8);ff3_text_palette_range(0,3,1,text_staging);if(!publish(255,255))goto fault;phase=6;goto pending;}
  ff3_text_rom_copy(0,0x8390,54,strike_jobs+(uint16_t)status_tail.jobs[actor]*256,256);
  for(i=0;i<2;i++)ff3_text_rom_copy(0,0x8490+(uint16_t)i*128,53,strike_patterns+(uint16_t)strike_weapons[i]*128,128);
  phase=2;
 }
 if(phase==2){while(hand<2&&!kind[hand])hand++;if(hand==2){party_motion.destination[actor]=home;party_motion.frame=0;phase=5;goto pending;}
  ff3_party_copy(53,strike_palettes+(uint16_t)strike_weapons[hand]*8,text_staging,8);ff3_text_palette_range(0,3,1,text_staging);frame=0;left=hits[hand]?hits[hand]:1;phase=3;
 }
 if(phase==3){if(!frame)sound(0xb6);pose=hand?(frame<4?7:6):(frame<4?5:1);w=hand?(frame<4?2:3):(frame<4?0:1);party_state.pose[actor]=pose;s=frame>=4&&hits[hand]?frame-4:255;if(!publish(w,s))goto fault;
  if(++frame==8){frame=0;if(!--left)phase=4;}goto pending;
 }
 if(phase==4){sound(255);memcpy(party_state.pose,saved,4);if(!publish(255,255))goto fault;hand++;phase=2;goto pending;}
 if(phase==6){memcpy(animation_state.hits,hits,2);phase=0;party_work=0;return 1;}
 pending:party_work=0;return 0;
 fault:party_work=0;return 3;
}
