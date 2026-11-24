#ifndef FF3_ITEM_VIDEO_H
#define FF3_ITEM_VIDEO_H
#include <gb/gb.h>
extern volatile uint8_t item_visible,item_next_visible,item_scroll_x,item_next_scroll;
extern volatile uint8_t item_raster_fault;
extern volatile uint8_t item_scroll_step,item_scroll_right;
void ff3_item_video_init(void) NONBANKED;
void ff3_item_scroll_vblank(void) NONBANKED;
#endif
