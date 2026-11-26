#ifndef FF3_MOTION_SPRITES_H
#define FF3_MOTION_SPRITES_H
#include "game-state.h"
/* Original NES OAM bytes, not native OAM. Caller owns the output capacity.
 * Inputs are live state; immutable shape/frame/tile tables come from ROM. */
uint8_t ff3_motion_sprite(uint8_t frame,uint8_t x,uint8_t y,uint8_t flip,uint8_t back,uint8_t palette,uint8_t*out) FF3_STATE_BANKED;
uint8_t ff3_motion_slice(uint8_t frame,uint8_t x,uint8_t y,uint8_t hand,uint8_t back,uint8_t*out) FF3_STATE_BANKED;
#endif
