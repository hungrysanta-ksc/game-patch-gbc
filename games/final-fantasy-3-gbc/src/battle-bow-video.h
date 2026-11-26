#ifndef FF3_BOW_VIDEO_H
#define FF3_BOW_VIDEO_H
#include "game-state.h"
/* Live 33/A251 -> A6D2 -> 32/987C owner; no prerecorded frame stream. */
uint8_t ff3_bow_begin(uint8_t actor,uint8_t x,uint8_t y,uint8_t hand,uint8_t back,uint8_t hits,uint8_t angle,const uint8_t*center) FF3_STATE_BANKED;
/* 0 finished, 1 changed picture, 2 held picture, 255 unsupported/fault. */
uint8_t ff3_bow_next(const uint8_t*actor,Ff3BattleRngCursor*rng,uint8_t*source) FF3_STATE_BANKED;
uint8_t ff3_bow_project(const uint8_t*source,uint8_t*out) FF3_STATE_BANKED;
extern uint8_t bow_sound;
#endif
