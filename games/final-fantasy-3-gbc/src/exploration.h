#ifndef FF3_EXPLORATION_H
#define FF3_EXPLORATION_H
#include "field-objects.h"
/* Bytes mirror original fields, not a replacement save format. */
typedef struct {
 uint8_t x,y,subx,suby,direction,speed,z,current,next,property,trigger;
 uint8_t target_x,target_y,slot,rng_index,rng_direction,error,keys,previous,mode;
 uint8_t request,result,face,world,map,rate,ready,pause;
 uint16_t steps,talks,ticks,draws;
 uint8_t polled,pressed,blocked,video_fault;
 uint16_t camera_x,camera_y;
 uint8_t cache_x,cache_y,oam_page,pending,scroll_x,scroll_y;
 uint16_t deadline;uint32_t fraction;
 uint16_t max_bg_ticks,max_oam_ticks,max_publish_ticks,max_render_ticks;
 uint8_t render_busy,upload_pending,render_dirty;
} FF3Exploration;
extern volatile FF3Exploration __at(0xdb70) field;
extern uint8_t __at(0xdc00) field_oam[160];
extern uint8_t __at(0xdbc0) field_staging[64];
void ff3_field_front(void) BANKED;
uint8_t ff3_field_touch(void) BANKED;
uint8_t ff3_field_talk(void) BANKED;
uint8_t ff3_field_terrain(void) BANKED;
void ff3_field_pixel(void) BANKED;
void ff3_field_tick(void) BANKED;
void ff3_field_init(void) BANKED;
uint8_t ff3_field_render(uint8_t boot) BANKED;
void ff3_field_video_init(void) NONBANKED;
void ff3_field_strip(uint16_t address,uint8_t stride) NONBANKED;
void ff3_field_publish(uint8_t page,uint8_t x,uint8_t y) NONBANKED;
void ff3_field_flush(void) NONBANKED;
#endif
