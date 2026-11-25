#ifndef FF3_BATTLE_FIGHT_H
#define FF3_BATTLE_FIGHT_H
#include "battle-physical.h"
/* 30/9E8A..31/A2B9, resolved living target only. Original 64-byte battle
 * records, not invented combat stats. Status buffers commit later in the
 * action script; do not overwrite actor/target status bytes here. */
typedef struct {
 uint8_t actor[64],target[64],equipment[2],defending[4];
 uint8_t running,boss,critical,target_mask,target_slot;
 uint8_t messages[20],message_count,deaths;
 uint8_t actor_status[2],target_status[2],actual_hits[2],animation_hits[2];
 uint8_t target_number[2],actor_number[2],split_id,status_message;
} Ff3Fight;
/* Fails BEFORE mutations/RNG for invalid records, unresolved targets,
 * split-capable monsters, or insufficient queue capacity. Running defense
 * follows the original temporary penalty and carry-sensitive restoration.
 * Same-side slot identity aliases target to actor. Accessible WRAM only. */
uint8_t ff3_fight_resolved(FF3BattleRng *rng,Ff3Fight *s) FF3_STATE_BANKED;
#endif
