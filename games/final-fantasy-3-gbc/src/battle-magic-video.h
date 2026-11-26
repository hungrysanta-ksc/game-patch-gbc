#ifndef FF3_MAGIC_VIDEO_H
#define FF3_MAGIC_VIDEO_H
#include <gb/gb.h>
extern volatile uint8_t magic_tall;
extern uint8_t magic_error,magic_reflect_mask;
void ff3_magic_reset(void) BANKED;
uint8_t ff3_magic_video(void) BANKED;
#endif
