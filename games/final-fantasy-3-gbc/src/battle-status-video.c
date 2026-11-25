#pragma bank 11
#include <gb/cgb.h>
#include <string.h>
#include "battle-status-video.h"
#include "battle-status-oam.h"
#include "battle-entry-tail.h"
#include "battle-party-oam.h"
#include "status-video-assets.h"
#include "platform.h"
void ff3_party_copy(uint8_t bank,const void*source,void*dest,uint16_t n) NONBANKED;
void ff3_party_palette(uint8_t bg,uint8_t first,uint8_t count,const uint8_t*data) NONBANKED;
#include "memory.h"
#include "text-vblank.h"
#ifdef FF3_STONE
#include "battle-stone.h"
#include "job-assets.h"
void ff3_resident_fix(void) NONBANKED;
static uint8_t job_raw[64],job_bytes[64];
#endif
extern Ff3EntryDisplay party_motion;
extern Ff3PartyOam party_state;
extern uint8_t party_source[96];
void ff3_native_service(void) NONBANKED;
uint8_t status_stage;
Ff3EntryTail status_tail;
Ff3StatusOam status_state;
uint8_t status_source[64];
volatile uint8_t status_load;
static uint8_t profile_id;
#ifdef FF3_STONE
static uint8_t refreshed;
#endif
static uint8_t work[8],native[32];
void ff3_status_video_reset(uint8_t profile) BANKED {
 const StatusVideoAsset*a=status_assets+profile;profile_id=profile;status_stage=status_load=0;
 ff3_party_copy(a->bank,a->tail,(uint8_t*)&status_tail,75);
 ff3_party_copy(a->bank,a->status,(uint8_t*)&status_state,35);
 memset(status_source,240,64);
#ifdef FF3_STONE
 ff3_stone_reset(profile);
 refreshed=0;
#endif
}
uint8_t ff3_status_video_advance(void) BANKED {
 const StatusVideoAsset*a=status_assets+profile_id;uint16_t at=0,dest;uint8_t n;
 if(!status_stage){memcpy(&status_tail.motion,&party_motion,39);if(!ff3_entry_tail_start(&status_tail))return 1;status_stage=1;
#ifdef FF3_STONE
 ff3_resident_fix();
#endif
 }
 else if(status_stage==1){if(!ff3_entry_tail_ack(&status_tail,status_tail.ticket))return 2;}
 else return 0; /* same command wait: original counter advances in objects() */
#ifdef FF3_STONE
 if(status_tail.phase==FF3_TAIL_DONE&&a->clear_after&&!refreshed){
  if(a->clear_after==2){for(n=0;n<4;n++)status_tail.motion.status[n]&=247;}
  else {memset(status_tail.motion.status,0,4);memset(status_tail.status2,0,4);}
  if(!ff3_entry_tail_refresh(&status_tail))return 4;refreshed=1;
 }
#endif
 memcpy(&party_motion,&status_tail.motion,39);
 if(status_tail.phase==FF3_TAIL_DONE){
  while(at<a->bytes){status_load++;ff3_party_copy(a->bank,a->blocks+at,work,3);dest=0x8000+work[0]+((uint16_t)work[1]<<8);n=work[2];at+=3;
   if(!n||n>64||at+n>a->bytes||dest<0x8000||dest+n>0x9000)return 3;
   ff3_party_copy(a->bank,a->blocks+at,text_staging,n);ff3_text_copy(0,dest,text_staging,n);ff3_native_service();at+=n;
  }
  status_load=254;ff3_party_copy(a->bank,a->palette+24,text_staging,8);
  ff3_party_palette(0,3,1,text_staging);status_load=0;status_stage=2;return 0;
 }
 if(status_tail.phase==FF3_TAIL_CANONICAL)return 0;
#ifdef FF3_STONE
 if(status_tail.phase==FF3_TAIL_HIDE)return 0;
 if(status_tail.phase==FF3_TAIL_MOVE)return 0;
 if(status_tail.phase==FF3_TAIL_LOAD){uint8_t t,y;
  if(!ff3_entry_tail_work(&status_tail,work)||work[0]!=2)return 4;
  at=work[2]+((uint16_t)work[3]<<8);n=work[4];
  if(work[1]<22){if(at+n>672)return 4;at+=(uint16_t)work[1]*672;}
  else if(work[1]==24||work[1]==25){if(at+n>128)return 4;at+=14784+(uint16_t)(work[1]-24)*128;}else return 4;
  ff3_party_copy(29,ff3_job_patterns+at,job_raw,n);if(!ff3_entry_tail_bytes(&status_tail,job_raw,job_bytes))return 4;
  for(t=0;t<n;t+=16)for(y=0;y<8;y++){text_staging[t+y*2]=job_bytes[t+y];text_staging[t+y*2+1]=job_bytes[t+y+8];}
  dest=0x8000+(work[5]+((uint16_t)work[6]<<8))-0x1000;ff3_text_copy(0,dest,text_staging,n);ff3_native_service();return 0;
 }
 if(status_tail.phase==FF3_TAIL_STATUS||status_tail.phase==FF3_TAIL_INNER){party_state.hidden[status_tail.actor]=0;
  if(!ff3_entry_tail_work(&status_tail,work)||!ff3_stone_change(status_tail.actor,work,party_motion.battle_type==0x88))return 4;return 0;
 }
#endif
 // Only a proven pristine, cache-hit, non-stone tail is supported here.
 // A stone/cache-miss/boss route must not masquerade as a completed display.
 if(status_tail.phase!=FF3_TAIL_STATUS||!ff3_entry_tail_work(&status_tail,work)||work[0]!=3||work[1]!=3)return 4;
 return 0;
}
uint8_t ff3_status_video_hold(void) BANKED {return status_stage==1&&(status_tail.phase==FF3_TAIL_CANONICAL||status_tail.phase==FF3_TAIL_LOAD);}
void ff3_status_video_source(void) BANKED {
 // Canonical entry prepared the new shadow without DMA. HIDE publishes
 // that shadow with only the loading actor's six records replaced by F0.
 if(status_stage==1&&status_tail.phase==FF3_TAIL_HIDE)memset(party_source+status_tail.actor*24,240,24);
}
uint8_t ff3_status_video_objects(uint8_t*out) BANKED {
 uint8_t i,j,n=0,y,x,a,dy=17,dx=party_state.battle_type==0x88?8:72;
 if(status_stage!=2)return 1;
 if(!ff3_status_oam(&status_state,status_source))return 0;
 // Target selection is a distinct owner; this command-entry adapter only
 // accepts the original B304-cleared masks, never silently omits numerals.
 for(i=0;i<4;i++)if(status_state.targets[i])return 0;
 for(i=0;i<4;i++,dy+=4)for(j=0;j<2;j++){
  const uint8_t*s=status_source+(i*2+j)*4;x=s[3]-dx;y=s[0]-dy;a=s[2];
  native[n++]=s[0]>=239||!x||x>=168||y<=8||y>=160?0:y;native[n++]=x;native[n++]=s[1];native[n++]=(a&3)|((a&64)>>1)|((a&128)>>1);
 }
 // Source priority: icons precede party; retained residuals follow party.
 // Current resident formation has <= 6 objects, leaving eight icon slots.
 for(i=32;i<40;i++)if(out[i*4])return 0;
 memmove(out+32,out,128);memcpy(out,native,32);return 1;
}
