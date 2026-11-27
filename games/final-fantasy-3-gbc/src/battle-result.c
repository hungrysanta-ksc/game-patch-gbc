#ifndef STATE_HOST
#ifdef FF3_SCENE_LAYOUT
#pragma bank 118
#else
#pragma bank 15
#endif
#endif
#include "battle-result.h"
#include <string.h>
static void status(Ff3BattleResult*s,const uint8_t*p,uint8_t enemy){
 uint8_t i,n=enemy?8:4,*r,v;
 for(i=0;i<n;i++){
  r=s->records[i+(enemy?4:0)];v=r[1]|p[i*2];r[1]=v;
  if(enemy){
   /* 34/9422 masks before OR: preserve this loss of other bits. */
   if(v&0xe8){v=(v&0xe8)|0x80;r[1]=s->dead[i]=v;}
   r[2]|=p[i*2+1];
  }else if(v&0x80)r[1]&=0xfe;
  else r[2]|=p[i*2+1];
 }
}
uint8_t ff3_result_status(Ff3BattleResult*s,uint8_t cannon) FF3_STATE_BANKED {
 uint8_t i,*r;uint16_t hp,max;
 if(cannon>1)return 0;
 if(cannon){status(s,s->target_status,1);return 1;}
 if(s->result&2)return 1;
 if(s->actor>=12)return 0;
 if(s->actor<4){
  if(s->target&0x80){status(s,s->actor_status,0);status(s,s->target_status,1);}
  else{status(s,s->target_status,0);status(s,s->actor_status,0);}
 }else{
  if(s->target&0x80){status(s,s->actor_status,1);status(s,s->target_status,1);}
  else{status(s,s->target_status,0);status(s,s->actor_status,1);}
 }
 for(i=0;i<4;i++){
  r=s->records[i];if(r[1]&0x80)continue;
  hp=r[3]|((uint16_t)r[4]<<8);max=r[5]|((uint16_t)r[6]<<8);
  if(hp<=(max>>2)){r[1]|=1;s->near|=0x80>>i;}
  else{r[1]&=0xfe;s->near&=~(0x80>>i);}
 }
 return 1;
}
void ff3_result_check(Ff3BattleResult*s) FF3_STATE_BANKED {
 uint8_t i;if(s->result&2)return;
 for(i=0;i<4;i++)if(!(s->records[i][1]&0xc0))break;
 if(i==4)s->result=0x80;else if(!s->remaining)s->result=0x40;
}
uint8_t ff3_result_run(Ff3BattleResult*s,FF3BattleRng*rng,uint8_t escape) FF3_STATE_BANKED {
 uint8_t i,n=0,chance,draw,*a;uint16_t sum=0;
 if(s->actor>=12||escape>1||(escape&&s->actor>=4))return 0;
 if(!escape&&s->actor<4){for(i=0;i<8;i++)if(s->types[i]!=255){sum+=s->records[i+4][0];n++;}if(!n)return 0;}
 a=s->records[s->actor];s->script=1;s->name=escape?0x40:0x3f;s->target_name=255;
 if(!escape){
  if(s->actor>=4)chance=a[34];
  else{chance=(uint8_t)(a[42]+25);sum/=n;chance=chance<sum?0:chance-(uint8_t)sum;}
  ff3_battle_random(rng,1,0,100,&draw);
  if(draw>=chance&&(s->actor>=4||!(s->first&1))){s->message=0x1f;return 1;}
  if(s->actor>=4){i=s->actor-4;s->message=0x1e;s->actor_status[i*2]|=128;s->escape=0x80>>i;return 1;}
 }
 /* A966 branches to A954, which stores the incremented slot on EACH pass. */
 if(s->flags&1){s->message=0x1f;return 1;}
 for(i=0;i<4;i++)if(s->records[i][2]&0x20){s->message=0x1f;return 1;}
 s->message=0x1e;s->result=2;s->escape=0xf0;return 1;
}
uint8_t ff3_result_attack(Ff3BattleResult*s,FF3BattleRng*rng,Ff3Fight*f,uint8_t target) FF3_STATE_BANKED {
 uint8_t a=s->actor;
 if(a>=12||target>=12)return 0;
 if((s->records[a][44]&0x87)!=(a<4?a:0x80+a-4)
  ||(s->records[target][44]&0x87)!=(target<4?target:0x80+target-4)
  ||(s->records[a][48]&0x80)!=(target<4?0:0x80)
  ||f->target_slot!=(target<4?target:target-4))return 0;
 memcpy(f->actor,s->records[a],64);memcpy(f->target,s->records[target],64);
 if(!ff3_fight_resolved(rng,f))return 0;
 memcpy(s->records[a],f->actor,64);memcpy(s->records[target],f->target,64);
 memset(s->actor_status,0,32);
 memcpy(s->actor_status+(a<4?a:a-4)*2,f->actor_status,2);
 memcpy(s->target_status+(target<4?target:target-4)*2,f->target_status,2);
 s->target=f->actor[48];return 1;
}
