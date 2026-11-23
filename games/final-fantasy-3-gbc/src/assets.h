#ifndef FF3_ASSETS_H
#define FF3_ASSETS_H
#include <gb/gb.h>
enum {FF3_PROPERTIES,FF3_LAYOUT,FF3_GRAPHICS,FF3_METAS,FF3_ATTRIBUTES,FF3_PALETTE,FF3_COLLISION,FF3_FONT,FF3_SELECTION};
typedef struct {uint8_t bank;uint16_t offset,length;} FF3Asset;
/* Runtime handles remain in WRAM. No banked pointer escapes a read call. */
uint8_t ff3_asset_open(uint8_t kind,uint16_t id,FF3Asset *out) NONBANKED;
uint8_t ff3_asset_read(const FF3Asset *asset,uint16_t offset,void *out,uint16_t bytes) NONBANKED;
extern volatile uint8_t asset_error;
#endif
