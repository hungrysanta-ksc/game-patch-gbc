#ifndef FF3_BATTLE_RESULT_H
#define FF3_BATTLE_RESULT_H
#include "game-state.h"
#include "battle-fight.h"
/* $7575..7874 stays resident for the whole battle. Staged E0/F0 statuses
 * are distinct from records until script 0D/0E, after damage numerals.
 * remaining is the graphics removal owner's $7DD2, NOT HP==0 count. */
typedef struct {
 uint8_t records[12][64],actor_status[16],target_status[16];
 uint8_t dead[8],types[8];
 uint8_t result,escape,first,flags,actor,target,remaining,near;
 uint8_t script,name,message,target_name;
} Ff3BattleResult;
typedef char Ff3BattleResultSize[(sizeof(Ff3BattleResult)==828)?1:-1];
uint8_t ff3_result_status(Ff3BattleResult *s,uint8_t cannon) FF3_STATE_BANKED;
void ff3_result_check(Ff3BattleResult *s) FF3_STATE_BANKED;
uint8_t ff3_result_run(Ff3BattleResult *s,FF3BattleRng *rng,uint8_t escape) FF3_STATE_BANKED;
/* Resolved target only. f supplies equipment/defending/running/boss/queue;
 * actor/target records come from s. Output f retains unabridged source hand
 * hits, numerals and messages for the presentation caller. HP is immediate,
 * E0/F0 status is staged. No outcome/monster removal ahead of the script. */
uint8_t ff3_result_attack(Ff3BattleResult *s,FF3BattleRng *rng,Ff3Fight *f,uint8_t target) FF3_STATE_BANKED;
#endif
