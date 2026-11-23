#include <gb/cgb.h>
#include "platform.h"
#include "composition-window.h"
#include "battle-timeline.h"
#include "battle-timeline-data.h"
/* Fixed-ROM metadata and fixed WRAM: IRQ never reads the switched asset bank.
 * Absolute source offsets avoid accumulating GBC VBlank quantization error. */
volatile uint8_t battle_active,battle_entry=255,battle_ready,battle_serial;
volatile uint16_t battle_run,battle_origin,battle_due,battle_committed,battle_prepared,battle_misses;
static uint8_t next_entry,supplied_entry,supplied_page;
extern volatile uint16_t native_clock;
void ff3_battle_supply(uint8_t entry,uint8_t page) NONBANKED {
 if(battle_ready){scene_error=12;return;}
 CRITICAL{supplied_entry=entry;supplied_page=page;battle_prepared=native_clock;battle_ready=1;}
}
void ff3_battle_start(uint8_t page) NONBANKED {
 if(battle_active||battle_ready){scene_error=12;return;}
 CRITICAL{next_entry=0;battle_entry=255;battle_run++;supplied_entry=0;supplied_page=page;battle_prepared=native_clock;battle_ready=1;battle_active=1;}
}
void ff3_battle_vblank(void) NONBANKED {
 uint16_t now=native_clock;uint8_t changed;
 if(!battle_active)return;
 if(next_entry&&((int16_t)(now-battle_due)<0))return;
 changed=!next_entry||battle_visuals[next_entry]!=battle_visuals[next_entry-1];
 if(changed){
  if(!battle_ready||supplied_entry!=next_entry){battle_misses++;scene_error=13;battle_active=0;return;}
  ff3_battle_commit(supplied_page,0);battle_ready=0;
 }
 battle_committed=native_clock;if(!next_entry){battle_origin=battle_committed;battle_due=battle_origin;}
 battle_entry=next_entry;battle_serial++; /* Read-only trace publication, after LCDC/OAM. */
 next_entry++;
 if(next_entry==BATTLE_ENTRY_COUNT){battle_active=0;return;}
 battle_due=battle_origin+battle_offsets[next_entry];
}
