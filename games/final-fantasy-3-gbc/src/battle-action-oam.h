#ifndef FF3_ACTION_OAM_H
#define FF3_ACTION_OAM_H
#include "game-state.h"
/* Exclusive action lifetime. Rebuild when retained objects change; do not
 * reuse across numbers, status, enemy replacement or another action owner. */
uint8_t ff3_action_oam_begin(const uint8_t*base,uint8_t first,uint8_t count) FF3_STATE_BANKED;
/* Only changed objects are rechecked. Ordered puts them before retained
 * objects; otherwise the caller has retained the original fixed slots. */
uint8_t ff3_action_oam_finish(uint8_t*out,uint8_t first,uint8_t count,uint8_t ordered) FF3_STATE_BANKED;
#endif
