#ifndef STATE_HOST
#pragma bank 15
#endif
#include "battle-fight.h"
static uint16_t word(const uint8_t *p){return p[0]|((uint16_t)p[1]<<8);}
static void put(uint8_t *p,uint16_t v){p[0]=(uint8_t)v;p[1]=(uint8_t)(v>>8);}
static uint8_t random99(FF3BattleRng *r){uint8_t v;ff3_battle_random(r,1,0,99,&v);return v;}
static void queue(Ff3Fight *s,uint8_t id){s->messages[s->message_count++]=id;}
/* 31/BCD2: even a second hit on zero HP increments the original death byte. */
static uint8_t subtract(Ff3Fight *s,uint8_t *p,uint16_t n){uint16_t hp=word(p+3);if(!n)return 1;if(hp<=n){put(p+3,0);s->deaths++;return 0;}put(p+3,hp-n);return 1;}
/* 31/BD24: original 16-bit sum is compared to max HP after wrapping. */
static void restore(uint8_t *p,uint16_t n){uint16_t hp=word(p+3)+n,max=word(p+5);put(p+3,hp>max?max:hp);}
static uint8_t ranged(const Ff3Fight *s,uint8_t dual,uint8_t hand){uint8_t id;
 if((s->actor[49]|s->actor[50])&8)return 1;
 if(!(s->equipment[0]|s->equipment[1]))return 0;
 if(dual)id=s->equipment[hand];else{id=s->equipment[0];if(!id||id>=0x57)id=s->equipment[1];}
 return id>=0x3f&&id<0x42;
}
/* 31/BBF3..BCD1. Keep priority, partial petrify, message-without-increment,
 * and confusion's command/flag changes. The original target mask is MSB first. */
static void status(Ff3Fight *s,uint8_t *a,uint8_t *t,uint8_t effect){uint8_t n=0,v=effect,old;
 if(!(effect&1)){
  if(s->target_status[0]>=effect)goto ineffective;
  s->target_status[0]|=effect;while(!(v&128)){v<<=1;n++;}if(n>=2)n+=3;
  s->status_message=n+10;return;
 }
 if((effect&32)&&(s->boss&128))goto ineffective;
 old=s->target_status[1];
 if(effect&6){
  n=effect&0x7e;if(n+(old&6)<8){s->target_status[1]=old+n;if(a[46]==4)queue(s,0x3c);return;}
  s->target_status[1]=old&0xf9;s->target_status[0]|=0x40;s->status_message=0x0b;s->messages[s->message_count]=0x28;return;
 }
 if((old&0xe0)>=(effect&0xe0))goto ineffective;
 s->target_status[1]=(effect&0xfe)|(old&7);
 if(s->target_status[1]&32){t[46]=0;t[44]&=0xe7;}
 while(!(v&128)){v<<=1;n++;}s->status_message=n+12;return;
ineffective:s->target_mask&=(uint8_t)~(128u>>s->target_slot);
}
uint8_t ff3_fight_resolved(FF3BattleRng *rng,Ff3Fight *s) FF3_STATE_BANKED {
 uint8_t *a=s->actor,*t=s->target,self,dual,hands,hand,row=0,inverted=0,hit[2]={0,0},stats[18],attack[5];
 uint8_t chance,evades,crit,death,consumed,i;uint16_t old_a,old_t,damage,net=0,power,hp,delta;Ff3Physical p;
 self=(a[44]&0x87)==(t[44]&0x87);if(self)t=a;
 if((a[44]&7)>=((a[44]&128)?8:4)||(t[44]&7)>=((t[44]&128)?8:4)||s->target_slot>7||
    (a[1]&0xc0)||(a[2]&1)||(t[1]&0xc0)||(t[2]&1)||!word(a+3)||!word(t+3)||
    s->running||((t[44]&128)&&t[56]==0x4f)||s->message_count>15)return 0;
 s->split_id=255;s->actual_hits[0]=s->actual_hits[1]=0;
 s->actor_status[0]=a[1];s->actor_status[1]=a[2];s->target_status[0]=t[1];s->target_status[1]=t[2];
 old_a=word(a+3);old_t=word(t+3);
 dual=!(a[44]&128)&&(((a[49]&0x81)==1&&(a[50]&0x81)==1)||!(a[49]|a[50]));hands=dual?2:1;
 for(i=0;i<10;i++)stats[i]=a[22+i];for(i=0;i<5;i++)stats[10+i]=t[32+i];for(i=0;i<3;i++)stats[15+i]=a[39+i];
 for(hand=0;hand<hands;hand++){
  for(i=0;i<5;i++)attack[i]=stats[hand*5+i];chance=attack[2];if(s->actor_status[0]&4)chance>>=1;
  if(!(a[51]&4)&&((a[44]&128)||!ranged(s,dual,hand))){if(a[51]&1)chance>>=1;if(t[51]&1){row++;chance>>=1;}}
  hit[hand]=ff3_physical_hits(rng,attack[1],chance);
  chance=stats[12];if(s->target_status[0]&4)chance>>=1;
  evades=ff3_physical_hits(rng,(s->target_status[0]&0x28)||t[39]?0:stats[11],chance);if(row)evades++;
  hit[hand]=hit[hand]<evades?0:hit[hand]-evades;
  if(!hit[hand]){a[39]=0;continue;}
  p.multiplier=(t[18]&attack[0])?4:(stats[10]==2||(stats[10]&attack[0]))?1:2;
  power=attack[3];if(!(a[44]&128))power+=(uint16_t)a[56]+a[57];
  p.defense=stats[13];if(!(t[44]&128)&&s->defending[t[44]&7])p.defense=p.defense>=128?255:p.defense*2;
  if(s->actor_status[0]&0x28)power=(power&0xff00)|1;
  if((s->target_status[0]&0x28)||t[39]){power<<=1;p.defense=0;}
  crit=random99(rng)<stats[16];if(crit)s->critical++;
  if(s->actor_status[0]&0x28){crit=0;s->critical=0;}
  p.attack=(uint8_t)power;p.attack_high=power>>8;p.critical=crit;p.critical_bonus=stats[17];p.hits=hit[hand];p.targets=1;p.attacker_flags=a[44];p.target_flags=t[44];
  ff3_physical_damage(rng,&p,&damage);if(crit)queue(s,0x34);
  if(a[39]){damage=(uint16_t)((uint32_t)damage*(uint8_t)(a[39]+1));a[39]=0;}if(!damage)damage=1;
  if(!(attack[0]&1)||!(t[18]&128)){net+=damage;if(net>=9999)net=9999;}
  death=0;
  if((attack[0]&1)&&!self){
   if(t[18]&128){inverted++;if(!subtract(s,a,damage))death=0x81;
    /* BD72 selects attacker; BD89 retains it for the quarter-HP restore.
     * Preserve that original behavior, not the disassembly's prose intent. */
    restore(a,a[46]==4?damage>>2:damage);
   }else{if(!subtract(s,t,damage))death=1;restore(a,a[46]==4?damage>>2:damage);}
  }else if(!subtract(s,t,damage))death=1;
  if(death){if(death&128)s->actor_status[0]|=128;else s->target_status[0]|=128;continue;}
  if(!(s->boss&128)&&!(a[1]&0x28)&&attack[4]&&!(stats[14]&attack[4])){
   chance=attack[2]<stats[12]?0:attack[2]-stats[12];if(ff3_physical_hits(rng,hit[hand],chance))status(s,a,t,attack[4]);
  }
 }
 s->actual_hits[0]=hit[0];s->actual_hits[1]=hit[1];s->animation_hits[0]=hit[0];s->animation_hits[1]=hit[1];
 if(!(hit[0]|hit[1])){put(s->target_number,0x4000);goto finish;}
 if(!self){hp=word(a+3);if(old_a>=hp){put(s->actor_number,old_a-hp);if((a[22]|a[27])&1)s->messages[s->message_count]=0x27;}
  else{put(s->actor_number,(hp-old_a)|0x8000);s->messages[s->message_count]=(a[44]&128)?0x26:0x25;}}
 consumed=s->messages[s->message_count]!=255;if(consumed)s->message_count++;
 if(!(word(s->actor_number)&0x7fff)){put(s->actor_number,0xffff);if(consumed)s->messages[--s->message_count]=255;}
 delta=inverted?(uint16_t)((word(t+3)-old_t)|0x8000):net;put(s->target_number,delta);
finish:
 if(!(a[44]&128)){
  if((a[49]&0x81)!=1&&!hit[1]){s->animation_hits[1]=hit[0];s->animation_hits[0]=0;}
  if(a[51]&4)s->animation_hits[0]=hit[0]+hit[1];
 }
 if(self){for(i=0;i<64;i++)s->target[i]=a[i];}return 1;
}
