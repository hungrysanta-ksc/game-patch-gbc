#ifndef FF3_BATTLE_EQUIPMENT_H
#define FF3_BATTLE_EQUIPMENT_H
#include <gb/gb.h>
#include "battle-items.h"
/* 35/AF9C..B193. Canonical bag + one persistent equipment record.
 * Returns zero with no mutations on failure. Success closes the list and
 * returns to the same actor; it does not reserve a battle action. */
uint8_t ff3_equipment_swap(uint8_t *bag,uint8_t *equipment,Ff3ItemCursor *cursor,uint8_t eligible) BANKED;
/* 31/AA16..AF76. Preserve the original byte/carry arithmetic and bugs.
 * Inputs are one 64-byte character/equipment/battle record each. */
void ff3_equipment_update(uint8_t *character,uint8_t *equipment,uint8_t *battle) BANKED;
#endif
