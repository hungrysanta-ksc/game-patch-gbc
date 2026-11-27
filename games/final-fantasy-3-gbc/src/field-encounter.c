#pragma bank 9
#include "exploration.h"
#include "game-state.h"
#include "field-encounter-data.h"
/* 3D/BDB9..BDDD: normal maps only. $F5/$F6 decide whether; $F7 chooses
 * within the group only on success. NPC movement owns a different $F4.
 * ROM tables stay resident; no per-step decode, allocation or video transfer. */
void ff3_field_encounter(uint8_t event) BANKED {
 uint8_t group,slot;
 if(event)return;
 if(ff3_field_random((FF3FieldRng*)&field.rng_index)>=field.rate)return;
 group=encounter_map_groups[(field.world?256u:0u)+field.map];
 field.formation_rng++;
 slot=encounter_slots[encounter_random[field.formation_rng]&63];
 field.battle=encounter_groups[(uint16_t)group*8+slot];
 field.trigger=0x20;
}
/* 3F/E283 -> 3A/8533..854D. Keep flags in the raw byte, not just art ID. */
void ff3_field_battle_background(void) BANKED {
 field.battle_background=encounter_backgrounds[(field.world?256u:0u)+field.map];
}
