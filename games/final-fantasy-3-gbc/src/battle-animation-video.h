#ifndef FF3_ANIMATION_VIDEO_H
#define FF3_ANIMATION_VIDEO_H
#include "battle-animation.h"
#include <gb/gb.h>
extern Ff3Animation animation_state;
extern volatile uint8_t animation_video_error,animation_video_owner;
extern volatile uint16_t animation_video_frames;
extern volatile uint8_t animation_video_probe,animation_video_gate;
/* Pending / completed / explicitly unsupported / fault. */
uint8_t ff3_animation_video(uint8_t op,uint8_t effect,uint8_t result) BANKED;
void ff3_animation_video_reset(void) BANKED;
#endif
