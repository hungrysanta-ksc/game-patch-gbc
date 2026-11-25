#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-status-oam.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;volatile uint16_t state_index;
static Ff3StatusOam s,backup;static uint8_t out[64],bank=17;
static const uint8_t*position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint8_t i,v;
 cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<35;i++)((uint8_t*)&s)[i]=byte();memcpy(&backup,&s,35);memset(out,0xa5,64);
  s.status[2]=8;if(ff3_status_oam(&s,out)){state_failure=2;break;}for(i=0;i<64;i++)if(out[i]!=0xa5)state_failure=3;
  s.status[2]=backup.status[2];if(memcmp(&s,&backup,35)){state_failure=4;break;}
  if(!ff3_status_oam(&s,out)){state_failure=5;break;}
  if(s.counter!=byte()){state_failure=6;break;}
  for(i=0;i<64;i++){v=byte();if(v!=out[i]&&!state_failure){state_failure=1;state_index=i;}}
  backup.counter=s.counter;if(memcmp(&s,&backup,35))state_failure=7;if(state_failure)break;
 }state_status=state_failure?2:1;while(1)wait_vbl_done();
}
