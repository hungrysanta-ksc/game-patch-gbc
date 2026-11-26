#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-party-oam.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static Ff3PartyOam s;
static uint8_t source[96],native[96],bank=17;
#ifdef FF3_EFFECTS
static uint8_t single[26];
uint8_t ff3_action_oam_test(void);
#endif
static const uint8_t*position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint8_t i,p;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
#ifdef FF3_EFFECTS
 state_failure=ff3_action_oam_test();if(state_failure){state_status=2;while(1)wait_vbl_done();}
#endif
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<26;i++)((uint8_t*)&s)[i]=byte();
  memset(source,0xa5,96);p=s.pose[3];s.pose[3]=21;
  if(ff3_party_oam(&s,source))state_failure=2;
  for(i=0;i<96;i++)if(source[i]!=0xa5)state_failure=3;
  s.pose[3]=p;if(!ff3_party_oam(&s,source)||!ff3_party_oam_v6(source,s.battle_type==0x88,native)){state_failure=4;break;}
#ifdef FF3_EFFECTS
  for(p=0;p<4;p++){
   memset(single,0xa5,26);
   if(!ff3_party_actor_oam(&s,p,single+1)||memcmp(single+1,source+p*24,24)||single[0]!=0xa5||single[25]!=0xa5)state_failure=7;
  }
  memset(single,0xa5,26);p=s.pose[0];s.pose[0]=21;
  if(ff3_party_actor_oam(&s,0,single+1)||ff3_party_actor_oam(&s,4,single+1))state_failure=8;
  for(i=0;i<26;i++)if(single[i]!=0xa5)state_failure=9;s.pose[0]=p;
#endif
  for(i=0;i<96;i++)if(byte()!=source[i]&&!state_failure){state_failure=1;state_index=i;}
  for(i=0;i<96;i++)if(byte()!=native[i]&&!state_failure){state_failure=1;state_index=96+i;}
  p=source[94];source[92]=40;source[94]|=32;memset(native,0xa5,96);
  if(ff3_party_oam_v6(source,0,native))state_failure=5;
  for(i=0;i<96;i++)if(native[i]!=0xa5)state_failure=6;source[94]=p;
  if(state_failure)break;
 }state_status=state_failure?2:1;while(1)wait_vbl_done();
}
