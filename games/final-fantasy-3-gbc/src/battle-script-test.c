#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-script.h"
#include "battle-select-fixture.h"
#include "battle-script-assets.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static Ff3ActionScript s,backup;
static uint8_t bank=17;
static const uint8_t*position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
static void guards(void){uint8_t i,t;
 for(i=0;i<4;i++){memset(&s,0,sizeof(s));s.effect=1;s.script=2;memset(s.names,255,14);if(i==0)s.speed=9;if(i==1)s.script=6;if(i==2)memset(s.messages,65,10);if(i==3)s.messages[0]=144;memcpy(&backup,&s,sizeof(s));if(ff3_script_start(&s)||memcmp(&s,&backup,sizeof(s))){state_failure=8;return;}}
 for(i=0;i<144;i++){t=ff3_script_types[i>>1];t=i&1?t&15:t>>4;if(t>1)break;}
 memset(&s,0,sizeof(s));s.effect=1;s.script=2;memset(s.names,255,14);s.messages[0]=i;if(!ff3_script_start(&s)||s.error!=2){state_failure=9;return;}memcpy(&backup,&s,sizeof(s));if(ff3_script_ack(&s,s.ticket,1)||memcmp(&s,&backup,sizeof(s)))state_failure=10;
}
void main(void){uint16_t i,n,event;uint8_t buttons;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<sizeof(s);i++)((uint8_t*)&s)[i]=byte();n=byte();n|=(uint16_t)byte()<<8;
  if(!ff3_script_start(&s)){state_failure=2;break;}
  for(event=0;event<n;event++){
   for(i=0;i<sizeof(s);i++)if(((uint8_t*)&s)[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}buttons=byte();if(state_failure)break;
   memcpy(&backup,&s,sizeof(s));if(ff3_script_ack(&s,s.ticket+1,255)||memcmp(&backup,&s,sizeof(s))||ff3_script_start(&s)||memcmp(&backup,&s,sizeof(s))){state_failure=3;break;}
   if(s.kind==FF3_SCRIPT_BUTTON&&(!ff3_script_ack(&s,s.ticket,0)||memcmp(&backup,&s,sizeof(s)))){state_failure=4;break;}
   if(!ff3_script_ack(&s,s.ticket,buttons)){state_failure=5;break;}
   if(event+1==n){if(!s.done||s.kind){state_failure=6;break;}memcpy(&backup,&s,sizeof(s));if(ff3_script_ack(&s,s.ticket,1)||memcmp(&backup,&s,sizeof(s))){state_failure=7;break;}}
  }if(state_failure)break;
 }
 if(!state_failure)guards();state_status=state_failure?2:1;while(1)wait_vbl_done();
}
