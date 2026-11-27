#ifndef FF3_BATTLE_COMMAND_H
#define FF3_BATTLE_COMMAND_H
#include "battle-result.h"
#include "battle-script.h"
#include "battle-animation.h"
/* Inputs are the original actor's 2E/2F/30 action tuple, resolved battle
 * records, equipment and saved defenses. This does not choose turn order.
 * Unsupported retarget/cover/ammunition/magic consumers fail before RNG. */
typedef struct {
 uint8_t effect,attacker,target,flags,mask,hit,name,sub_name,weapons[2],no_effect;
} Ff3BattleCommand;
uint8_t ff3_command_execute(Ff3BattleResult*s,FF3BattleRng*rng,Ff3Fight*f,Ff3BattleCommand*c) FF3_STATE_BANKED;
void ff3_command_script(const Ff3BattleResult*s,const Ff3Fight*f,const Ff3BattleCommand*c,Ff3ActionScript*out,uint8_t speed) FF3_STATE_BANKED;
void ff3_command_animation(const Ff3BattleResult*s,const Ff3Fight*f,const Ff3BattleCommand*c,Ff3Animation*out,uint8_t layout) FF3_STATE_BANKED;
uint8_t ff3_command_commit(Ff3BattleResult*s,Ff3Animation*out,uint8_t cannon) FF3_STATE_BANKED;
#endif
