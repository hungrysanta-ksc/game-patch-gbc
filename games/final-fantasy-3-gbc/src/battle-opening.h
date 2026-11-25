#ifndef FF3_BATTLE_OPENING_H
#define FF3_BATTLE_OPENING_H
#include "battle-context.h"
#include "battle-party.h"
/* Entry boundary: initialized battle records, original surprise flags and
 * cannon preparation already supplied. Monster AI belongs BEFORE this caller.
 * No renderer is silently acknowledged: each pending request needs its ticket. */
typedef struct {
 Ff3Party party;
 Ff3Cannon cannon;
 Ff3StatusView views[4];
 uint8_t types[8],original_types[8],dead[8],rewards[4],counts[4];
 uint8_t flags,first,turn,result,speed,message,message_index,target_kind;
 uint8_t pending,value,ticket,phase,wait,mask,error;
} Ff3Opening;
enum {FF3_OPEN_NONE,FF3_OPEN_GRAPHICS,FF3_OPEN_CLEAR,FF3_OPEN_MESSAGE,
 FF3_OPEN_CLOSE,FF3_OPEN_BUTTON,FF3_OPEN_WAIT,FF3_OPEN_SELECT,
 FF3_OPEN_CALLER,FF3_OPEN_VICTORY,FF3_OPEN_AUTO,FF3_OPEN_RETURN_ITEM};
/* Invalid types/speed/actor fail without mutation. Do not call start twice. */
uint8_t ff3_opening_start(Ff3Opening *s) FF3_STATE_BANKED;
/* Wrong/stale tickets and terminal states fail without mutation. A zero
 * button leaves BUTTON pending; WAIT advances by exactly one source frame. */
uint8_t ff3_opening_ack(Ff3Opening *s,uint8_t ticket,uint8_t buttons) FF3_STATE_BANKED;
#endif
