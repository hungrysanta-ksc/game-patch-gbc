#ifndef FF3_BATTLE_SCRIPT_H
#define FF3_BATTLE_SCRIPT_H
#include "game-state.h"
/* Source 78D5,7EC2,6010,78D3,72,78D6..E3; no frame/movie data. */
typedef struct {
 uint8_t script,effect,speed,result,item,names[4],messages[10];
 uint8_t pc,queue,variable,wait,kind,op,done,error;
 uint16_t ticket;
} Ff3ActionScript;
enum {FF3_SCRIPT_MESSAGE=1,FF3_SCRIPT_WAIT,FF3_SCRIPT_BUTTON,
 FF3_SCRIPT_GRAPHICS,FF3_SCRIPT_CLEANUP};
/* start validates the supported queue envelope before mutation. ack must
 * come from the actual owner after completion; graphics 11..14 include their
 * original preparation/commit routines, not just the last animation call. */
uint8_t ff3_script_start(Ff3ActionScript*s) FF3_STATE_BANKED;
uint8_t ff3_script_ack(Ff3ActionScript*s,uint16_t ticket,uint8_t buttons) FF3_STATE_BANKED;
#endif
