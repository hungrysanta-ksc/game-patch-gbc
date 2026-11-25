#ifndef FF3_STATUS_VIDEO_H
#define FF3_STATUS_VIDEO_H
#include "battle-entry.h"
extern uint8_t status_stage;
void ff3_status_video_reset(uint8_t profile) BANKED;
uint8_t ff3_status_video_advance(void) BANKED;
uint8_t ff3_status_video_hold(void) BANKED;
void ff3_status_video_source(void) BANKED;
uint8_t ff3_status_video_objects(uint8_t*out) BANKED;
#endif
