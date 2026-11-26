#ifndef FF3_HIT_VIDEO_H
#define FF3_HIT_VIDEO_H
#include "game-state.h"
/* 7EDF/7EE0: covering actor / protected actor masks; zero disables cover. */
extern uint8_t hit_cover[2],hit_error;
void ff3_hit_reset(void) FF3_STATE_BANKED;
uint8_t ff3_hit_video(uint8_t owner) FF3_STATE_BANKED;
#endif
