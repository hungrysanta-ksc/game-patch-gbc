#ifndef STATE_HOST
#pragma bank 16
#endif
#include "battle-context.h"
/* FA26 -> FB17/FB87 -> 2E/9E8E..9F28 -> FC27..FC2E.
 * Apply the 27 source DP writes without allocating a second 256-byte image.
 * 9F98 leaves A=0; carry comes from the vehicle/flags comparisons at 9EAF.
 * Keep all 229 inherited bytes, including live sound scratch D0..DF.
 * The final carry is NOT folded back after the last source ADC. */
uint8_t ff3_encounter_seed(const uint8_t *dp,uint8_t flags) FF3_STATE_BANKED {
 static const uint8_t low[18]={0,0,0,0x97,0x10,0,0x88,0x88,0x99,0,0,0,0,0,0,0,0,0};
 uint8_t i=0,v,a=0,carry=dp[0x46]>=4&&flags>=4;uint16_t sum;
 do{
  v=dp[i];
  if(i<18&&i!=2)v=low[i];
  else if(i==0x7e)v=flags;
  else if(i==0xab)v=0x17;
  else if((i>=0xa9&&i<=0xac)||i==0xb8||(i>=0xc9&&i<=0xcc))v=0;
  sum=(uint16_t)a+v+carry;a=(uint8_t)sum;carry=sum>>8;
 }while(++i);
 return a;
}
static uint8_t random(FF3BattleRng *r,uint8_t upper){uint8_t n;ff3_battle_random(r,1,0,upper,&n);return n;}
/* FC92 returns a zero quotient when both sum and divisor are zero. */
static uint8_t average(const uint8_t *p,uint8_t n){uint16_t sum=0;uint8_t count=0;while(n--){if(*p){sum+=*p;count++;}p++;}return count?(uint8_t)(sum/count):0;}
/* 34/87BE..88E0: vehicle precedes surprise RNG; original zero levels are
 * excluded from the average, regardless of a member's alive/dead state. */
void ff3_entry_rules(FF3BattleRng *rng,Ff3Entry *s) FF3_STATE_BANKED {
 uint8_t a,b,as,bs,i;s->flags&=0xbf;if(s->world)s->flags|=16;if(s->vehicle==7)s->flags|=64;
 if(s->flags&2)s->special++;s->flags=(s->flags>>1)|(s->flags<<7);s->formation=s->first=0;
 if(s->flags&0xa0)return;
 a=average(s->levels,4);as=1+(random(rng,100)<a);b=average(s->levels+4,8);bs=1+(random(rng,100)<b);
 if(as==bs)return;if(as>bs){s->first=1;return;}
 if(random(rng,a)<(b>>2)){for(i=0;i<4;i++){s->equipment_rows[i]^=1;s->battle_rows[i]^=1;}s->formation=s->first=0x88;}
 else s->formation=s->first=0x80;
}
/* 34/9D1D + 2F/B607,B5F2,B651. Graphics is a required asset kind, not a
 * substitute drawing. Stone uses the existing background rendering path. */
void ff3_status_view(Ff3StatusView *s) FF3_STATE_BANKED {
 uint8_t a=s->raw[0],b=s->raw[1],n,small;
 s->normalized[0]=(a&0xc0)|((b&0xe0)>>2)|((a&0x3f)>>3);s->normalized[1]=(a&7)<<5;
 s->icon=255;if(!(a&0xc0)){n=((a&7)|((a&16)>>1))<<1;n|=b&0xe0;if(b&6)n|=1;if(n){s->icon=0;while(!(n&128)){n<<=1;s->icon++;}}}
 a=s->normalized[0];b=s->normalized[1];small=a&5;
 s->pose=(a&128)?(small?16:9):(a&64)?0:((a&0x32)||b)?(small?12:3):small?11:2;
 if((a&8)&&!(b&1))s->pose|=128;
 s->graphics=small?((a&4)?2:3):(a&128)?1:0;s->stone=(a&0xc0)==0x40;
}
/* 35/A487..A50A. Keep the original underflow and equality behavior: an
 * exact-zero result does not set dead here; final death processing is later. */
void ff3_cannon_prepare(FF3BattleRng *rng,Ff3Cannon *s) FF3_STATE_BANKED {
 uint8_t i,*p;uint16_t hp,damage,result;for(i=0;i<32;i++){s->numbers[i]=255;s->status[i]=0;}s->effect=0x15;
 for(i=0;i<8;i++){p=s->monsters+(uint16_t)i*64;if(p[1]&128)continue;
  damage=250u+random(rng,62);s->numbers[i*2]=(uint8_t)damage;s->numbers[i*2+1]=damage>>8;
  hp=p[3]|((uint16_t)p[4]<<8);result=hp-damage;p[3]=(uint8_t)result;p[4]=result>>8;
  if(hp<damage){p[1]=128;s->status[i*2]=128;}
 }s->side=64;
}
/* 31/A300..A367, including the original four-slot exhaustion test even
 * for an eight-enemy pool and slot 4's alias of the exhausted marker. */
uint8_t ff3_retarget(FF3BattleRng *rng,Ff3Retarget *s) FF3_STATE_BANKED {
 uint8_t n,seen=0,failed=0,start=rng->counter[1];uint16_t attempts;
 if(s->limit!=3&&s->limit!=7)return 0;
 for(attempts=0;attempts<256;attempts++){
  n=random(rng,s->limit);
  if(!(s->status[n*2]&0xc0)&&!(s->status[n*2+1]&1)){
   s->selected=n;s->failed=failed;s->name=s->flags[n]&0x87;s->mask=s->visual=128u>>n;return 1;
  }
  if(n<4)seen|=1u<<n;else if(n==4)failed=1;
  if(seen==15){s->selected=n;s->failed=failed+1;return 1;}
 }
 rng->counter[1]=start;return 0;
}
/* 31/BF53..BFF9. New record/status reservation only; monster graphics and
 * type bookkeeping are consumed later by the action script, not invented here. */
uint8_t ff3_split_prepare(Ff3Split *s) FF3_STATE_BANKED {
 uint8_t *t,*a=s->actor,n,i,old;uint16_t at;
 if(s->target>7||s->message_count>=20)return 0;t=s->monsters+(uint16_t)s->target*64;
 if((t[44]&7)!=s->target)return 0;
 if(!(t[44]&128)||(s->status[s->target*2]&0xe8)||(s->status[s->target*2+1]&0xe0)||t[56]!=79||!(s->hits[0]|s->hits[1]))return 1;
 if(a[49]&&!(a[49]&128)){
  if(a[22]&2){if(!a[50]||(a[50]&128)||(a[27]&2))return 1;}
 }else if(a[50]&&!(a[50]&128)&&(a[27]&2))return 1;
 for(n=0;n<6;n++)if(s->types[n]==255)break;if(n==6)return 1;
 old=t[44]&7;if(old!=s->target)return 0;
 s->dead[n]=0;s->status[n*2]=0;s->remove_mask&=(uint8_t)~(128u>>s->target);s->split_id=s->types[old];
 at=(uint16_t)n*64;for(i=0;i<64;i++)s->monsters[at+i]=t[i];
 s->monsters[at+44]=128|n;s->monsters[at+46]=0;s->monsters[at+1]=s->monsters[at+2]=0;s->messages[s->message_count]=0x6f;return 1;
}
