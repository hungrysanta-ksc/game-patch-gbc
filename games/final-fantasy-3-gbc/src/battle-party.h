#ifndef FF3_BATTLE_PARTY_H
#define FF3_BATTLE_PARTY_H
#include <stdint.h>
/* Compact projection of original battle records, not a second GameState. */
typedef struct {
 uint8_t actor,phase,command[4],slot[4],action[12],selected[4];
 uint8_t status1[4],status2[4],display[4],defense[4],saved[4],flags[4],used[4],magic;
} Ff3Party;
enum { FF3_PARTY_SELECT,FF3_PARTY_READY,FF3_PARTY_AUTO,FF3_PARTY_RETURN_ITEM,FF3_PARTY_CALLER };
void ff3_party_enter(Ff3Party *s);
void ff3_party_previous(Ff3Party *s);
void ff3_party_pick(Ff3Party *s,uint8_t slot,uint8_t command);
uint8_t ff3_party_accept(Ff3Party *s,uint8_t command,uint8_t mask,uint8_t flags);
#endif
