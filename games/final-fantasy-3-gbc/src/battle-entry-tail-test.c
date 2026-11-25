#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-context.h" /* Both entry-rule and display types must coexist. */
#include "battle-entry-tail.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static Ff3EntryTail s,backup;
static Ff3EntryDisplay prefix;
static uint8_t src[64],out[64],work[8],bank=17;
static const uint8_t*position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint16_t i,n,event,refresh;uint8_t has,v,refresh_mode;
 cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<sizeof(prefix);i++)((uint8_t*)&prefix)[i]=byte();
  for(i=0;i<sizeof(s);i++)((uint8_t*)&s)[i]=byte();n=byte();n|=(uint16_t)byte()<<8;
  refresh=byte();refresh|=(uint16_t)byte()<<8;refresh_mode=byte();
  if(!ff3_entry_start(&prefix)){state_failure=2;break;}
  for(i=0;prefix.phase!=FF3_ENTRY_TAIL&&i<40;i++)if(!ff3_entry_ack(&prefix,prefix.ticket)){state_failure=2;break;}
  if(memcmp(&prefix,&s.motion,sizeof(prefix))){state_failure=3;break;}
  memcpy(&s.motion,&prefix,sizeof(prefix));if(!ff3_entry_tail_start(&s)){state_failure=4;break;}
  for(event=0;event<n;event++){
   if(event==refresh){if(refresh_mode==2||refresh_mode==3){for(i=0;i<4;i++)s.motion.status[i]&=refresh_mode==3?191:247;}else {memset(s.motion.status,0,4);memset(s.status2,0,4);}for(i=0;i<5;i++)s.counts[i]=9-i;if(!ff3_entry_tail_refresh(&s)){state_failure=15;break;}}
   for(i=0;i<71;i++){v=((uint8_t*)&s)[i<69?i:i+4];if(v!=byte()&&!state_failure){state_failure=1;state_index=i;}}
   if(state_failure)break;
   memcpy(&backup,&s,sizeof(s));
   if(s.phase!=FF3_TAIL_DONE&&(ff3_entry_tail_refresh(&s)||memcmp(&backup,&s,sizeof(s)))){state_failure=16;break;}
   if(ff3_entry_tail_ack(&s,s.ticket+1)||memcmp(&backup,&s,sizeof(s))||ff3_entry_tail_start(&s)||memcmp(&backup,&s,sizeof(s))){state_failure=5;break;}
   has=byte();memset(work,0xa5,8);memset(out,0xa5,64);
   if(has){if(!ff3_entry_tail_work(&s,work)){state_failure=6;break;}
    for(i=0;i<8;i++)if(work[i]!=byte()&&!state_failure){state_failure=7;state_index=i;}if(state_failure)break;
    for(i=0;i<work[4];i++)src[i]=byte();if(!ff3_entry_tail_bytes(&s,src,out)){state_failure=8;break;}
    for(i=0;i<work[4];i++)if(out[i]!=byte()&&!state_failure){state_failure=9;state_index=i;}
    for(;i<64;i++)if(out[i]!=0xa5)state_failure=10;
   }else {if(ff3_entry_tail_work(&s,work)||ff3_entry_tail_bytes(&s,src,out))state_failure=11;
    for(i=0;i<8;i++)if(work[i]!=0xa5)state_failure=11;for(i=0;i<64;i++)if(out[i]!=0xa5)state_failure=11;
   }
   if(memcmp(&backup,&s,sizeof(s)))state_failure=12;if(state_failure)break;
   if(event+1<n){if(!ff3_entry_tail_ack(&s,s.ticket)){state_failure=13;break;}}
   else if(s.phase!=FF3_TAIL_DONE||ff3_entry_tail_ack(&s,s.ticket)||memcmp(&backup,&s,sizeof(s))){state_failure=14;break;}
  }if(state_failure)break;
 }state_status=state_failure?2:1;while(1)wait_vbl_done();
}
