#ifndef FF3_BATTLE_PHYSICAL_H
#define FF3_BATTLE_PHYSICAL_H
#include "game-state.h"
/* Post-equipment/status inputs for 31/BB44 only. This is not the whole fight
 * effect: row, critical roll, drain, status, HP and per-hand processing belong
 * to its caller. All pointers must address accessible WRAM; never call in IRQ. */
typedef struct {uint8_t attack,attack_high,defense,multiplier,critical_bonus,critical,hits,targets,attacker_flags,target_flags;} Ff3Physical;
uint8_t ff3_physical_hits(FF3BattleRng *rng,uint8_t attempts,uint8_t chance) FF3_STATE_BANKED;
/* Returns 0 for zero targets without changing RNG/output. Zero damage is valid
 * here: the fight caller's minimum-one rule must be applied at 31/A0C0. */
uint8_t ff3_physical_damage(FF3BattleRng *rng,const Ff3Physical *p,uint16_t *damage) FF3_STATE_BANKED;
#endif
