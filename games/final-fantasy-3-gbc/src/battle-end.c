#ifndef STATE_HOST
#pragma bank 119
#endif
#include "battle-end.h"
static void request(Ff3BattleEnd*s,uint8_t r){s->request=r;s->ticket++;}
/* The source compares a nonzero high byte, not equality with 01. Keep
 * that comparison for the ROM's supported nine-bit battle identifiers. */
static uint8_t special(const Ff3BattleEnd*s,uint8_t lo){return (s->battle>>8)&&(uint8_t)s->battle==lo;}
uint8_t ff3_end_start(Ff3BattleEnd*s) FF3_STATE_BANKED {
 if(s->battle>=512||s->request||s->ticket||s->done||!(s->result&0xc2))return 0;
 s->message=s->song=255;s->wait_a=0;request(s,FF3_END_HP);return 1;
}
uint8_t ff3_end_ack(Ff3BattleEnd*s,uint16_t ticket) FF3_STATE_BANKED {
 if(s->done||!s->request||ticket!=s->ticket)return 0;
 switch(s->request){
 case FF3_END_HP:
  if(s->result&2){request(s,FF3_END_PARTY);break;}
  s->message=s->result&128?0x1c:0x1d;
  if(!(s->result&128)&&(special(s,0x78)||special(s,0x73)))request(s,FF3_END_PARTY);
  else request(s,FF3_END_MESSAGE);break;
 case FF3_END_MESSAGE:
  s->song=s->result&128?0x13:7;
  s->wait_a=(s->result&128)&&!special(s,0x79);request(s,FF3_END_ANIMATION);break;
 case FF3_END_ANIMATION:request(s,s->result&128?FF3_END_INVENTORY:FF3_END_REWARD);break;
 case FF3_END_REWARD:request(s,FF3_END_PARTY);break;
 case FF3_END_PARTY:request(s,s->first&8?FF3_END_ROWS:FF3_END_INVENTORY);break;
 case FF3_END_ROWS:request(s,FF3_END_INVENTORY);break;
 case FF3_END_INVENTORY:
  if(special(s,0x79))s->result=0;request(s,FF3_END_FADE);break;
 case FF3_END_FADE:request(s,s->result&128?FF3_END_RESTART:FF3_END_FIELD);break;
 case FF3_END_FIELD:case FF3_END_RESTART:s->done=1;s->request=0;break;
 default:return 0;
 }return 1;
}
