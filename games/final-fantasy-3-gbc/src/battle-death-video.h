#ifndef FF3_DEATH_VIDEO_H
#define FF3_DEATH_VIDEO_H
#include "battle-death.h"
extern uint8_t resident_dead,death_video_error;
/* Exclusive death/settled-map owner. Residual result is D740..D77F. */
uint8_t ff3_enemy_build(uint8_t page,uint8_t flash,const Ff3Death*d,uint8_t mask) BANKED;
void ff3_enemy_saved(uint8_t page,uint8_t*out) BANKED;
uint8_t ff3_death_video(uint8_t owner) BANKED;
void ff3_death_video_reset(void) BANKED;
#endif
