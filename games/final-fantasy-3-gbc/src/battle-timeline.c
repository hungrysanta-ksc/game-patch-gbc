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
#ifdef FF3_OPENING_VIDEO
const uint8_t *battle_oam_source;
uint8_t battle_oam_bank,battle_oam_storage,battle_oam_objects;
#endif
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
#ifdef FF3_NUMBER_TIMELINE
 __asm ei __endasm;
 /* Anchor the first VBlank admission, not the longer first palette copy. */
 if(!next_entry){battle_origin=now;battle_due=now;}
 changed=1; /* Logical source waits survive visually identical frames. */
#else
 changed=!next_entry||battle_visuals[next_entry]!=battle_visuals[next_entry-1];
#endif
 if(changed){
  if(!battle_ready||supplied_entry!=next_entry){battle_misses++;scene_error=13;battle_active=0;
#ifdef FF3_NUMBER_TIMELINE
   __asm di __endasm;
#endif
   return;}
#ifdef FF3_NUMBER_TIMELINE
  ff3_number_commit(supplied_page);
  __asm ei __endasm;
#else
  ff3_battle_commit(supplied_page,0);
#endif
  battle_ready=0;
 }
#ifdef FF3_NUMBER_TIMELINE
 CRITICAL{battle_committed=native_clock;}
#else
 battle_committed=native_clock;
#endif
#ifndef FF3_NUMBER_TIMELINE
 if(!next_entry){battle_origin=battle_committed;battle_due=battle_origin;}
#endif
 battle_entry=next_entry;battle_serial++; /* Read-only trace publication, after LCDC/OAM. */
#ifdef FF3_ACTION_FLOW
 {extern volatile uint16_t action_serial;
  extern volatile uint8_t action_profile,action_step,action_live,action_frame;
  extern volatile uint8_t action_next_profile,action_next_step,action_next_live,action_next_frame;
  if(!next_entry){action_profile=action_next_profile;action_step=action_next_step;action_live=action_next_live;action_frame=action_next_frame;action_serial++;}}
#endif
 next_entry++;
 if(next_entry==BATTLE_ENTRY_COUNT){battle_active=0;
#ifdef FF3_NUMBER_TIMELINE
  __asm di __endasm;
#endif
  return;}
 battle_due=battle_origin+battle_offsets[next_entry];
#ifdef FF3_OPENING_VIDEO
 /* Pin the whole numeral run before admission. Copy the next immutable OAM
  * immediately after publication, with timer IRQs enabled. The main-thread
  * music decoder cannot delay a subsequent numeral supply. Restore ROM bank;
  * WRAM bank and stack never move. Only the inactive shadow is written. */
 {uint8_t i,page=supplied_page^1,*oam=page?scene_oam1:scene_oam0;
  ff3_scene_rom_copy(battle_oam_bank,battle_oam_source+(uint16_t)next_entry*160,oam,160);
  for(i=0;i<battle_oam_objects;i++)oam[i*4+2]+=battle_oam_storage*64;
  ff3_battle_supply(next_entry,page);
 }
#endif
#ifdef FF3_NUMBER_TIMELINE
 __asm di __endasm;
#endif
}
