#ifndef FF3_BATTLE_DEFEAT_VIDEO_H
#define FF3_BATTLE_DEFEAT_VIDEO_H
#include <gb/gb.h>
extern uint8_t defeat_phase,defeat_error,defeat_frames;
/* 1 HP/message, 2 script, 3 Requiem/input, 4 fade, 5 load-menu boundary.
 * Owner lifetime ends at the actual restart menu, never field restoration. */
void ff3_defeat_video(void) BANKED;
#endif
