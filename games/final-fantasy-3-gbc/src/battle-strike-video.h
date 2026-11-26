#ifndef FF3_STRIKE_VIDEO_H
#define FF3_STRIKE_VIDEO_H
#include <gb/gb.h>
#include "game-state.h"
extern FF3BattleRng strike_rng;
extern uint8_t strike_rng_ready;
extern uint8_t strike_weapons[2];
extern uint8_t strike_critical;
extern uint8_t strike_error;
uint8_t ff3_strike_video(void) BANKED;
void ff3_strike_reset(void) BANKED;
#endif
