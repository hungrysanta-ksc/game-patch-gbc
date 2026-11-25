#ifndef STATE_HOST
#pragma bank 16
#endif
#include "battle-opening.h"
#include <stddef.h>
typedef char opening_abi[(sizeof(Ff3Opening)==712&&offsetof(Ff3Opening,flags)==697)?1:-1];
/* Resumption points correspond to source caller addresses, split only where
 * GBC video/input must yield instead of blocking audio/interrupt service. */
enum {P_ENTRY=1,P_BUTTON,P_HIDE,P_CLEAR,P_MESSAGE,P_CANNON,P_TARGET_NUMBERS,
 P_ACTOR_NUMBERS,P_DEATH,P_WAIT,P_CLOSE,P_CLEANUP,P_RESTORE,P_SELECT};
static void request(Ff3Opening*s,uint8_t kind,uint8_t value,uint8_t phase){s->pending=kind;s->value=value;s->phase=phase;s->ticket++;}
static void count(Ff3Opening*s){uint8_t i,j;for(i=0;i<4;i++){s->counts[i]=0;for(j=0;j<8;j++)if(s->types[j]==i)s->counts[i]++;}}
static void collect(Ff3Opening*s){ff3_party_enter(&s->party);
 if(s->party.phase==FF3_PARTY_READY){request(s,FF3_OPEN_CALLER,0,0);return;}
 if(s->party.phase==FF3_PARTY_AUTO){request(s,FF3_OPEN_AUTO,s->party.actor,0);return;}
 if(s->party.phase==FF3_PARTY_RETURN_ITEM){request(s,FF3_OPEN_RETURN_ITEM,s->party.actor,0);return;}
 if(!s->turn){request(s,FF3_OPEN_GRAPHICS,0,P_ENTRY);return;}
 request(s,FF3_OPEN_GRAPHICS,2,P_SELECT);
}
static void after_entry(Ff3Opening*s){
 if(s->flags&32)request(s,FF3_OPEN_GRAPHICS,15,P_HIDE);
 else if(s->first&128)request(s,FF3_OPEN_CALLER,0,0);
 else request(s,FF3_OPEN_GRAPHICS,2,P_SELECT);
}
static void wait_message(Ff3Opening*s){s->wait=(8-s->speed)*8;if(s->wait)request(s,FF3_OPEN_WAIT,1,P_WAIT);else request(s,FF3_OPEN_CLOSE,4,P_CLOSE);}
/* 34/9408 status commit, 8496 first mismatch chooses death or summon.
 * The metadata half of the chosen graphics consumer runs only after its ack. */
static void death(Ff3Opening*s){uint8_t i,*p,kind=0;s->mask=0;
 for(i=0;i<8;i++){p=s->cannon.monsters+(uint16_t)i*64;p[1]|=s->cannon.status[i*2];
  if(p[1]&0xe8){p[1]=(p[1]&0xe8)|128;s->dead[i]=p[1];}p[2]|=s->cannon.status[i*2+1];
 }
 s->cannon.effect=22;s->target_kind=1;
 for(i=0;i<8;i++){if(s->dead[i]&128){if(s->types[i]!=255){kind=10;break;}}
  else if(s->types[i]==255){kind=11;break;}}
 if(!kind){wait_message(s);return;}
 for(i=0;i<8;i++)s->mask=(s->mask<<1)|(s->dead[i]>>7);
 if(kind==11)s->mask^=255;request(s,FF3_OPEN_GRAPHICS,kind,P_DEATH);
}
uint8_t ff3_opening_start(Ff3Opening*s) FF3_STATE_BANKED {uint8_t i;
 if(s->pending||s->phase||s->party.actor>4||s->speed>8)return 0;
 for(i=0;i<8;i++)if((s->types[i]>3&&s->types[i]!=255)||(s->original_types[i]>3&&s->original_types[i]!=255))return 0;
 s->ticket=s->wait=s->mask=s->error=0;
 for(i=0;i<4;i++){s->views[i].raw[0]=s->party.status1[i];s->views[i].raw[1]=s->party.status2[i];ff3_status_view(&s->views[i]);s->party.display[i]=s->views[i].normalized[0];
  /* 34/81A0 restores all saved defenses before entering the collector. */
  if(s->party.saved[i]){s->party.defense[i]=s->party.saved[i];s->party.saved[i]=0;}}
 s->party.actor=0;collect(s);return 1;
}
uint8_t ff3_opening_ack(Ff3Opening*s,uint8_t ticket,uint8_t buttons) FF3_STATE_BANKED {uint8_t i,n;
 if(ticket!=s->ticket||!s->phase||s->error)return 0;
 switch(s->phase){
 case P_ENTRY:s->turn++;count(s);if(!(s->flags&32)&&!(s->first&128))request(s,FF3_OPEN_BUTTON,0,P_BUTTON);else after_entry(s);break;
 case P_BUTTON:if(buttons)after_entry(s);break;
 case P_HIDE:s->message=61;s->flags&=0xdf;request(s,FF3_OPEN_CLEAR,0,P_CLEAR);break;
 case P_CLEAR:s->message_index=0;request(s,FF3_OPEN_MESSAGE,s->message,P_MESSAGE);break;
 case P_MESSAGE:s->message_index++;s->target_kind=1;request(s,FF3_OPEN_GRAPHICS,36,P_CANNON);break;
 case P_CANNON:s->cannon.effect=23;s->target_kind=1;request(s,FF3_OPEN_GRAPHICS,28,P_TARGET_NUMBERS);break;
 case P_TARGET_NUMBERS:for(i=0;i<16;i++)s->cannon.numbers[i]=s->cannon.numbers[16+i];s->target_kind=0;request(s,FF3_OPEN_GRAPHICS,28,P_ACTOR_NUMBERS);break;
 case P_ACTOR_NUMBERS:death(s);break;
 case P_DEATH:for(i=0;i<8;i++)if(s->mask&(128u>>i)){
   if(s->value==10){if(s->types[i]!=255)s->rewards[s->types[i]]++;s->types[i]=255;}
   else s->types[i]=s->original_types[i];}count(s);wait_message(s);break;
 case P_WAIT:if((buttons&1)||!--s->wait)request(s,FF3_OPEN_CLOSE,4,P_CLOSE);else request(s,FF3_OPEN_WAIT,1,P_WAIT);break;
 case P_CLOSE:request(s,FF3_OPEN_GRAPHICS,37,P_CLEANUP);break;
 case P_CLEANUP:
  if(!(s->result&2)){for(i=0;i<4;i++)if(!(s->party.status1[i]&192))break;
   if(i==4)s->result=128;else{n=0;for(i=0;i<4;i++)n+=s->counts[i];if(!n)s->result=64;}}
  /* A458 leaves $52 at the first surviving party slot. */
  if(!(s->result&2)){for(i=0;i<4;i++)if(!(s->party.status1[i]&192))break;s->party.actor=i;}
  if(s->result==64)request(s,FF3_OPEN_VICTORY,64,0);else request(s,FF3_OPEN_GRAPHICS,14,P_RESTORE);break;
 case P_RESTORE:collect(s);break;
 case P_SELECT:request(s,FF3_OPEN_SELECT,s->party.actor,0);break;
 default:return 0;
 }return 1;
}
