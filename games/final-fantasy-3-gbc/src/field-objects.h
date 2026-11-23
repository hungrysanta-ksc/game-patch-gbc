#ifndef FF3_FIELD_OBJECTS_H
#define FF3_FIELD_OBJECTS_H
#include "map-display.h"
enum {FF3_PLACEMENTS=9,FF3_NPC_GRAPHICS,FF3_NPC_SELECTION,FF3_NPC_SPEED,FF3_NPC_POSES,FF3_NPC_PALETTE};
/* NES $7000..70BF / $7100..71BF, including untouched/reserved bytes. */
extern uint8_t object_part1[192],object_part2[192];
extern volatile uint8_t object_count,object_oam_count,object_line_peak;
/* Map assets must already be resident. flags points to GameState+0x80.
 * Initializes original object state; no movement, interaction or event tick. */
uint8_t ff3_objects_init(uint8_t world,uint8_t list,const uint8_t *flags) BANKED;
/* Static inspection pose: phase 0/1 within the initial direction's two frames.
 * This is NOT the original animation clock or special multi-slot animation.
 * Rejects OAM/scanline overflow explicitly, without publishing a partial list. */
uint8_t ff3_objects_display(uint8_t world,uint8_t id,uint8_t x,uint8_t y,uint8_t phase) BANKED;
#endif
