#ifndef STATE_HOST
#pragma bank 16
#endif
#include "battle-ailment.h"
#include "battle-context.h"
#include <string.h>
/* 31/BBF3..BCD1. Keep priority, partial petrify, message-without-increment,
 * and confusion's command/flag changes. The original target mask is MSB first. */
void ff3_ailment_apply(Ff3Fight *s,uint8_t *a,uint8_t *t,uint8_t effect) FF3_STATE_BANKED {uint8_t n=0,v=effect,old;
 if(!(effect&1)){
  if(s->target_status[0]>=effect)goto ineffective;
  s->target_status[0]|=effect;while(!(v&128)){v<<=1;n++;}if(n>=2)n+=3;
  s->status_message=n+10;return;
 }
 if((effect&32)&&(s->boss&128))goto ineffective;
 old=s->target_status[1];
 if(effect&6){
  n=effect&0x7e;if(n+(old&6)<8){s->target_status[1]=old+n;if(a[46]==4)s->messages[s->message_count++]=0x3c;return;}
  s->target_status[1]=old&0xf9;s->target_status[0]|=0x40;s->status_message=0x0b;s->messages[s->message_count]=0x28;return;
 }
 if((old&0xe0)>=(effect&0xe0))goto ineffective;
 s->target_status[1]=(effect&0xfe)|(old&7);
 if(s->target_status[1]&32){t[46]=0;t[44]&=0xe7;}
 while(!(v&128)){v<<=1;n++;}s->status_message=n+12;return;
ineffective:s->target_mask&=(uint8_t)~(128u>>s->target_slot);
}
/* 31/B7F1..B874. Do not OR a cure back into the old staged status. */
void ff3_ailment_remove(Ff3Fight*s,uint8_t*a,uint8_t*t,uint8_t mask) FF3_STATE_BANKED {
 uint8_t n=0,v=mask;
 if(!(mask&1)){
  if(!(t[1]&mask))goto ineffective;
  t[1]&=(uint8_t)~mask;s->target_status[0]=t[1];
  if(a[44]==t[44])s->actor_status[0]=t[1];
  while(!(v&128)){v<<=1;n++;}if(n>=2)n+=3;s->status_message=n;return;
 }
 if(!(t[1]|t[2]))goto ineffective;
 if(mask==255){t[1]&=128;t[2]=0;}else{t[1]&=191;t[2]&=249;}
 s->target_status[0]=s->target_status[1]=0;
 if(a[44]==t[44])s->actor_status[0]=s->actor_status[1]=0;
 return;
ineffective:s->target_mask&=(uint8_t)~(128u>>s->target_slot);
}
/* 31/B3CF: Esuna's stone+confusion exception is NOT a universal immunity. */
void ff3_ailment_cure(Ff3Fight*s,uint8_t*a,uint8_t*t,uint8_t mask) FF3_STATE_BANKED {
 if(mask==255&&(s->target_status[0]&64)&&(s->target_status[1]&32)){
  s->target_mask&=(uint8_t)~(128u>>s->target_slot);return;
 }
 ff3_ailment_remove(s,a,t,mask);
}
void ff3_ailment_toggle(Ff3Fight*s,uint8_t*t,uint8_t mask) FF3_STATE_BANKED {
 uint8_t old=t[1],v=old^mask;t[1]=v;s->target_status[0]=(v&40)?v|mask:0;
 if(v&32){if(!(old&32))s->status_message=15;}
 else if(v&8){if(!(old&8))s->status_message=17;}
 else if(old&32)s->status_message=5;
 else if(old&8)s->status_message=7;
}
void ff3_ailment_revive(FF3BattleRng*rng,Ff3Fight*s,uint8_t*a,uint8_t*t,uint8_t strength) FF3_STATE_BANKED {
 uint8_t n;uint16_t hp,max,amount,old;
 if(!(s->target_status[0]&128)){s->target_mask&=(uint8_t)~(128u>>s->target_slot);return;}
 ff3_ailment_remove(s,a,t,128);s->status_message=0;
 max=t[5]|((uint16_t)t[6]<<8);
 if(strength==255)amount=max;
 else{do{ff3_battle_random(rng,1,0,9,&n);}while(!n);amount=n;}
 old=t[3]|((uint16_t)t[4]<<8);hp=old+amount;if(hp>max){hp=max;amount=hp-old;}
 t[3]=(uint8_t)hp;t[4]=hp>>8;
 s->target_number[0]=(uint8_t)amount;s->target_number[1]=(amount>>8)|128;
}
uint8_t ff3_ailment_poison(uint8_t*r,uint8_t*number) FF3_STATE_BANKED {
 uint8_t active=(r[1]&2)&&!(r[1]&192);uint16_t hp=r[3]|((uint16_t)r[4]<<8),damage;
 if(active){
  damage=(r[5]|((uint16_t)r[6]<<8))>>4;number[0]=(uint8_t)damage;number[1]=damage>>8;
  hp=hp<damage?0:hp-damage;r[3]=(uint8_t)hp;r[4]=hp>>8;
 }
 if(!hp)r[1]=(r[1]|128)&254;
 return active;
}
void ff3_ailment_enter(uint8_t*r,const uint8_t*c) FF3_STATE_BANKED {
 uint8_t i;memset(r,0,64);r[0]=c[1];r[1]=c[2];memcpy(r+3,c+12,4);r[15]=c[16];
 for(i=0;i<8;i++)r[7+i]=c[48+i*2];
}
void ff3_ailment_leave(const uint8_t*r,uint8_t*c) FF3_STATE_BANKED {
 uint8_t i;c[2]=r[1]&254;c[12]=r[3];c[13]=r[4];for(i=0;i<8;i++)c[48+i*2]=r[7+i];
}
uint8_t ff3_ailment_recover(FF3BattleRng*rng,uint8_t*r,uint8_t*staged,uint8_t*message) FF3_STATE_BANKED {
 uint8_t v=r[2],chance,n,base=94,index=0;
 if((r[1]&192)||!(v&192))return 0;
 staged[1]=v;chance=((r[44]&128)?r[0]:r[43])+50;
 ff3_battle_random(rng,1,0,100,&n);
 if(n<chance){
  if(((v&24)-8)&24){v-=8;staged[1]=r[2]=v;}
  else{staged[1]=r[2]=v&7;base=84;}
 }
 while(!(v&128)){v<<=1;index++;}*message=base+index;return 1;
}
/* 34/9D1D + 2F/B607,B5F2,B651. Graphics is a required asset kind, not a
 * substitute drawing. Stone uses the existing background rendering path. */
void ff3_status_normalize(uint8_t a,uint8_t b,uint8_t*out) FF3_STATE_BANKED {
 out[0]=(a&0xc0)|((b&0xe0)>>2)|((a&0x3f)>>3);out[1]=(a&7)<<5;
}
uint8_t ff3_status_icon(uint8_t a,uint8_t b) FF3_STATE_BANKED {
 uint8_t n,icon=0;if(a&192)return 255;
 n=((a&7)|((a&16)>>1))<<1;n|=b&224;if(b&6)n|=1;if(!n)return 255;
 while(!(n&128)){n<<=1;icon++;}return icon;
}
void ff3_status_view(Ff3StatusView *s) FF3_STATE_BANKED {
 uint8_t a=s->raw[0],b=s->raw[1],small;
 ff3_status_normalize(a,b,s->normalized);s->icon=ff3_status_icon(a,b);
 a=s->normalized[0];b=s->normalized[1];small=a&5;
 s->pose=(a&128)?(small?16:9):(a&64)?0:((a&0x32)||b)?(small?12:3):small?11:2;
 if((a&8)&&!(b&1))s->pose|=128;
 s->graphics=small?((a&4)?2:3):(a&128)?1:0;s->stone=(a&0xc0)==0x40;
}
