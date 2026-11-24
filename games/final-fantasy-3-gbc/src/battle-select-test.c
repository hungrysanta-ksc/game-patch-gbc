#include <gb/gb.h>
#include <gb/cgb.h>
#include "battle-select.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=11;
static const uint8_t *position=(const uint8_t*)0x4000;
static Ff3Target target;
static Ff3TargetEnv env;
static uint8_t byte(void){uint8_t v=*position++;if(position==(const uint8_t*)0x8000){bank++;SWITCH_ROM(bank);position=(const uint8_t*)0x4000;}return v;}
static void bytes(uint8_t *p,uint8_t n){while(n--)*p++=byte();}
static void compare(const uint8_t *p,uint8_t n,uint8_t op){uint8_t i;for(i=0;i<n;i++)if(p[i]!=byte()&&!state_failure){state_failure=op;state_index=i;}}
void main(void){uint8_t op,a,b,c,result[2];cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();SWITCH_ROM(11);
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  op=byte();if(op==1||op==2){bytes((uint8_t*)&env,25);bytes((uint8_t*)&target,11);a=byte();if(!ff3_target_valid(&env)){state_failure=5;break;}if(op==1)ff3_target_begin(&target,&env,a);else ff3_target_input(&target,&env,a);compare((uint8_t*)&target,11,op);}
  else if(op==3){a=byte();b=byte();c=byte();result[0]=ff3_command_cursor(a,b,c);compare(result,1,op);}
  else if(op==4){a=byte();b=byte();result[1]=byte();result[0]=ff3_input_repeat(a,b,&result[1]);compare(result,2,op);}
  else state_failure=6;
  if(state_failure)break;
 }
 state_status=state_failure?2:1;while(1)wait_vbl_done();
}
