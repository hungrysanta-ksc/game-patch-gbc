#ifndef FF3_SCENE_LOOP_H
#define FF3_SCENE_LOOP_H
#include <gb/gb.h>
/* Development boundary requests: 1 enters a supported display profile,
 * 2 returns without inventing a victory, escape or persistent result. */
extern volatile uint8_t scene_mode,scene_request,scene_phase,scene_fault;
extern volatile uint8_t scene_cycles,scene_profile,scene_audio_boots;
void ff3_scene_run(void) BANKED;
void ff3_scene_song(uint8_t song) BANKED;
uint8_t ff3_field_restore_display(void) BANKED;
#endif
