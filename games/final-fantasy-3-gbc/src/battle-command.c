#ifndef STATE_HOST
#pragma bank 119
#endif
#include "battle-command.h"
#include "battle-context.h"
#include <string.h>
static uint8_t slot(uint8_t id){return id<4?id:id-4;}
static uint8_t name(uint8_t id){return id<4?id:128+id-4;}
static void display(const Ff3BattleResult*s,uint8_t*out){uint8_t i;for(i=0;i<4;i++)ff3_status_normalize(s->records[i][1],s->records[i][2],out+i*2);}
uint8_t ff3_command_execute(Ff3BattleResult*s,FF3BattleRng*rng,Ff3Fight*f,Ff3BattleCommand*c) FF3_STATE_BANKED {
 uint8_t a=s->actor,t,i,mask,cmd,*r,*target,v,hits;
 if(a>=12||s->result)return 0;r=s->records[a];cmd=r[46];mask=r[47];
 if((r[44]&135)!=name(a)||r[44]&24||r[2]&193||r[1]&192)return 0;
 if(cmd!=4&&cmd!=5&&cmd!=6&&cmd!=7)return 0;
 if(cmd==7&&a>=4)return 0;
 if(cmd==5&&a>=4)return 0;
 if(cmd==6&&a<4){for(i=0;i<8&&s->types[i]==255;i++);if(i==8)return 0;}
 /* 9E93 selects the first mask bit; unresolved or all-target physical
  * commands belong to the retarget caller, never an arbitrary target. */
 if(!mask||(mask&(mask-1))||(r[48]&127))return 0;
 for(t=0;!(mask&(128>>t));t++);if(!(r[48]&128)&&t>=4)return 0;
 t+=(r[48]&128)?4:0;target=s->records[t];
 if(cmd==4){
  if((target[44]&135)!=name(t)||(target[1]&192)||(target[2]&1)||!(target[3]|target[4])||!(r[3]|r[4])||((target[44]&128)&&target[56]==79))return 0;
  if(a>=4&&t<4&&(s->near&mask))return 0; /* Knight cover needs the party job owner. */
  if(a<4&&((r[49]|r[50])&4||f->equipment[0]==65||f->equipment[1]==65))return 0;
 }
 memset(c,0,sizeof(*c));c->effect=cmd;c->attacker=name(a);c->target=name(t);c->flags=(a>=4?128:0)|(t>=4?64:0);c->mask=c->hit=mask;c->name=c->sub_name=255;
 memset(s->actor_status,0,32);s->escape=0;s->target=r[48];
 memset(f->messages,255,20);f->message_count=0;f->critical=0;f->actual_hits[0]=f->actual_hits[1]=f->animation_hits[0]=f->animation_hits[1]=0;
 memset(f->target_number,255,4);f->split_id=f->status_message=255;
 s->script=1;
 if(cmd==5){c->target=255;c->name=62;v=r[35];f->defending[a]=v;r[35]=v>=128?255:v*2;return 1;}
 if(cmd>=6){if(!ff3_result_run(s,rng,cmd==7))return 0;c->name=s->name;c->target=s->target_name;f->messages[0]=s->message;return 1;}
 f->target_slot=slot(t);f->target_mask=mask;
 if(!ff3_result_attack(s,rng,f,t))return 0;
 c->hit=f->target_mask;c->sub_name=f->status_message;
 /* A1AC..A212 chooses visible weapons separately from damage equipment. */
 if(a<4&&!(r[1]&40)){
  c->weapons[0]=f->equipment[0];c->weapons[1]=f->equipment[1];
  if(c->weapons[0]){if(c->weapons[0]>=88)c->weapons[0]=0;if(c->weapons[1]){if(c->weapons[1]>=88)c->weapons[1]=0;}else if(c->weapons[0]>=74)c->weapons[0]=0;}
  else if(c->weapons[1]>=74)c->weapons[1]=0;
 }
 /* A229 is an eight-bit ADC before the 32-hit clamp. */
 hits=f->actual_hits[0]+f->actual_hits[1];c->name=hits<33?hits:32;
 if(c->name&&!(f->target_status[0]&128)&&(f->target_status[1]&24)){
  v=((f->target_status[1]&24)-8)&24;
  if(v){f->target_status[1]-=8;target[2]=f->target_status[1];}
  else{
   v=f->target_status[1];f->target_status[1]&=7;target[2]=f->target_status[1];
   if(a==t){f->actor_status[1]=f->target_status[1];r[2]=target[2];}
   for(i=0;!(v&128);i++)v<<=1;c->sub_name=i+2;
   target[44]&=231;target[46]=0;
  }
 }
 if(f->target_status[0]&128)f->messages[f->message_count]=t<4?26:27;
 s->script=0;memcpy(s->actor_status+slot(a)*2,f->actor_status,2);memcpy(s->target_status+slot(t)*2,f->target_status,2);
 f->status_message=c->sub_name;memcpy(f->actor,r,64);memcpy(f->target,target,64);
 return 1;
}
void ff3_command_script(const Ff3BattleResult*s,const Ff3Fight*f,const Ff3BattleCommand*c,Ff3ActionScript*out,uint8_t speed) FF3_STATE_BANKED {
 memset(out,0,sizeof(*out));out->script=s->script;out->effect=c->effect;out->speed=speed;out->result=s->result;
 out->names[0]=c->attacker;out->names[1]=c->name;out->names[2]=c->target;out->names[3]=c->sub_name;memcpy(out->messages,f->messages,10);
}
void ff3_command_animation(const Ff3BattleResult*s,const Ff3Fight*f,const Ff3BattleCommand*c,Ff3Animation*out,uint8_t layout) FF3_STATE_BANKED {
 memset(out,0,sizeof(*out));out->effect=c->effect;out->flags=c->flags;out->escape=s->escape;out->split=f->split_id;out->layout=layout;
 out->attacker=128>>slot(s->actor);out->targets=c->mask;out->hit=c->hit;memcpy(out->hits,f->animation_hits,2);
 display(s,out->previous);memcpy(out->status,out->previous,8);memcpy(out->dead,s->dead,8);memcpy(out->types,s->types,8);memset(out->numbers,255,32);
 if(c->target!=255)memcpy(out->numbers+(c->target&7)*2,f->target_number,2);
 memcpy(out->numbers+16+slot(s->actor)*2,f->actor_number,2);
}
uint8_t ff3_command_commit(Ff3BattleResult*s,Ff3Animation*out,uint8_t cannon) FF3_STATE_BANKED {
 if(!ff3_result_status(s,cannon))return 0;
 if(!cannon)display(s,out->status);
 memcpy(out->dead,s->dead,8);memcpy(out->types,s->types,8);return 1;
}
