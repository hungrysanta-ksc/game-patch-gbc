#ifndef FF3_BATTLE_NUMERALS_H
#define FF3_BATTLE_NUMERALS_H
#include "game-state.h"
/* 33/AD2B inputs: packed display values, occupied monsters and source
 * anchors. These are presentation inputs, not a second damage calculator. */
typedef struct {
 uint8_t values[16],types[8],center[8],bottom[8],x[4],y[4],enemy,back;
 uint8_t digits[32],palettes[8],frame,count,done,error;
 uint16_t ticket;
} Ff3Numerals;
uint8_t ff3_numerals_start(Ff3Numerals*s,uint8_t*out) FF3_STATE_BANKED;
uint8_t ff3_numerals_ack(Ff3Numerals*s,uint16_t ticket,uint8_t*out) FF3_STATE_BANKED;
#endif
