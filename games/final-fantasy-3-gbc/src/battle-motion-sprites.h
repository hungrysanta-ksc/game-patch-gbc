#ifndef FF3_MOTION_SPRITES_H
#define FF3_MOTION_SPRITES_H
#include "game-state.h"
/* Original NES OAM bytes, not native OAM. Caller owns the output capacity.
 * Inputs are live state; immutable shape/frame/tile tables come from ROM. */
uint8_t ff3_motion_sprite(uint8_t frame,uint8_t x,uint8_t y,uint8_t flip,uint8_t back,uint8_t palette,uint8_t*out) FF3_STATE_BANKED;
uint8_t ff3_motion_slice(uint8_t frame,uint8_t x,uint8_t y,uint8_t hand,uint8_t back,uint8_t*out) FF3_STATE_BANKED;
/* 32/98E0..991E: even frames draw from RNG 0 twice, odd frames retain
 * the previous hit point. Table/counters belong to the battle, not a movie. */
uint8_t ff3_motion_impact(uint8_t frame,uint8_t x,uint8_t y,uint8_t hand,uint8_t back,Ff3BattleRngCursor*rng,uint8_t*point,uint8_t*out) FF3_STATE_BANKED;
/* 33/A317..A347 consumes two RNG bytes every frame, including misses. */
uint8_t ff3_motion_fist(uint8_t x,uint8_t y,uint8_t hand,uint8_t back,uint8_t palette,Ff3BattleRngCursor*rng,uint8_t*out) FF3_STATE_BANKED;
uint8_t ff3_motion_claw_hit(uint8_t frame,uint8_t x,uint8_t y,uint8_t hand,uint8_t back,Ff3BattleRngCursor*rng,uint8_t*point,uint8_t*out) FF3_STATE_BANKED;
#endif
