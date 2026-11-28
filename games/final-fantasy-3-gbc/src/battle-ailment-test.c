#include <gb/gb.h>
#include <gb/cgb.h>
#include "battle-ailment.h"
#include "battle-select-fixture.h"
volatile uint8_t state_ready,state_status,state_failure,state_start;
volatile uint32_t state_case;
volatile uint16_t state_index;
static uint8_t bank=17;
static const uint8_t *position=(const uint8_t*)0x4000;
static FF3BattleRng rng;
static uint8_t expected[239];
static struct {Ff3Fight fight;uint8_t character[64];} s;
static uint8_t byte(void){uint8_t v;SWITCH_ROM(bank);v=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return v;}
void main(void){uint16_t i;uint8_t op,param,*a,*t,self,n,index;cpu_fast();state_ready=0xa5;while(!state_start)wait_vbl_done();for(i=0;i<256;i++)rng.table[i]=byte();
 for(state_case=0;state_case<SELECT_CASES;state_case++){
  op=byte();param=byte();n=byte();while(n--){index=byte();((uint8_t*)&s)[index]=byte();}for(i=0;i<sizeof(s);i++)expected[i]=((uint8_t*)&s)[i];for(i=0;i<3;i++)rng.counter[i]=byte();
  n=byte();while(n--){index=byte();expected[index]=byte();}
  a=s.fight.actor;t=s.fight.target;self=a[44]==t[44];if(self)t=a;
  switch(op){
   case 1:ff3_ailment_apply(&s.fight,a,t,param);break;
   case 2:ff3_ailment_remove(&s.fight,a,t,param);break;
   case 3:ff3_ailment_cure(&s.fight,a,t,param);break;
   case 4:ff3_ailment_toggle(&s.fight,t,param);break;
   case 5:ff3_ailment_revive(&rng,&s.fight,a,t,param);break;
   case 6:ff3_ailment_poison(t,s.fight.target_number);break;
   case 7:ff3_ailment_leave(s.fight.target,s.character);break;
   case 8:ff3_ailment_enter(s.fight.target,s.character);break;
   case 9:if(!ff3_ailment_recover(&rng,a,s.fight.actor_status,&s.fight.status_message))state_failure=3;break;
   default:state_failure=3;
  }
  if(self&&op<=6)for(i=0;i<64;i++)s.fight.target[i]=a[i];
  for(i=0;i<sizeof(s);i++)if(((uint8_t*)&s)[i]!=expected[i]&&!state_failure){state_failure=1;state_index=i;}
  for(i=0;i<3;i++)if(rng.counter[i]!=byte()&&!state_failure){state_failure=1;state_index=sizeof(s)+i;}if(state_failure)break;
 }state_status=state_failure?2:1;while(1)wait_vbl_done();
}
