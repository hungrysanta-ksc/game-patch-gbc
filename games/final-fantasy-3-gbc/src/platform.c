#include <gb/cgb.h>
#include <string.h>
#include "platform.h"
#include "game-state.h"
#include "resource-assets.h"
extern volatile uint16_t native_clock;
uint8_t ff3_game_state[1024];
volatile uint8_t platform_error;
volatile uint16_t platform_checks;
static uint8_t valid(uint8_t bank,uint16_t offset,uint16_t count){
 if(bank>=RESOURCE_BANKS||offset>resource_lengths[bank]||count>resource_lengths[bank]-offset||!resource_lengths[bank]){platform_error=1;return 0;}return 1;
}
uint8_t ff3_resource_byte(uint8_t bank,uint16_t offset) NONBANKED {
 uint8_t saved,value;if(!valid(bank,offset,1))return 0;
 saved=CURRENT_BANK;SWITCH_ROM(bank);value=*(const uint8_t*)(0x4000u+offset);SWITCH_ROM(saved);return value;
}
uint8_t ff3_resource_copy(void *dest,uint8_t bank,uint16_t offset,uint16_t count) NONBANKED {
 uint8_t saved;if(!valid(bank,offset,count))return 0;
 saved=CURRENT_BANK;SWITCH_ROM(bank);memcpy(dest,(const void*)(0x4000u+offset),count);SWITCH_ROM(saved);return 1;
}
uint16_t ff3_clock_now(void) NONBANKED {uint16_t t;CRITICAL{t=native_clock;}return t;}
#ifndef FF3_SCENE_LAYOUT
#include "platform-boot.inc"
#endif
