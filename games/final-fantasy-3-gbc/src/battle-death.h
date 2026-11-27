#ifndef FF3_BATTLE_DEATH_H
#define FF3_BATTLE_DEATH_H
#include "battle-result.h"
/* 2F/BB94..BCCB: thirteen 40-bit shift registers, thirty-seven pictures,
 * two NMIs per picture. Renderer owns the original 61/62/63 black masks.
 * x is the source tile column; projection to 28px happens only at drawing. */
typedef struct {uint8_t gradient[65],x[13],back,frame,wait,done;uint16_t ticket;} Ff3Death;
uint8_t ff3_death_start(Ff3Death*s) FF3_STATE_BANKED;
uint8_t ff3_death_ack(Ff3Death*s,uint16_t ticket) FF3_STATE_BANKED;
/* BB0A credits original types before BAA2 clears slots; run uses BB5E and
 * does not grant experience. B909 counts the cleared slots before the wipe.
 * Caller must finish the wipe before running A458's outcome check. */
uint8_t ff3_death_remove(Ff3BattleResult*s,uint8_t mask,uint8_t reward,uint8_t*counts) FF3_STATE_BANKED;
#endif
