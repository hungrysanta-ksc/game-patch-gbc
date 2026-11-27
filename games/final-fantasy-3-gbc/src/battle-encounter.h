#ifndef FF3_BATTLE_ENCOUNTER_H
#define FF3_BATTLE_ENCOUNTER_H
#include <gb/gb.h>
/* Common boundary inputs survive the field/battle arena exchange.
 * ready=2: generate approved GBC seed at the settled field boundary;
 * ready=1: latched seed (also exact-seed diagnostics); ready=0: diagnostic hold.
 * Default boot/return re-arms 2. Battle consumes 1 once. */
extern volatile uint8_t scene_formation,scene_background,scene_rng_seed,scene_rng_ready;
extern uint8_t encounter_type,encounter_first,encounter_counts[4],encounter_error;
uint8_t ff3_encounter_map(uint8_t world,uint8_t map) BANKED;
uint8_t ff3_encounter_prepare(void) BANKED;
void ff3_encounter_names(void) BANKED;
#endif
