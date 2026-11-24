#include <gb/gb.h>
#include <gb/cgb.h>
#include "battle-equipment.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=17,state[192];
static const uint8_t *position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint8_t op,n,arg,result,expected;uint16_t i;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  op=byte();n=op==1?78:192;for(i=0;i<n;i++)state[i]=byte();arg=byte();
  if(op==1)result=ff3_equipment_swap(state,state+64,(Ff3ItemCursor*)(state+72),arg);
  else{ff3_equipment_update(state,state+64,state+128);result=1;}
  for(i=0;i<n;i++)if(state[i]!=byte()&&!state_failure){state_failure=op;state_index=i;}
  expected=byte();if(result!=expected&&!state_failure){state_failure=op;state_index=n;}
  if(state_failure)break;
 }
 state_status=state_failure?2:1;while(1)wait_vbl_done();
}
