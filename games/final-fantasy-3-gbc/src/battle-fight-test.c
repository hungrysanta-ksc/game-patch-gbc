#include <gb/gb.h>
#include <gb/cgb.h>
#include "battle-fight.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=17;
static const uint8_t *position=(const uint8_t*)0x4000;
static FF3BattleRng rng;
static Ff3Fight s;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint16_t i;uint8_t result;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 if(sizeof(s)!=175){state_failure=3;state_status=2;while(1)wait_vbl_done();}
 for(i=0;i<256;i++)rng.table[i]=byte();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  for(i=0;i<sizeof(s);i++)((uint8_t*)&s)[i]=byte();for(i=0;i<3;i++)rng.counter[i]=byte();
  result=ff3_fight_resolved(&rng,&s);if(result!=byte()){state_failure=2;break;}
  for(i=0;i<sizeof(s);i++)if(((uint8_t*)&s)[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}
  for(i=0;i<3;i++)if(rng.counter[i]!=byte()&&!state_failure){state_failure=1;state_index=sizeof(s)+i;}if(state_failure)break;
 }
 state_status=state_failure?2:1;while(1)wait_vbl_done();
}
