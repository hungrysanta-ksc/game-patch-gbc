#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-opening.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static Ff3Opening s,backup;
static uint8_t bank=17;
static const uint8_t *position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint16_t i,n,event;uint8_t kind,value,buttons;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<sizeof(s);i++)((uint8_t*)&s)[i]=byte();n=byte();n|=(uint16_t)byte()<<8;
  if(!ff3_opening_start(&s)){state_failure=2;break;}
  for(event=0;event<n;event++){
   kind=byte();value=byte();buttons=byte();if(s.pending!=kind||s.value!=value){state_failure=2;state_index=event;break;}
   for(i=0;i<705;i++)if(((uint8_t*)&s)[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}if(state_failure)break;
   memcpy(&backup,&s,sizeof(s));if(ff3_opening_ack(&s,s.ticket+1,255)||memcmp(&backup,&s,sizeof(s))||ff3_opening_start(&s)||memcmp(&backup,&s,sizeof(s))){state_failure=3;break;}
   if(kind==FF3_OPEN_BUTTON&&( !ff3_opening_ack(&s,s.ticket,0)||memcmp(&backup,&s,sizeof(s)))){state_failure=4;break;}
   if(event+1<n){if(!ff3_opening_ack(&s,s.ticket,buttons)||s.ticket==backup.ticket){state_failure=5;break;}
    memcpy(&backup,&s,sizeof(s));if(ff3_opening_ack(&s,s.ticket-1,255)||memcmp(&backup,&s,sizeof(s))){state_failure=7;break;}}
   else if(ff3_opening_ack(&s,s.ticket,buttons)||memcmp(&backup,&s,sizeof(s))){state_failure=6;break;}
  }
  if(state_failure)break;
 }state_status=state_failure?2:1;while(1)wait_vbl_done();
}
