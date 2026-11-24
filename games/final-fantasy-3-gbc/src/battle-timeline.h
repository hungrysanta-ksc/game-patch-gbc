#ifndef FF3_BATTLE_TIMELINE_H
#define FF3_BATTLE_TIMELINE_H
#include <gb/gb.h>
extern volatile uint8_t battle_active,battle_entry,battle_ready,battle_serial;
extern volatile uint16_t battle_run,battle_origin,battle_due,battle_committed,battle_prepared,battle_misses;
void ff3_battle_start(uint8_t page) NONBANKED;
void ff3_battle_supply(uint8_t entry,uint8_t page) NONBANKED;
void ff3_battle_vblank(void) NONBANKED;
void ff3_battle_commit(uint8_t page,uint8_t palette) NONBANKED;
void ff3_number_commit(uint8_t page) NONBANKED;
#endif
