#ifndef STATE_HOST
#pragma bank 15
#endif
#include "battle-physical.h"
#ifdef FF3_SCENE_LAYOUT
void ff3_native_service(void) NONBANKED;
#endif
uint8_t ff3_physical_hits(FF3BattleRng *rng,uint8_t attempts,uint8_t chance) FF3_STATE_BANKED {
 uint8_t hits=0,roll;while(attempts--){
#ifdef FF3_SCENE_LAYOUT
  if(!(attempts&7))ff3_native_service();
#endif
  ff3_battle_random(rng,1,0,99,&roll);if(roll<chance)hits++;}return hits;
}
uint8_t ff3_physical_damage(FF3BattleRng *rng,const Ff3Physical *p,uint16_t *damage) FF3_STATE_BANKED {
 uint8_t roll,m;uint16_t n;
 if(!p->targets)return 0;
 /* LSR high / ROR low forms an 8-bit RNG upper bound, even for unusual input. */
 ff3_battle_random(rng,1,0,(p->attack>>1)|((p->attack_high&1)<<7),&roll);
 n=(uint16_t)(((uint16_t)p->attack_high<<8)|p->attack);n+=roll;m=p->multiplier>>1;
 if(!m)n>>=1;else n=(uint16_t)((uint32_t)n*m);
 n+=(uint16_t)p->critical*p->critical_bonus;
 /* The original skips defense subtraction for character versus character. */
 if((p->attacker_flags|p->target_flags)&128)n=n<p->defense?0:n-p->defense;
 n=(uint16_t)((uint32_t)n*p->hits);n/=p->targets;*damage=n>=9999?9999:n;return 1;
}
