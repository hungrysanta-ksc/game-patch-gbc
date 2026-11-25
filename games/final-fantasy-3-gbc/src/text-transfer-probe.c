#include <gb/gb.h>
#include <gb/cgb.h>
#include "text-vblank.h"
volatile uint8_t state_ready,state_start,state_status,state_failure;
volatile uint32_t state_case;
volatile uint16_t state_index;
static const struct {uint8_t bank,rom;uint16_t dest,source,count;} invalid[]={
 {2,1,0x8000,0x4000,16},{0,0,0x8000,0x4000,16},{0,32,0x8000,0x4000,16},
 {0,255,0x8000,0x4000,16},{0,1,0x8001,0x4000,16},{0,1,0x8000,0x4001,16},
 {0,1,0x8000,0x3ff0,16},{0,1,0x8000,0x8000,16},{0,1,0x8000,0x7ff0,32},
 {0,1,0x97f0,0x4000,32},{0,1,0x9800,0x4000,16},{0,1,0x8000,0x4000,65520},
 {0,1,0x8000,0x4000,17}
};
void main(void){uint8_t i;DISPLAY_ON;state_ready=0xa5;while(!state_start){}
 text_transfer_fault=0;ff3_text_rom_copy(0,0x8000,1,(const uint8_t*)0x4000,16);
 if(!text_transfer_fault)state_failure=5;else state_case++;
 text_transfer_fault=0;ff3_text_clear_map(0);
 if(!text_transfer_fault)state_failure=6;else state_case++;
 cpu_fast();
 for(i=0;i<sizeof(invalid)/sizeof(invalid[0]);i++){
  text_transfer_fault=0;ff3_text_rom_copy(invalid[i].bank,invalid[i].dest,invalid[i].rom,(const uint8_t*)invalid[i].source,invalid[i].count);
  if(!text_transfer_fault){state_failure=1;break;}state_case++;
 }
 if(!state_failure){text_transfer_fault=0;ff3_text_clear_map(2);if(!text_transfer_fault)state_failure=2;else state_case++;}
 // A zero-length descriptor is an intentional no-op, even with dummy data.
 if(!state_failure){text_transfer_fault=0;ff3_text_rom_copy(0,0,0,0,0);if(text_transfer_fault)state_failure=3;else state_case++;}
 if(text_transfer_chunks||text_transfer_bytes)state_failure=4;
 state_status=state_failure?2:1;while(1){}
}
