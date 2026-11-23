#ifndef FF3_MAP_DISPLAY_H
#define FF3_MAP_DISPLAY_H
#include "assets.h"
/* Static pre-event normal-map assets. No player/NPC/collision rules or water tick. */
uint8_t ff3_map_display(uint8_t world,uint8_t id,uint8_t x,uint8_t y) BANKED;
/* Bank-1 workspace, compatible with the existing map+7-byte field-event prefix.
 * Occupies D000..D7EE, leaves D7EF unused and the D7F0 stack guard intact. */
typedef struct {uint8_t tiles[1024],event[7],metas[512],attributes[128],collision[256],properties[16],row[20],attr_row[20],tile[16];uint16_t palette[16];} FF3MapWorkspace;
extern FF3MapWorkspace __at(0xd000) map_workspace;
#endif
