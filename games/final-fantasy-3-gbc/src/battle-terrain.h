#ifndef FF3_BATTLE_TERRAIN_H
#define FF3_BATTLE_TERRAIN_H
#include "battle-entry.h"
extern volatile uint8_t terrain_fault,terrain_scroll;
extern uint8_t terrain_dma_mask;
extern volatile uint16_t terrain_max_step;
void ff3_terrain_init(void) NONBANKED;
void ff3_terrain_load(uint8_t profile) NONBANKED;
void ff3_terrain_reset(void) NONBANKED;
void ff3_terrain_step(const Ff3EntryDisplay*s) NONBANKED;
void ff3_terrain_prepare(uint8_t page) NONBANKED;
void ff3_terrain_publish(void) NONBANKED;
#endif
