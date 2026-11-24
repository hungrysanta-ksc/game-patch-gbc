#ifndef FF3_ITEM_RENDER_H
#define FF3_ITEM_RENDER_H
#include <gb/gb.h>
void ff3_item_render_row(uint8_t column,uint8_t tile_row,uint8_t selected_row,uint8_t offset,uint8_t actor,uint8_t *out) BANKED;
uint8_t ff3_item_byte(uint8_t column,uint8_t row,uint8_t actor,uint8_t quantity) BANKED;
uint8_t ff3_item_eligible(uint8_t id,uint8_t actor) BANKED;
uint8_t ff3_item_property(uint8_t id) BANKED;
uint8_t ff3_item_width(uint8_t id) BANKED;
#endif
