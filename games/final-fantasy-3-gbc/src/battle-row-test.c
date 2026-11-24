#include <gb/gb.h>
#include <gb/cgb.h>
#include "battle-row.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=17;
static Ff3Row state;
static const uint8_t *position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint8_t op,key,result,i;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  op=byte();for(i=0;i<sizeof(state);i++)((uint8_t*)&state)[i]=byte();key=byte();result=1;
  if(op==1)result=ff3_row_begin(&state);else if(op==2)ff3_row_key(&state,key);else result=ff3_row_execute(&state);
  for(i=0;i<sizeof(state);i++)if(((uint8_t*)&state)[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}
  if(!result&&!state_failure){state_failure=2;state_index=16;}
  if(state_failure)break;
 }
 state_status=state_failure?2:1;while(1)wait_vbl_done();
}
