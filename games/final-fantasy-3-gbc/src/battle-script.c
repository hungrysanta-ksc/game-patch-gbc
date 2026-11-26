#ifndef STATE_HOST
#pragma bank 45
#endif
#include "battle-script.h"
#include "battle-script-assets.h"
typedef char script_abi[(sizeof(Ff3ActionScript)==29)?1:-1];
static uint8_t type(uint8_t id){uint8_t v=ff3_script_types[id>>1];return id&1?v&15:v>>4;}
static void request(Ff3ActionScript*s,uint8_t kind){s->kind=kind;s->ticket++;}
static void advance(Ff3ActionScript*s){uint8_t op;
 for(;;){
  if(s->pc>=ff3_script_lengths[s->script]){s->error=1;return;}
  op=ff3_script_data[ff3_script_offsets[s->script]+s->pc];s->op=op;s->wait=0;
  if(op==255){request(s,FF3_SCRIPT_CLEANUP);return;}
  if(op<10){if(op==9&&s->messages[s->queue]!=255&&type(s->messages[s->queue])>1){s->error=2;return;}request(s,FF3_SCRIPT_MESSAGE);return;}
  if(op==10){s->wait=(8-s->speed)*8;if(s->wait){request(s,FF3_SCRIPT_WAIT);return;}s->pc++;continue;}
  if(op==13&&(s->result&2)){s->pc++;continue;}
  if(op==12)s->effect=23;
  request(s,FF3_SCRIPT_GRAPHICS);return;
 }
}
uint8_t ff3_script_start(Ff3ActionScript*s) FF3_STATE_BANKED {uint8_t i;
 if(s->kind||s->done||s->error||s->ticket||s->speed>8||(s->effect&&s->script>=6))return 0;
 for(i=0;i<10;i++)if(s->messages[i]!=255&&s->messages[i]>=144)return 0;
 for(i=0;i<10&&s->messages[i]!=255;i++);if(i==10)return 0;
 s->pc=s->queue=s->variable=s->wait=0;
 if(!s->effect){s->op=255;request(s,FF3_SCRIPT_CLEANUP);}else advance(s);return 1;
}
uint8_t ff3_script_ack(Ff3ActionScript*s,uint16_t ticket,uint8_t buttons) FF3_STATE_BANKED {uint8_t kind=s->kind;
 if(!kind||s->done||s->error||ticket!=s->ticket)return 0;
 if(kind==FF3_SCRIPT_BUTTON&&!(buttons&1))return 1;
 if(kind==FF3_SCRIPT_WAIT){if(!(buttons&1)&&--s->wait){request(s,kind);return 1;}}
 else if(kind==FF3_SCRIPT_CLEANUP){s->kind=0;s->done=1;return 1;}
 else if(kind==FF3_SCRIPT_GRAPHICS){if(s->op==13||s->op==14)s->effect=22;}
 else if(kind==FF3_SCRIPT_MESSAGE){
  if(s->op==3&&s->messages[s->queue]!=255)s->pc-=s->script?5:4;
  if(s->op==9&&s->messages[s->queue]!=255){if(type(s->messages[s->queue])==1){request(s,FF3_SCRIPT_BUTTON);return 1;}s->queue++;}
 }else if(kind==FF3_SCRIPT_BUTTON)s->queue++;
 s->kind=0;s->pc++;advance(s);return 1;
}
