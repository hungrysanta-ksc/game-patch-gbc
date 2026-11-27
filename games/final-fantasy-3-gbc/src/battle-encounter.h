#ifndef FF3_BATTLE_ENCOUNTER_H
#define FF3_BATTLE_ENCOUNTER_H
#include <gb/gb.h>
/* Common boundary inputs survive the field/battle arena exchange. Seed is
 * FC27's output, supplied explicitly until the virtual NES ZP owner exists. */
extern volatile uint8_t scene_formation,scene_background,scene_rng_seed,scene_rng_ready;
extern uint8_t encounter_type,encounter_first,encounter_counts[4],encounter_error;
uint8_t ff3_encounter_prepare(void) BANKED;
void ff3_encounter_names(void) BANKED;
#endif
