#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-motion-sprites.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=17,in[8],out[48],before[48];
static const uint8_t*position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint8_t i,n,ok;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<8;i++)in[i]=byte();memset(out,0xa5,48);
  if(in[0]){n=48;ok=ff3_motion_slice(in[1],in[2],in[3],in[4],in[5],out);}
  else{n=16;ok=ff3_motion_sprite(in[1],in[2],in[3],in[4],in[5],in[6]|in[7],out);}
  if(!ok){state_failure=2;break;}
  for(i=0;i<n;i++)if(out[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}
  for(i=n;i<48;i++)if(out[i]!=0xa5)state_failure=3;
  memcpy(before,out,48);if(ff3_motion_sprite(95,0,0,0,0,0,out)||ff3_motion_slice(4,0,0,0,0,out)||memcmp(before,out,48))state_failure=4;
  if(state_failure)break;
 }state_status=state_failure?2:1;while(1)wait_vbl_done();
}
