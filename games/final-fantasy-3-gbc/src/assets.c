#include <string.h>
#include "assets.h"
#include "asset-directory.h"
#ifdef FF3_SCENE_LAYOUT
#define ASSET_PRESENT(n) (asset_present_bits[(n)>>3]&(1u<<((n)&7)))
#else
#define ASSET_PRESENT(n) asset_present[n]
#endif
volatile uint8_t asset_error;
uint8_t ff3_asset_open(uint8_t kind,uint16_t id,FF3Asset *out) NONBANKED {
 uint8_t saved,bytes[5];uint16_t at;
 if(kind>=ASSET_KINDS||id>=asset_counts[kind]){asset_error=1;return 0;}
 at=asset_offsets[kind]+id*5;saved=CURRENT_BANK;SWITCH_ROM(12);memcpy(bytes,(const void*)(0x4000u+at),5);SWITCH_ROM(saved);
 if(bytes[0]<16||bytes[0]>=ASSET_BANKS||!ASSET_PRESENT(bytes[0])){asset_error=2;return 0;}
 at=(uint16_t)bytes[1]|((uint16_t)bytes[2]<<8);
 {uint16_t length=(uint16_t)bytes[3]|((uint16_t)bytes[4]<<8);if(at>=16384u||!length||length>16384u-at){asset_error=2;return 0;}out->bank=bytes[0];out->offset=at;out->length=length;}
 return 1;
}
uint8_t ff3_asset_read(const FF3Asset *asset,uint16_t offset,void *out,uint16_t bytes) NONBANKED {
 uint8_t saved;
 if(asset->bank<16||asset->bank>=ASSET_BANKS||!ASSET_PRESENT(asset->bank)||asset->offset>=16384u||!asset->length||asset->length>16384u-asset->offset||offset>asset->length||bytes>asset->length-offset){asset_error=3;return 0;}
 saved=CURRENT_BANK;SWITCH_ROM(asset->bank);memcpy(out,(const void*)(0x4000u+asset->offset+offset),bytes);SWITCH_ROM(saved);return 1;
}
