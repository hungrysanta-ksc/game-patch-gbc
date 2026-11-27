#ifndef FF3_RESIDENT_BG_H
#define FF3_RESIDENT_BG_H
#include <gb/gb.h>
#include "battle-entry.h"
extern volatile uint8_t resident_scroll,resident_page,resident_error;
extern uint8_t resident_fixed;
extern volatile uint16_t resident_map_bytes,resident_map_updates;
void ff3_resident_load(uint8_t profile) NONBANKED;
#ifdef FF3_EFFECTS
uint8_t ff3_resident_effect_copy(uint16_t address,uint16_t count) NONBANKED;
#endif
void ff3_resident_prepare(const Ff3EntryDisplay*s,uint8_t page,uint8_t*oam) NONBANKED;
#endif
