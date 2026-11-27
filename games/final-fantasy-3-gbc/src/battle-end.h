#ifndef FF3_BATTLE_END_H
#define FF3_BATTLE_END_H
#include "game-state.h"
/* 34/811C..8184 followed by 3F/FA5B..FA80 and 3E/C058.
 * Each request is a barrier, not a declaration that its consumer ran. */
enum {FF3_END_HP=1,FF3_END_MESSAGE,FF3_END_ANIMATION,FF3_END_REWARD,
 FF3_END_PARTY,FF3_END_ROWS,FF3_END_INVENTORY,FF3_END_FADE,
 FF3_END_FIELD,FF3_END_RESTART};
typedef struct {
 uint16_t battle;
 uint8_t result,first,request,message,song,wait_a,done;
 uint16_t ticket;
} Ff3BattleEnd;
uint8_t ff3_end_start(Ff3BattleEnd*s) FF3_STATE_BANKED;
uint8_t ff3_end_ack(Ff3BattleEnd*s,uint16_t ticket) FF3_STATE_BANKED;
#endif
