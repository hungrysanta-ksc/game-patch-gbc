#ifndef FF3_STONE_H
#define FF3_STONE_H
#include <gb/gb.h>
extern volatile uint8_t stone_error;
void ff3_stone_reset(uint8_t profile) BANKED;
uint8_t ff3_stone_change(uint8_t actor,const uint8_t*work,uint8_t back) BANKED;
void ff3_stone_prepare(uint8_t page,uint8_t*oam) BANKED;
#endif
