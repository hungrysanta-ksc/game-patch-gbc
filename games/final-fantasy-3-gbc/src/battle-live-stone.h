#ifndef FF3_LIVE_STONE_H
#define FF3_LIVE_STONE_H
#include <gb/gb.h>
extern uint8_t stone_live,stone_error,stone_state[4];
void ff3_live_stone_reset(void) BANKED;
uint8_t ff3_live_stone_change(uint8_t actor,const uint8_t*work) BANKED;
uint8_t ff3_live_stone_map(uint8_t*map) BANKED;
void ff3_live_stone_footer(uint8_t*row) BANKED;
void ff3_live_stone_objects(uint8_t*out) BANKED;
uint8_t ff3_live_stone_overlap(uint8_t x,uint8_t y) BANKED;
#endif
