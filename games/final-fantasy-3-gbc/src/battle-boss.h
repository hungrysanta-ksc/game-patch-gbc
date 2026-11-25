#ifndef FF3_BATTLE_BOSS_H
#define FF3_BATTLE_BOSS_H
#include <gb/gb.h>
extern uint8_t boss_error,boss_started;
extern uint32_t boss_pattern_bytes,boss_map_bytes;
extern uint16_t boss_steps;
void ff3_boss_reset(uint8_t profile) BANKED;
uint8_t ff3_boss_queue(uint8_t graphic,uint8_t chunk,uint8_t shift) BANKED;
void ff3_boss_prepare(uint8_t page,uint8_t*oam) BANKED;
#endif
