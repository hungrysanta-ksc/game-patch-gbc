#ifndef STATE_HOST
#pragma bank 119
#endif
#include "battle-death.h"
#include <string.h>
uint8_t ff3_death_start(Ff3Death*s) FF3_STATE_BANKED {
 uint8_t i,j,v[5]={255,255,255,128,0},carry,next;
 if(s->back>1||s->ticket||s->frame||s->wait||s->done)return 0;
 for(i=0;i<13;i++){
  memcpy(s->gradient+i*5,v,5);s->x[i]=s->back?6:25;carry=0;
  for(j=0;j<5;j++){next=v[j]&1;v[j]=(v[j]>>1)|(carry<<7);carry=next;}
 }s->wait=2;s->ticket=1;return 1;
}
uint8_t ff3_death_ack(Ff3Death*s,uint16_t ticket) FF3_STATE_BANKED {
 uint8_t i,j,carry,next,*p;
 if(!s->ticket||s->ticket!=ticket||s->done||!s->wait)return 0;
 if(--s->wait){s->ticket++;return 1;}
 for(i=0;i<13;i++){
  p=s->gradient+i*5;carry=0;for(j=5;j;j--){next=p[j-1]>>7;p[j-1]=(p[j-1]<<1)|carry;carry=next;}
  if(carry)s->x[i]+=s->back?1:-1;
 }s->frame++;if(s->frame==37)s->done=1;else s->wait=2;s->ticket++;return 1;
}
uint8_t ff3_death_remove(Ff3BattleResult*s,uint8_t mask,uint8_t reward,uint8_t*counts) FF3_STATE_BANKED {
 uint8_t i,t,n=0;if(reward>1)return 0;
 for(i=0;i<8;i++)if(s->types[i]>3&&s->types[i]!=255)return 0;
 for(i=0;i<8;i++){t=s->types[i];if(mask&(128>>i)){if(reward&&t!=255)counts[t]++;s->types[i]=255;}else if(t!=255)n++;}
 s->remaining=n;return 1;
}
