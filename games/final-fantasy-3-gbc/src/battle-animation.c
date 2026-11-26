#ifndef STATE_HOST
#pragma bank 47
#endif
#include "battle-animation.h"
#include "battle-animation-assets.h"
#include <string.h>
typedef char animation_abi[(sizeof(Ff3Animation)==109)?1:-1];
enum {END=1,MAGIC,MAGIC_POST,NUMBER_SECOND,NUMBER_SPLIT,DEATH_SECOND,FIGHT,FIGHT_HIT,INEFFECTIVE,RUN};
static void finish(Ff3Animation*s){s->request=255;s->done=1;s->stage=0;}
static void issue(Ff3Animation*s,uint8_t id,uint8_t stage){s->request=id;s->stage=stage;s->ticket++;}
/* 86AB scans with 8-bit Y; a complete miss falls through with Y=0. */
static uint8_t id(Ff3Animation*s,uint8_t mask){(void)s;return ff3_anim_ids[mask];}
static void actor(Ff3Animation*s){s->actor=id(s,s->attacker);}
static void flash(Ff3Animation*s,uint8_t next){s->flash_mask=s->attacker;s->flash_palette=3;issue(s,31,next);}
static uint8_t dead_mask(Ff3Animation*s){uint8_t i,m=0;for(i=0;i<8;i++)m=(m<<1)|(s->dead[i]>>7);return m;}
static void party_death(Ff3Animation*s,uint8_t next){if(memcmp(s->previous,s->status,8))issue(s,7,next);else if(next==END)finish(s);}
static void monster_death(Ff3Animation*s,uint8_t next){uint8_t i;
 for(i=0;i<8;i++){if((s->dead[i]&128)?s->types[i]!=255:s->types[i]==255){s->mask=dead_mask(s);if(!(s->dead[i]&128))s->mask^=255;issue(s,s->dead[i]&128?10:11,next);return;}}
 if(next==END)finish(s);
}
static void magic(Ff3Animation*s){actor(s);s->magic_targets=s->targets;issue(s,29,MAGIC_POST);}
static void magic_begin(Ff3Animation*s){s->sound=ff3_anim_sounds[s->spell];s->sound_pending=0;if(s->flags&128)flash(s,MAGIC);else magic(s);}
static void fight(Ff3Animation*s){
 if(s->flags&128){if(s->target_enemy){s->target=id(s,s->targets);issue(s,32,END);}else{s->actor=id(s,s->targets);issue(s,20,END);}}
 else {actor(s);if(s->target_enemy){s->target=id(s,s->targets);issue(s,18,END);}else{s->party_vs=1;s->saved[0]=s->hits[0];s->saved[1]=s->hits[1];s->hits[0]=s->hits[1]=0;issue(s,18,FIGHT_HIT);}}
}
static void run(Ff3Animation*s){if(!s->escape)finish(s);else if(s->flags&128){s->mask=s->escape;issue(s,13,END);}else issue(s,33,END);}
uint8_t ff3_animation_start(Ff3Animation*s) FF3_STATE_BANKED {uint8_t i,kind;uint16_t rows;
 if(s->ticket||s->done||s->error||s->effect>=25||s->summon>1||s->spell>=88||s->layout>=10)return 0;
 for(i=0;i<8;i++)if(s->types[i]>3&&s->types[i]!=255)return 0;
 s->target_enemy=(s->flags>>6)&1;s->animation=kind=ff3_anim_actions[s->effect];if(kind==1)s->animation=kind+=s->summon;
 switch(kind){
 case 0:s->party_vs=0;(void)id(s,s->attacker);if(s->flags&128)flash(s,FIGHT);else fight(s);break;
 case 1:magic_begin(s);break;
 case 2:rows=((uint16_t)ff3_anim_rows[s->layout*2]<<8)|ff3_anim_rows[s->layout*2+1];for(i=0;i<8;i++)s->rows[i]=s->types[i]==255?255:(rows>>((7-i)*2))&3;actor(s);s->target=id(s,s->targets);s->summon_id=s->summon_attack>>4;s->summon_kind=s->summon_attack&15;issue(s,30,END);break;
 case 3:finish(s);break;
 case 4:case 5:case 6:case 7:case 10:case 11:actor(s);issue(s,kind==4?4:kind==5?3:kind==6?21:kind==7?24:kind==10?26:27,END);break;
 case 8:actor(s);s->target=id(s,s->targets);issue(s,25,END);break;
 case 9:actor(s);issue(s,22+s->overload,END);break;
 case 12:issue(s,36,END);break;
 case 13:if(s->flags&128)flash(s,RUN);else run(s);break;
 case 14:s->request=255;if(s->flags&128)party_death(s,DEATH_SECOND);else monster_death(s,DEATH_SECOND);if(s->request==255){if(s->flags&128)monster_death(s,END);else party_death(s,END);}break;
 case 15:issue(s,28,NUMBER_SECOND);break;
 case 16:s->item++;if(s->flags&128)flash(s,INEFFECTIVE);else{s->hit=s->spell=s->magic=0;magic_begin(s);}break;
 default:s->error=1;break;
 }return 1;
}
uint8_t ff3_animation_ack(Ff3Animation*s,uint16_t ticket) FF3_STATE_BANKED {uint8_t stage=s->stage;
 if(s->done||s->error||s->request==255||!stage||ticket!=s->ticket)return 0;
 switch(stage){
 case END:finish(s);break;
 case MAGIC:magic(s);break;
 case MAGIC_POST:
  if(s->animation==16){s->item=0;finish(s);break;}
  if(!(s->flags&64)){finish(s);break;}
  if(s->magic==6&&s->targets!=255){s->mask=s->targets;issue(s,12,END);}
  else if(s->magic==7){s->flash_mask=s->hit;s->flash_palette=3;issue(s,34,END);}
  else if((s->magic==8||s->magic==13)&&s->hit){s->target=id(s,s->hit);s->mask=s->hit;issue(s,35,END);}
  else finish(s);break;
 case NUMBER_SECOND:s->target_enemy=(s->flags>>7)&1;memcpy(s->numbers,s->numbers+16,16);issue(s,28,NUMBER_SPLIT);break;
 case NUMBER_SPLIT:if(s->split<128){s->mask=s->split;issue(s,12,END);}else finish(s);break;
 case DEATH_SECOND:if(s->flags&128)monster_death(s,END);else party_death(s,END);break;
 case FIGHT:fight(s);break;
 case FIGHT_HIT:s->actor=id(s,s->targets);s->hits[0]=s->saved[0];s->hits[1]=s->saved[1];if(s->hits[0]|s->hits[1])issue(s,20,END);else finish(s);break;
 case INEFFECTIVE:s->item=0;finish(s);break;
 case RUN:run(s);break;
 default:return 0;
 }return 1;
}
