#ifndef FF3_COMPOSITION_CACHE_H
#define FF3_COMPOSITION_CACHE_H
#include <gb/gb.h>
/* Diagnostic renderer ownership; do not overlay the exploration workspace. */
extern volatile uint8_t cache_ready,cache_request,cache_page,cache_error,cache_pending;
extern volatile uint16_t cache_frames,cache_hits,cache_misses,cache_evictions,cache_composed,cache_static,cache_dirty;
extern uint8_t __at(0xda50) cache_palette[80];
extern uint8_t __at(0xdb00) cache_oam0[160];
extern uint8_t __at(0xdc00) cache_oam1[160];
void ff3_cache_video_init(void) NONBANKED;
void ff3_cache_publish(uint8_t page,uint8_t palette) NONBANKED;
#endif
