#include <gb/gb.h>
#include <gb/cgb.h>
#include "inventory.h"
#include "battle-items.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=11;
static const uint8_t *position=(const uint8_t*)0x4000;
static uint8_t state[72],scratch[64];
typedef char cursor_abi[sizeof(Ff3ItemCursor)==6?1:-1];
static uint8_t byte(void){uint8_t v=*position++;if(position==(const uint8_t*)0x8000){bank++;SWITCH_ROM(bank);position=(const uint8_t*)0x4000;}return v;}
void main(void){uint8_t op,i,arg,result,expected;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();SWITCH_ROM(11);
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  op=byte();for(i=0;i<72;i++)state[i]=byte();arg=byte();byte();result=1;
  if(op==1||op==2){if(op==1)ff3_inventory_pack(state,scratch);else ff3_inventory_unpack(state,scratch);for(i=0;i<64;i++)state[i]=scratch[i];}
  else if(op==3)result=ff3_inventory_reserve(state,arg,state+64);
  else if(op==4)result=ff3_inventory_return(state,state+64,state+65);
  else if(op==5)result=ff3_item_input((Ff3ItemCursor*)(state+66),arg);else state_failure=6;
  for(i=0;i<72;i++)if(state[i]!=byte()&&!state_failure){state_failure=op;state_index=i;}
  expected=byte();if(result!=expected&&!state_failure){state_failure=op;state_index=72;}
  if(state_failure)break;
 }
 /* Fail-closed contract outside the NES valid-reservation domain. */
 if(!state_failure){for(i=0;i<64;i++)state[i]=1;state[64]=2;state[65]=0;
  if(ff3_inventory_return(state,state+64,state+65)||state[64]!=2)state_failure=7;
  for(i=0;i<64;i++)if(state[i]!=1)state_failure=7;
  if(ff3_inventory_reserve(state,32,state+64)||ff3_inventory_reserve(state,0,state+64))state_failure=7;
 }
 state_status=state_failure?2:1;while(1)wait_vbl_done();
}
