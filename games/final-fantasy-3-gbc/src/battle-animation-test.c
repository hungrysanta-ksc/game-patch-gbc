#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-animation.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static Ff3Animation s,backup;
static uint8_t bank=17;
static const uint8_t*position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint16_t i,n,event;uint8_t index;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<sizeof(s);i++)((uint8_t*)&s)[i]=byte();n=byte();n|=(uint16_t)byte()<<8;
  if(!ff3_animation_start(&s)){state_failure=2;break;}
  for(event=0;event<n;event++){
   for(i=0;i<106;i++){index=i<101?i:i<104?i+1:i+3;if(((uint8_t*)&s)[index]!=byte()&&!state_failure){state_failure=1;state_index=index;}}if(state_failure)break;
   memcpy(&backup,&s,sizeof(s));if(ff3_animation_ack(&s,s.ticket+1)||memcmp(&backup,&s,sizeof(s))||ff3_animation_start(&s)||memcmp(&backup,&s,sizeof(s))){state_failure=3;break;}
   if(event+1==n){if(!s.done||ff3_animation_ack(&s,s.ticket)||memcmp(&backup,&s,sizeof(s))){state_failure=4;break;}}
   else if(!ff3_animation_ack(&s,s.ticket)){state_failure=5;break;}
  }if(state_failure)break;
 }
 state_status=state_failure?2:1;while(1)wait_vbl_done();
}
