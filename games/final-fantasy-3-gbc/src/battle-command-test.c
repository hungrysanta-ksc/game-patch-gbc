#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-command.h"
#include "battle-end.h"
#include "battle-death.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=17,left,value;
static const uint8_t *position=(const uint8_t*)0x4000;
static FF3BattleRng rng;
static Ff3BattleResult s;
static Ff3Fight fight;
static Ff3BattleCommand command;
static Ff3BattleEnd ending;
static Ff3Death death;
static uint8_t counts[4];
static uint8_t raw(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
static uint8_t byte(void){if(!left){left=raw();value=raw();}left--;return value;}
static void read(void*p,uint16_t n){uint8_t*b=p;while(n--)*b++=byte();}
static void compare(const void*p,uint16_t n){const uint8_t*b=p;while(n--){if(*b++!=byte()&&!state_failure)state_failure=1;if(!state_failure)state_index++;}}
void main(void){uint16_t i;uint8_t result,op,n,mask,reward;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();read(rng.table,256);
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  state_index=0;op=byte();
  if(op==1){read(&s,sizeof(s));read(&fight,sizeof(fight));read(rng.counter,3);memset(&command,0,sizeof(command));
   result=ff3_command_execute(&s,&rng,&fight,&command);if(result!=byte()){state_failure=2;break;}
   compare(&s,sizeof(s));compare(&fight,sizeof(fight));compare(&command,sizeof(command));compare(rng.counter,3);
  }else if(op==2){memset(&ending,0,sizeof(ending));read(&ending,4);n=byte();if(!ff3_end_start(&ending)){state_failure=3;break;}
   for(i=0;i<n;i++){compare(&ending,sizeof(ending));if(!ff3_end_ack(&ending,ending.ticket)){state_failure=4;break;}}compare(&ending,sizeof(ending));
  }else if(op==3){memset(&death,0,sizeof(death));death.back=byte();mask=byte();reward=byte();read(s.types,8);read(counts,4);n=byte();
   if(!ff3_death_start(&death)||!ff3_death_remove(&s,mask,reward,counts)){state_failure=5;break;}
   for(i=0;i<n;i++){compare(&death,sizeof(death));if(i+1<n&&!ff3_death_ack(&death,death.ticket)){state_failure=6;break;}}
   compare(s.types,8);compare(counts,4);compare(&s.remaining,1);
  }else {state_failure=7;break;}
  if(state_failure)break;
 }
 state_status=state_failure?2:1;while(1)wait_vbl_done();
}
