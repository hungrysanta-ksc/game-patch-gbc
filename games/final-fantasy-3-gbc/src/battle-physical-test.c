#include <gb/gb.h>
#include <gb/cgb.h>
#include "battle-physical.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=17;
static const uint8_t *position=(const uint8_t*)0x4000;
static FF3BattleRng rng;
static Ff3Physical p;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint8_t op,i,result[5];uint16_t damage;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();
 for(i=0;;i++){rng.table[i]=byte();if(i==255)break;}
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  op=byte();for(i=0;i<sizeof(p);i++)((uint8_t*)&p)[i]=byte();rng.counter[0]=17;rng.counter[1]=byte();rng.counter[2]=239;
  damage=0;if(op==1)damage=ff3_physical_hits(&rng,p.attack,p.attack_high);else if(op!=2||!ff3_physical_damage(&rng,&p,&damage)){state_failure=2;break;}
  result[0]=(uint8_t)damage;result[1]=(uint8_t)(damage>>8);for(i=0;i<3;i++)result[i+2]=rng.counter[i];
  for(i=0;i<5;i++)if(result[i]!=byte()&&!state_failure){state_failure=1;state_index=i;}if(state_failure)break;
 }
 /* Invalid inputs must not look like successful damage or consume RNG. */
 if(!state_failure){p.targets=0;damage=0xa55a;i=rng.counter[1];if(ff3_physical_damage(&rng,&p,&damage)||damage!=0xa55a||i!=rng.counter[1])state_failure=3;}
 state_status=state_failure?2:1;while(1)wait_vbl_done();
}
