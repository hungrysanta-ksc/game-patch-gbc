#include <gb/gb.h>
#include <gb/cgb.h>
#include "battle-result.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=17,left,value;
static const uint8_t *position=(const uint8_t*)0x4000;
static FF3BattleRng rng;
static Ff3BattleResult s;
static Ff3Fight fight;
static uint8_t raw(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
static uint8_t byte(void){if(!left){left=raw();value=raw();}left--;return value;}
void main(void){uint16_t i;uint8_t result,op;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(i=0;i<256;i++)rng.table[i]=byte();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  op=byte();for(i=0;i<sizeof(s);i++)((uint8_t*)&s)[i]=byte();for(i=0;i<3;i++)rng.counter[i]=byte();
  if(op==5){for(i=0;i<sizeof(fight);i++)((uint8_t*)&fight)[i]=byte();result=ff3_result_attack(&s,&rng,&fight,(fight.target[44]&128)?4+(fight.target[44]&7):(fight.target[44]&7));}
  else if(op<2)result=ff3_result_status(&s,op);
  else if(op<4)result=ff3_result_run(&s,&rng,op-2);
  else{ff3_result_check(&s);result=1;}
  if(result!=byte()){state_failure=2;break;}
  for(i=0;i<sizeof(s);i++)if(((uint8_t*)&s)[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}
  for(i=0;i<3;i++)if(rng.counter[i]!=byte()&&!state_failure){state_failure=1;state_index=sizeof(s)+i;}if(state_failure)break;
  if(op==5)for(i=0;i<sizeof(fight);i++)if(((uint8_t*)&fight)[i]!=byte()&&!state_failure){state_failure=1;state_index=sizeof(s)+3+i;}if(state_failure)break;
 }
 state_status=state_failure?2:1;while(1)wait_vbl_done();
}
