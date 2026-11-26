#ifndef FF3_THROWN_VIDEO_H
#define FF3_THROWN_VIDEO_H
#include "game-state.h"
/* Live 33/A130/A1EF callers; source state is separate from GBC projection. */
uint8_t ff3_thrown_begin(uint8_t actor,uint8_t x,uint8_t y,uint8_t hand,uint8_t back,uint8_t kind,uint8_t hits,uint8_t angle,const uint8_t*center) FF3_STATE_BANKED;
uint8_t ff3_thrown_next(uint8_t*actor,Ff3BattleRngCursor*rng,uint8_t*source) FF3_STATE_BANKED;
uint8_t ff3_thrown_project(const uint8_t*source,uint8_t*out) FF3_STATE_BANKED;
extern uint8_t thrown_sound;
#endif
