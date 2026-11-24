#pragma bank 15
#include "battle-row.h"
extern const uint8_t row_positions[];
/* 35/A71C..A7A4. Selection never changes either row bit. */
uint8_t ff3_row_begin(Ff3Row *s) BANKED {
 uint8_t i;
 if(s->actor>=4||(s->command!=2&&s->command!=3))return 0;
 if((s->equipment_row&1)==(s->command-2)){
  s->sound=6;s->phase=FF3_ROW_REJECTED;return 1;
 }
 i=s->actor*4+(s->command-2)*2;
 s->arrow_y=row_positions[i];s->arrow_tile=0x5d;
 s->arrow_attr=s->command==2?0x43:3;
 s->arrow_x=row_positions[i+1];s->cancel=s->command==2?128:64;
 if(s->formation&8){s->arrow_x=row_positions[16+i+1];s->arrow_attr^=64;s->cancel^=192;}
 s->phase=FF3_ROW_PENDING;return 1;
}
/* 35/A7AA..A7CA uses exact key equality, not a bit test. */
void ff3_row_key(Ff3Row *s,uint8_t key) BANKED {
 if(s->phase!=FF3_ROW_PENDING)return;
 if(key==1){s->sound=5;s->actor++;s->action=s->command;s->phase=FF3_ROW_RESERVED;}
 else if(key==2||key==s->cancel)s->phase=FF3_ROW_CANCELLED;
}
/* 35/A7DF..A822: invoked only when the queued action actually executes.
 * Both commands toggle bit zero, preserving every other bit independently. */
uint8_t ff3_row_execute(Ff3Row *s) BANKED {
 if((s->action!=2&&s->action!=3)||(s->flags&7)>=4)return 0;
 s->name=s->action==2?0x3b:0x3c;s->script=1;
 s->battle_row^=1;s->equipment_row^=1;s->actor=s->flags&7;
 return 1;
}
