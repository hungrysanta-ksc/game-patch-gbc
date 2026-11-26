#ifndef FF3_EFFECT_FREEZE_H
#define FF3_EFFECT_FREEZE_H
#include <gb/gb.h>
extern uint8_t effect_signed,effect_freeze_error;
uint8_t ff3_effect_freeze(void) BANKED;
uint8_t ff3_effect_release(void) BANKED;
#endif
