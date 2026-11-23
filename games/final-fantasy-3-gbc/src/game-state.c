#ifndef STATE_HOST
#pragma bank 10
#endif
#include <string.h>
#include "game-state.h"
#include "state-assets.h"

void ff3_state_init(uint8_t *s) FF3_STATE_BANKED {
 uint8_t i,c;
 /* 3A/8E76..8F3F, before message speed and name-entry menu. */
 memset(s,0,FF3_STATE_BYTES);s[9]=0x29;s[10]=0x2f;
 memset(s+0x40,0xff,64);memcpy(s+0x80,ff3_initial_npcs,64);
 for(i=2;i<7;i++){s[0x110+i]=ff3_initial_job[i];s[0x115+i]=ff3_initial_job[i];}
 for(i=0;i<8;i++){s[0x130+i*2]=ff3_initial_mp[i];s[0x131+i*2]=ff3_initial_mp[i];}
 memcpy(s+0x10c,ff3_initial_hp,2);memcpy(s+0x10e,ff3_initial_hp,2);
 memcpy(s+0x11c,ff3_initial_stats,20);memcpy(s+0x200,ff3_initial_equipment,16);
 memset(s+0x106,0xff,6);
 for(c=1;c<4;c++){memcpy(s+0x100+(uint16_t)c*64,s+0x100,64);memcpy(s+0x200+(uint16_t)c*64,s+0x200,64);}
}
void ff3_state_seal(uint8_t *s,const uint8_t *p) FF3_STATE_BANKED {
 uint16_t i;uint8_t sum=0;s[8]=p[0];s[15]=p[1];s[9]=p[2];s[10]=p[3];s[0x1a]=0;s[0x19]=0x5a;
 for(i=0;i<FF3_STATE_BYTES;i++)sum+=s[i];s[0x1a]=sum^0xff;
}
uint8_t ff3_state_valid(const uint8_t *s) FF3_STATE_BANKED {
 uint16_t i;uint8_t sum=0;if(s[0x19]!=0x5a)return 0;
 for(i=0;i<FF3_STATE_BYTES;i++)sum+=s[i];return sum==0xff;
}
void ff3_save_menu_prepare(uint8_t *s,uint8_t *counter,const uint8_t *p) FF3_STATE_BANKED {
 if(counter[0]!=0x55||counter[1]!=0xaa){counter[0]=0x55;counter[1]=0xaa;counter[2]=1;}
 s[0x14]=counter[2];ff3_state_seal(s,p);
}
void ff3_save_count_commit(uint8_t *counter) FF3_STATE_BANKED {
 uint8_t value=(uint8_t)(counter[2]+1);counter[2]=value>=100?1:value;
}
uint8_t ff3_field_random(FF3FieldRng *r) FF3_STATE_BANKED {
 /* 3E/C711: decrement wraps 0 -> FF without direction change; change on 1 -> 0. */
 r->index+=(r->direction&0x80)?(uint8_t)0xff:1;
 if(!r->index)r->direction+=0xa0;
 return ff3_field_rng_table[r->index];
}
void ff3_battle_seed(FF3BattleRng *r,const uint8_t *zp,uint8_t a,uint8_t carry) FF3_STATE_BANKED {
 uint16_t i,sum,value=1;uint8_t multiplier;
 /* ADC chain at FC29 includes incoming A and C, including the last overflow. */
 for(i=0;i<256;i++){sum=(uint16_t)a+zp[i]+carry;a=(uint8_t)sum;carry=(uint8_t)(sum>>8);}
 r->counter[0]=r->counter[1]=r->counter[2]=a;multiplier=(a&2)+3;
 for(i=0;i<256;i++){value=(value*multiplier)&1023;if(value>512)value=1024-value;r->table[i]=(uint8_t)(value>>1);}
}
uint8_t ff3_battle_random(FF3BattleRng *r,uint8_t selector,uint8_t lower,uint8_t upper,uint8_t *result) FF3_STATE_BANKED {
 uint8_t random,delta;uint32_t product;
 if(selector>=3)return 0;
 /* FBEF..FC26: preserve early-return order and 8-bit reversed-range wrapping. */
 if(lower==255){*result=255;return 1;}if(!upper||upper==lower){*result=upper;return 1;}
 delta=(uint8_t)(upper-lower);random=r->table[r->counter[selector]++];
 product=(uint32_t)delta*(((uint16_t)random<<8)|128u);
 *result=(uint8_t)(lower+(uint8_t)(product>>16)+((product&0x8000ul)?1:0));return 1;
}
