#include <gb/gb.h>
#include <gb/cgb.h>
#include "battle-party.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=11;
static const uint8_t *position=(const uint8_t*)0x4000;
static Ff3Party party;
typedef char party_abi[sizeof(Ff3Party)==55?1:-1];
static uint8_t byte(void){uint8_t v=*position++;if(position==(const uint8_t*)0x8000){bank++;SWITCH_ROM(bank);position=(const uint8_t*)0x4000;}return v;}
void main(void){uint8_t op,i,args[4],*p=(uint8_t*)&party;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();SWITCH_ROM(11);
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  op=byte();for(i=0;i<55;i++)p[i]=byte();for(i=0;i<4;i++)args[i]=byte();
  if(op==1)ff3_party_enter(&party);else if(op==2)ff3_party_previous(&party);else if(op==3)ff3_party_pick(&party,args[0],args[1]);else if(op==4){if(!ff3_party_accept(&party,args[0],args[1],args[2]))state_failure=5;}else state_failure=6;
  for(i=0;i<55;i++)if(p[i]!=byte()&&!state_failure){state_failure=op;state_index=i;}
  if(state_failure)break;
 }state_status=state_failure?2:1;while(1)wait_vbl_done();
}
