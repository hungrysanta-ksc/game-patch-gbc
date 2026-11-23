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
void ff3_platform_init(void){
 /* Keep WRAM bank 1 selected: changing SVBK would also switch the live stack.
  * Banks 2..7 need a separate stack-safe access layer before they can be used. */
 SVBK_REG=1;rROMB1=0;SWITCH_ROM(1);platform_error=0;platform_checks=0;
 ff3_state_init(ff3_game_state);
 memset((void*)FF3_STACK_GUARD,0xa7,16);
}
void ff3_platform_check(void){uint8_t i,saved=CURRENT_BANK;platform_checks++;
 if(!platform_error)ff3_platform_probe();if(CURRENT_BANK!=saved||platform_probe_failures)platform_error=4;
 if((SVBK_REG&7)!=1)platform_error=2;
 for(i=0;i<16;i++)if(((volatile uint8_t*)FF3_STACK_GUARD)[i]!=0xa7)platform_error=3;
}
