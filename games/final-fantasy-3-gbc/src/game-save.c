#pragma bank 10
#include <string.h>
#include "game-state.h"
static uint8_t *slot_address(uint8_t slot){return (uint8_t*)(0xa000u+(uint16_t)(slot-1)*FF3_STATE_BYTES);}
uint8_t ff3_save_write(uint8_t slot,const uint8_t *state) BANKED {
 uint8_t valid;
 if(slot<1||slot>3||!ff3_state_valid(state)){DISABLE_RAM;return 0;}
 ENABLE_RAM;SWITCH_RAM(0);memcpy(slot_address(slot),state,FF3_STATE_BYTES);
 valid=memcmp(slot_address(slot),state,FF3_STATE_BYTES)==0;DISABLE_RAM;return valid;
}
uint8_t ff3_save_read(uint8_t slot,uint8_t *state) BANKED {
 uint8_t valid;
 if(slot<1||slot>3){DISABLE_RAM;return 0;}
 ENABLE_RAM;SWITCH_RAM(0);valid=ff3_state_valid(slot_address(slot));
 if(valid)memcpy(state,slot_address(slot),FF3_STATE_BYTES);
 DISABLE_RAM;return valid;
}
