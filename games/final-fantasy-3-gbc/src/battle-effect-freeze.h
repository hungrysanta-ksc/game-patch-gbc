#ifndef FF3_EFFECT_FREEZE_H
#define FF3_EFFECT_FREEZE_H
#include <gb/gb.h>
extern uint8_t effect_signed,effect_freeze_error;
/* Scene teardown invalidates this only after effect_signed has been released. */
extern uint8_t effect_freeze_cache_valid;
uint8_t ff3_effect_freeze(void) BANKED;
uint8_t ff3_effect_release(uint8_t pairs) BANKED;
void ff3_effect_read(uint8_t bank,uint16_t address,uint8_t*out,uint16_t count) BANKED;
void ff3_effect_cache_reset(void) BANKED;
#endif
