#ifndef FF3_PARTY_OAM_H
#define FF3_PARTY_OAM_H
#include "game-state.h"
/* 32/90D8..91CA input, independent of a composed frame or animation list. */
typedef struct {
 uint8_t x[4],y[4],pose[4],palette[4],override[4],hidden[4];
 uint8_t battle_type,mirror;
} Ff3PartyOam;
/* 24 original 8x8 objects, order y,tile,attr,x. Invalid input is atomic. */
uint8_t ff3_party_oam(const Ff3PartyOam*s,uint8_t*out) FF3_STATE_BANKED;
/* V6 coordinate/device adaptation only. 24 GB objects, y,x,tile,attr.
 * Uses existing resident OBJ tile IDs and palettes. Offscreen objects are
 * hidden, not wrapped; on-screen art is never scaled or simplified.
 * This does not own status icons, stone BG, enemies, numbers or windows. */
uint8_t ff3_party_oam_v6(const uint8_t*source,uint8_t back,uint8_t*out) FF3_STATE_BANKED;
/* 32/90EA: one changed actor, six original records, same tables as 90D8. */
uint8_t ff3_party_actor_oam(const Ff3PartyOam*s,uint8_t actor,uint8_t*out) FF3_STATE_BANKED;
#endif
