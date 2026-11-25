#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-entry.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static Ff3Entry s,backup;
static uint8_t terrain[256],out[64],bank=17;
static const uint8_t *position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint16_t i;uint8_t n,event;
 cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<sizeof(s);i++)((uint8_t*)&s)[i]=byte();
  for(i=0;i<256;i++)terrain[i]=byte();n=byte();
  if(!ff3_entry_start(&s)){state_failure=2;break;}
  for(event=0;event<n;event++){
   for(i=0;i<sizeof(s);i++)if(((uint8_t*)&s)[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}
   if(state_failure)break;
   memcpy(&backup,&s,sizeof(s));
   if(ff3_entry_ack(&s,s.ticket+1)||memcmp(&backup,&s,sizeof(s))||ff3_entry_start(&s)||memcmp(&backup,&s,sizeof(s))){state_failure=3;break;}
   memset(out,0xa5,64);
   if(s.phase==FF3_ENTRY_TERRAIN){
    if(!ff3_entry_terrain(&s,terrain,out)){state_failure=4;break;}
    for(i=0;i<64;i++)if(out[i]!=byte()&&!state_failure){state_failure=5;state_index=i;}
    if(state_failure)break;
   }else {
    if(ff3_entry_terrain(&s,terrain,out)){state_failure=6;break;}
    for(i=0;i<64;i++)if(out[i]!=0xa5)state_failure=6;
   }
   if(memcmp(&backup,&s,sizeof(s))){state_failure=7;break;}
   if(event+1<n){if(!ff3_entry_ack(&s,s.ticket)){state_failure=8;break;}}
   else if(s.phase!=FF3_ENTRY_TAIL||ff3_entry_ack(&s,s.ticket)||memcmp(&backup,&s,sizeof(s))){state_failure=9;break;}
  }if(state_failure)break;
 }state_status=state_failure?2:1;while(1)wait_vbl_done();
}
