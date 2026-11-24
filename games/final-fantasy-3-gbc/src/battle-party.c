#include "battle-party.h"
/* 34/986F..990A. Renderer calls are separate consumers. Automatic actions
 * and inventory returns stop at their original caller boundary. */
void ff3_party_enter(Ff3Party *s){uint8_t i,n;
 for(;;){i=s->actor;if(i<4){s->magic&=~(128>>i);
   if(s->status2[i]&1)s->selected[i]=s->action[i*3+1];
   if(!(s->status2[i]&1)||!s->selected[i]){s->command[i]=255;s->selected[i]=0;}
  }
  /* A433 may finish without visiting subsequent uncontrollable actors. */
  for(n=i;n<4;n++)if(!(s->display[n]&248))break;
  if(n==4){s->actor=4;s->phase=FF3_PARTY_READY;return;}
  if(s->saved[i]){s->defense[i]=s->saved[i];s->saved[i]=0;}
  if(s->status1[i]&192){s->actor++;continue;}
  if(s->status2[i]&224){s->phase=FF3_PARTY_AUTO;return;}
  if(s->status2[i]&1){s->actor++;continue;}
  s->action[i*3]=s->action[i*3+1]=s->action[i*3+2]=0;s->flags[i]&=247;
  s->phase=s->used[i]?FF3_PARTY_RETURN_ITEM:FF3_PARTY_SELECT;return;
 }
}
/* 34/99BB and 9A42: B on slot zero re-enters the same actor. */
void ff3_party_previous(Ff3Party *s){uint8_t original=s->actor,i=original;if(!i||i>3)return;
 do{i--;if(!(s->status2[i]&1)&&!(s->display[i]&248)){s->actor=i;return;}}while(i);
 s->actor=original;
}
void ff3_party_pick(Ff3Party *s,uint8_t slot,uint8_t command){if(s->actor<4){s->slot[s->actor]=slot;s->command[s->actor]=command;}}
/* 35/A853..A86C, A877, A8AB and AA56. This reserves an action; it does
 * not apply damage, defense, escape RNG, or consume any item. */
uint8_t ff3_party_accept(Ff3Party *s,uint8_t command,uint8_t mask,uint8_t flags){uint8_t i=s->actor*3;if(s->actor>=4)return 0;
 if(command==4){if(!mask)return 1;s->action[i+1]=mask;s->action[i+2]=flags;}
 else if(command!=5&&command!=6)return 0;
 s->action[i]=command;s->actor++;return 1;
}
