#ifndef FF3_BATTLE_SELECT_H
#define FF3_BATTLE_SELECT_H
#include <stdint.h>
/* Original $AD..$B5, $7E0F[actor], $7F49. No renderer or effect calculation. */
typedef struct {uint8_t ad,ae,af,b0,b1,b2,b3,b4,b5,selected,sound;} Ff3Target;
typedef struct {uint8_t layout[8],monsters[8],party[4],excluded[4],back;} Ff3TargetEnv;
/* Caller must supply at least one monster and one eligible character, as the
 * original battle caller does. Invalid diagnostic inputs fail, never hang. */
uint8_t ff3_target_valid(const Ff3TargetEnv *e);
void ff3_target_begin(Ff3Target *s,const Ff3TargetEnv *e,uint8_t flags);
void ff3_target_input(Ff3Target *s,const Ff3TargetEnv *e,uint8_t buttons);
uint8_t ff3_command_cursor(uint8_t row,uint8_t missing,uint8_t buttons);
uint8_t ff3_input_repeat(uint8_t previous,uint8_t held,uint8_t *counter);
#endif
