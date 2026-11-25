#ifndef STATE_HOST
#pragma bank 16
#endif
#include "battle-entry-tail.h"
#include "battle-entry-tail-assets.h"
typedef char tail_abi[(sizeof(Ff3EntryTail)==75)?1:-1];
static uint8_t kind(uint8_t a){return (a&5)?((a&4)?2:3):(a&128)?1:0;}
static void pose(Ff3EntryTail*s){uint8_t i=s->actor,a=s->motion.status[i],b=s->status2[i],small=a&5;
 s->motion.pose[i]=(a&128)?(small?16:9):(a&64)?0:((a&0x32)||b)?(small?12:3):small?11:2;
 if((a&8)&&!(b&1))s->motion.pose[i]|=128;
}
static void canonical(Ff3EntryTail*s){uint8_t i;for(i=0;i<4;i++)s->motion.x[i]=s->motion.destination[i]=ff3_tail_rows[s->motion.rows[i]&1];s->phase=FF3_TAIL_CANONICAL;}
static void after_load(Ff3EntryTail*s){uint8_t i=s->actor;
 s->chunk&=191; /* private bit 6: B3F6 backward movement, not boss work */
 if((s->motion.status[i]&8)&&s->motion.x[i]!=0xb0){s->motion.confused_position[i]++;s->motion.destination[i]=0xb0;s->motion.frame=0;ff3_entry_motion(&s->motion);s->phase=FF3_TAIL_MOVE;}
 else if(!(s->motion.status[i]&8)&&s->motion.x[i]==0xb0){s->chunk|=64;s->motion.status[i]|=8;s->motion.destination[i]=ff3_tail_rows[s->motion.rows[i]&1];s->motion.frame=0;ff3_entry_motion_direction(&s->motion,1);s->phase=FF3_TAIL_MOVE;}
 else {pose(s);s->phase=FF3_TAIL_STATUS;}
}
static void slot(Ff3EntryTail*s){uint8_t i=s->actor,g=kind(s->motion.status[i]);
 if(s->graphics[i]!=g){s->graphics[i]=g;s->loaded=0;s->total=g==0?14:g==1?6:8;s->phase=FF3_TAIL_HIDE;}
 else after_load(s);
}
uint8_t ff3_entry_tail_start(Ff3EntryTail*s) FF3_STATE_BANKED {uint8_t i;
 if(s->phase||s->motion.phase!=FF3_ENTRY_TAIL)return 0;
 if(s->layout==9&&(s->flags&64)&&(s->graphic&31)>=24)return 0;
 for(i=0;i<4;i++)if(s->jobs[i]>=22||s->graphics[i]>=4)return 0;
 for(i=0;i<8;i++)if(s->types[i]>3&&s->types[i]!=255)return 0;
 s->ticket=0;s->actor=s->chunk=s->loaded=s->total=0;s->shift=7;
 if(s->layout==9&&(s->flags&64))s->phase=FF3_TAIL_BOSS;else canonical(s);return 1;
}
uint8_t ff3_entry_tail_refresh(Ff3EntryTail*s) FF3_STATE_BANKED {uint8_t i;
 if(s->phase!=FF3_TAIL_DONE||s->motion.phase!=FF3_ENTRY_TAIL)return 0;
 for(i=0;i<4;i++)if(s->jobs[i]>=22||s->graphics[i]>=4)return 0;
 /* Boss chunks are 0..35 and finished before DONE. Reuse the private high
  * bit for the standalone B5B8 return; only the B479 entry calls B909. */
 s->chunk=128;s->actor=0;slot(s);return 1;
}
uint8_t ff3_entry_tail_ack(Ff3EntryTail*s,uint16_t ticket) FF3_STATE_BANKED {uint8_t i,j,n;
 if(s->ticket!=ticket||s->phase<1||s->phase>=FF3_TAIL_DONE)return 0;
 switch(s->phase){
 case FF3_TAIL_BOSS:if(s->shift)s->shift--;else {s->shift=7;if(++s->chunk==ff3_tail_chunks[s->graphic&31])canonical(s);}break;
 case FF3_TAIL_CANONICAL:slot(s);break;
 case FF3_TAIL_HIDE:s->phase=FF3_TAIL_LOAD;break;
 case FF3_TAIL_LOAD:n=s->total-s->loaded;s->loaded+=n>4?4:n;if(s->loaded==s->total)after_load(s);break;
 case FF3_TAIL_MOVE:for(i=0;i<4;i++)if(s->motion.x[i]!=s->motion.destination[i])break;
  if(i<4)ff3_entry_motion_direction(&s->motion,(s->chunk&64)!=0);else {if(s->chunk&64){s->motion.status[s->actor]&=247;s->motion.confused_position[s->actor]=0;}pose(s);s->phase=FF3_TAIL_INNER;}break;
 case FF3_TAIL_INNER:s->motion.confused_position[s->actor]=0;pose(s);s->phase=FF3_TAIL_STATUS;break;
 case FF3_TAIL_STATUS:if(++s->actor<4)slot(s);else {if(!(s->chunk&128)){s->counts[4]=0;for(i=0;i<4;i++){n=0;for(j=0;j<8;j++)n+=s->types[j]==i;s->counts[i]=n;s->counts[4]+=n;}}s->phase=FF3_TAIL_DONE;}break;
 default:return 0;
 }s->ticket++;return 1;
}
uint8_t ff3_entry_tail_work(const Ff3EntryTail*s,uint8_t*out) FF3_STATE_BANKED {uint8_t i=s->actor,g,n,asset,k;uint16_t off,ppu;
 if(s->phase==FF3_TAIL_BOSS){if((s->graphic&31)>=24||s->shift>7||s->chunk>=ff3_tail_chunks[s->graphic&31])return 0;k=1;asset=s->graphic&31;off=(uint16_t)s->chunk*64;n=64;ppu=0x700+off;}
 else if(s->phase==FF3_TAIL_LOAD){if(i>=4||s->loaded>=s->total)return 0;k=2;g=s->graphics[i];asset=g==2?24:g==3?25:s->jobs[i];off=(g==1?0x240:0)+(uint16_t)s->loaded*16;n=(s->total-s->loaded)>4?64:(s->total-s->loaded)*16;ppu=ff3_tail_party_ppu[i]+(uint16_t)s->loaded*16;}
 else if(s->phase==FF3_TAIL_INNER||s->phase==FF3_TAIL_STATUS){if(i>=4)return 0;k=3;g=s->motion.status[i];asset=(g&192)==64?((g&4)?1:(g&1)?2:0):3;off=asset==3?0:i*8;n=ff3_tail_map_rows[i]*2;ppu=ff3_tail_map_ppu[i]+ff3_tail_map_x[((g&8)?2:s->motion.rows[i]&1)+(s->motion.battle_type==0x88?3:0)];}
 else return 0;
 out[0]=k;out[1]=asset;out[2]=off;out[3]=off>>8;out[4]=n;out[5]=ppu;out[6]=ppu>>8;out[7]=0;return 1;
}
static uint8_t reverse(uint8_t v){v=((v&0x55)<<1)|((v>>1)&0x55);v=((v&0x33)<<2)|((v>>2)&0x33);return (v<<4)|(v>>4);}
uint8_t ff3_entry_tail_bytes(const Ff3EntryTail*s,const uint8_t*src,uint8_t*out) FF3_STATE_BANKED {uint8_t w[8],i,v,flip;
 if(!ff3_entry_tail_work(s,w))return 0;
 if(w[0]==3){for(i=0;i<w[4];i++)out[i]=ff3_tail_maps[(uint16_t)w[1]*32+w[2]+(i^(s->motion.battle_type==0x88))];}
 else {flip=w[0]==1?((s->motion.battle_type==0x88)^((ff3_tail_boss_flags[s->graphic&31]&16)!=0)):0;
  for(i=0;i<w[4];i++){v=src[i];if(w[0]==1){v=(i&1)?v<<s->shift:v>>s->shift;if(flip)v=reverse(v);}out[i]=v;}
 }return 1;
}
