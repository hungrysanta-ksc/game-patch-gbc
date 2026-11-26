#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-numerals.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;volatile uint16_t state_index;
static Ff3Numerals s,backup;static uint8_t oam[160],saved[160],bank=17;
static const uint8_t*position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint16_t i;uint8_t n,event;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<sizeof(s);i++)((uint8_t*)&s)[i]=byte();for(i=0;i<160;i++)oam[i]=byte();n=byte();
  if(!ff3_numerals_start(&s,oam)){state_failure=2;break;}
  for(event=0;event<n;event++){
   for(i=0;i<sizeof(s);i++)if(((uint8_t*)&s)[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}
   for(i=0;i<160;i++)if(oam[i]!=byte()&&!state_failure){state_failure=1;state_index=sizeof(s)+i;}if(state_failure)break;
   memcpy(&backup,&s,sizeof(s));memcpy(saved,oam,160);
   if(ff3_numerals_ack(&s,s.ticket+1,oam)||memcmp(&backup,&s,sizeof(s))||memcmp(saved,oam,160)){state_failure=3;break;}
   if(event+1==n){if(!s.done||ff3_numerals_ack(&s,s.ticket,oam)||memcmp(&backup,&s,sizeof(s))||memcmp(saved,oam,160)){state_failure=4;break;}}
   else if(!ff3_numerals_ack(&s,s.ticket,oam)){state_failure=5;break;}
  }if(state_failure)break;
 }state_status=state_failure?2:1;while(1)wait_vbl_done();
}
