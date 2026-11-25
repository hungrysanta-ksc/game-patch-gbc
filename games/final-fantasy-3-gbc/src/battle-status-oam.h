#ifndef FF3_STATUS_OAM_H
#define FF3_STATUS_OAM_H
#include "game-state.h"
/* 32/9F11: source status icons and rotating target numerals, no renderer. */
typedef struct {uint8_t x[4],y[4],status[4],targets[4],anchors[16];
 uint8_t battle_type,enabled,counter;} Ff3StatusOam;
/* Source OAM $0200..021F and $0260..027F (64 bytes). Disabled leaves both
 * output and counter unchanged; invalid status IDs reject atomically. */
uint8_t ff3_status_oam(Ff3StatusOam*s,uint8_t*out) FF3_STATE_BANKED;
#endif
