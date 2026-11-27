#ifndef FF3_RESIDENT_BG_H
#define FF3_RESIDENT_BG_H
#include <gb/gb.h>
#include "battle-entry.h"
#ifdef FF3_SCENE_LAYOUT
#define FF3_RESIDENT_BANKED BANKED
#else
#define FF3_RESIDENT_BANKED NONBANKED
#endif
extern volatile uint8_t resident_scroll,resident_page,resident_error;
extern uint8_t resident_fixed;
extern volatile uint16_t resident_map_bytes,resident_map_updates;
void ff3_resident_load(uint8_t profile) FF3_RESIDENT_BANKED;
#ifdef FF3_SCENE_LAYOUT
void ff3_resident_retain(void) FF3_RESIDENT_BANKED;
#endif
#ifdef FF3_EFFECTS
extern uint8_t resident_effect_clone_valid;
uint8_t ff3_resident_effect_copy(uint16_t address,uint16_t count) FF3_RESIDENT_BANKED;
#endif
void ff3_resident_prepare(const Ff3EntryDisplay*s,uint8_t page,uint8_t*oam) FF3_RESIDENT_BANKED;
#endif
