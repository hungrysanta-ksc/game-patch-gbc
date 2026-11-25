/* Standalone diagnostic only. Link the actual optimized engine/channel
 * objects, and compare every 16-bit address against separately mapped ROM. */
#pragma bank 9
#include <gb/cgb.h>
#include "audio-engine.h"
volatile uint8_t state_ready,state_start,state_status,state_failure;
volatile uint16_t state_index;
volatile uint32_t state_case;
static uint8_t reference_error;
uint8_t ff3_rom_byte(uint8_t source,uint16_t offset) NONBANKED {
 uint8_t saved=CURRENT_BANK,bank=source==9?5:source-0x35,value;
 if(offset>=8192||bank<1||bank>5){state_failure=10;return 0;}
 SWITCH_ROM(bank);value=*(const uint8_t*)(0x4000u+offset);SWITCH_ROM(saved);return value;
}
void ff3_output(uint8_t reg,uint8_t value) NONBANKED {state_failure=11;}
static uint16_t actual(uint16_t address) NONBANKED {
 uint8_t saved=CURRENT_BANK;uint16_t value;
 SWITCH_ROM(8);value=ff3_engine_read_word(address);SWITCH_ROM(saved);return value;
}
static uint8_t reference(uint16_t a,uint8_t song){uint8_t index,bank;
 if(a>=0x8000&&a<0xa000)return ff3_rom_byte(0x36,a&8191);
 if(a<0xa000||a>=0xc000){reference_error=2;return 0;}
 index=song<0x19?0:song<0x2b?1:song<0x3b?2:3;
 bank=ff3_rom_byte(0x36,0x9bf+index);return ff3_rom_byte(bank,a&8191);
}
static void run(void) BANKED {uint8_t i,lo;uint16_t expected,value;
 static const uint8_t songs[]={0,0x19,0x2b,0x3b,0x40};
 for(i=0;i<5;i++){
  ff3_state.ram[3]=songs[i];state_index=0;
  do{reference_error=0;lo=reference(state_index,songs[i]);expected=lo|((uint16_t)reference((uint16_t)(state_index+1),songs[i])<<8);
   ff3_error=0;value=actual(state_index);
   if(state_failure||value!=expected||ff3_error!=reference_error){if(!state_failure)state_failure=value!=expected?1:2;state_status=2;return;}
   state_case++;state_index++;
  }while(state_index);
 }
 for(i=0;i<192;i++)if(i!=3&&ff3_state.ram[i])state_failure=3;
 for(i=0;i<24;i++)if(ff3_state.apu[i])state_failure=4;
 state_status=state_failure?2:1;
}
void main(void) NONBANKED {cpu_fast();state_ready=0xa5;while(!state_start){__asm halt __endasm;}run();while(1){__asm halt __endasm;}}
