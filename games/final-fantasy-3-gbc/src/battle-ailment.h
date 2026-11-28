#ifndef FF3_BATTLE_AILMENT_H
#define FF3_BATTLE_AILMENT_H
#include "battle-fight.h"
/* Record, staged effects and display are different owners. These resolved
 * effect leaves do NOT replace spell hit/resistance/undead/target filtering.
 * Caller reserves a message slot and resolves self-target pointer aliasing. */
void ff3_ailment_apply(Ff3Fight*s,uint8_t*a,uint8_t*t,uint8_t effect) FF3_STATE_BANKED;
void ff3_ailment_remove(Ff3Fight*s,uint8_t*a,uint8_t*t,uint8_t mask) FF3_STATE_BANKED;
void ff3_ailment_cure(Ff3Fight*s,uint8_t*a,uint8_t*t,uint8_t mask) FF3_STATE_BANKED;
/* B40F leaf, after side/boss/evasion checks; original toad/mini XOR semantics. */
void ff3_ailment_toggle(Ff3Fight*s,uint8_t*t,uint8_t mask) FF3_STATE_BANKED;
/* B393 leaf, effective non-undead resurrection with original mask $80.
 * strength $FF restores max HP; other values use the original 1..9 RNG.
 * Enemy dead-mask clearing remains the caller's responsibility. */
void ff3_ailment_revive(FF3BattleRng*rng,Ff3Fight*s,uint8_t*a,uint8_t*t,uint8_t strength) FF3_STATE_BANKED;
/* BADC..BB48: returns 1 only when poison numeric output is produced.
 * Even skipped poison checks normalize zero-HP death, as the original does. */
uint8_t ff3_ailment_poison(uint8_t*record,uint8_t*number) FF3_STATE_BANKED;
/* A68A: sleep/paralysis action, after 9E5F's dead/stone gate. Return 0 for
 * an invalid caller without RNG/mutation. Message is the top action name,
 * not an infliction/cure sub-message. No rendering or turn loop here. */
uint8_t ff3_ailment_recover(FF3BattleRng*rng,uint8_t*record,uint8_t*staged,uint8_t*message) FF3_STATE_BANKED;
/* A400/A482 and 8315: only status/HP/MP transfer; equipment and outcome
 * dispatch remain their original owners. Never export on ordinary defeat. */
void ff3_ailment_enter(uint8_t*record,const uint8_t*character) FF3_STATE_BANKED;
void ff3_ailment_leave(const uint8_t*record,uint8_t*character) FF3_STATE_BANKED;
#endif
