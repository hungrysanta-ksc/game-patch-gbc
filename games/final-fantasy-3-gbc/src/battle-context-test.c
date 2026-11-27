#include <gb/gb.h>
#include <gb/cgb.h>
#include "battle-context.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=17;
static const uint8_t *position=(const uint8_t*)0x4000;
static FF3BattleRng rng;
static union {Ff3Entry entry;Ff3StatusView view;Ff3Cannon cannon;Ff3Retarget retarget;Ff3Split split;uint8_t seed[272];} s;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint16_t i,size;uint8_t op,result;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();for(i=0;i<256;i++)rng.table[i]=byte();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  op=byte();size=byte();size|=(uint16_t)byte()<<8;if(size>sizeof(s)){state_failure=3;break;}
  for(i=0;i<size;i++)((uint8_t*)&s)[i]=byte();for(i=0;i<3;i++)rng.counter[i]=byte();result=1;
  switch(op){case 1:ff3_entry_rules(&rng,&s.entry);break;case 2:ff3_status_view(&s.view);break;case 3:ff3_cannon_prepare(&rng,&s.cannon);break;case 4:result=ff3_retarget(&rng,&s.retarget);break;case 5:result=ff3_split_prepare(&s.split);break;case 6:s.seed[257]=ff3_encounter_seed(s.seed,s.seed[256]);break;case 7:s.seed[271]=ff3_play_seed(s.seed,s.seed+79);break;default:result=0;}
  if(result!=byte()){state_failure=2;break;}for(i=0;i<size;i++)if(((uint8_t*)&s)[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}
  for(i=0;i<3;i++)if(rng.counter[i]!=byte()&&!state_failure){state_failure=1;state_index=size+i;}if(state_failure)break;
 }state_status=state_failure?2:1;while(1)wait_vbl_done();
}
