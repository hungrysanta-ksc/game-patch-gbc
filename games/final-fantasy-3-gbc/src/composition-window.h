#ifndef FF3_COMPOSITION_WINDOW_H
#define FF3_COMPOSITION_WINDOW_H
#include <gb/gb.h>
extern uint8_t scene_palette[96],scene_pins[128];
extern uint8_t __at(0xdc00) scene_oam0[160];
extern uint8_t __at(0xdd00) scene_oam1[160];
extern volatile uint8_t scene_ready,scene_request,scene_page,scene_error,scene_phase;
extern volatile uint16_t scene_frames,scene_hits,scene_misses,scene_evictions,scene_composed;
void ff3_scene_begin(void) BANKED;
void ff3_scene_run(void) BANKED;
void ff3_scene_video_init(void) NONBANKED;
void ff3_scene_rom_copy(uint8_t bank,const void *source,void *target,uint16_t count) NONBANKED;
void ff3_scene_publish(uint8_t page,uint8_t palette,uint8_t x,uint8_t y) NONBANKED;
#endif
