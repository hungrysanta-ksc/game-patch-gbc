#ifndef FF3_DENSE_OAM_H
#define FF3_DENSE_OAM_H
#include <gb/gb.h>
extern volatile uint8_t dense_state,dense_error,dense_count,dense_index;
extern uint8_t dense_initial[32],dense_records[144];
uint8_t ff3_dense_begin(uint8_t*objects,uint8_t count) BANKED;
void ff3_dense_stop(void) NONBANKED;
void ff3_dense_vblank(uint8_t pending) NONBANKED;
void ff3_dense_lcd(void) NONBANKED;
#endif
