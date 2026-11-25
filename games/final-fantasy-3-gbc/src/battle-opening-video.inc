/* Bank 1 field workspace changes owner for the battle presentation lifetime.
 * The active stack and all timer/queue state retain their existing addresses. */
#include "battle-opening.h"
Ff3Opening __at(0xd000) opening_state;
extern const uint8_t opening_seeds[],opening_kinds[],opening_values[];
extern volatile uint8_t native_request,native_argument;
volatile uint8_t opening_request,opening_terminal,opening_profile;
volatile uint16_t opening_serial;
volatile uint16_t opening_prefetch_count,opening_prefetch_late,opening_prefetch_max_late;
volatile uint32_t opening_overlap_ticks;
static void opening_sound(uint8_t op,uint8_t arg){
 if(!op)return;
 while(native_request){ff3_native_service();__asm halt __endasm;}
 native_argument=arg;native_request=op;
 while(native_request){ff3_native_service();__asm halt __endasm;}
}
static void play_opening(void){ActionProfile profile;ActionEntry entry,peek;uint8_t n,request=255,ticket=0,kind,value;uint16_t now,until,begin,elapsed,available;
 if(window_owned||battle_active||scene_page>=ACTION_PROFILES){scene_error=15;return;}
 action_profile_index=scene_page;action_dirty=1;action_mask=0;opening_terminal=0;
 ff3_scene_rom_copy(16,opening_seeds+(uint16_t)action_profile_index*sizeof(Ff3Opening),&opening_state,sizeof(Ff3Opening));
 if(!ff3_opening_start(&opening_state)){scene_error=16;return;}
 ff3_scene_rom_copy(7,action_profiles+action_profile_index,&profile,sizeof(profile));
 for(n=0;n<profile.count&&!scene_error;n++){
  ff3_scene_rom_copy(7,action_entries+profile.first+n,&entry,sizeof(entry));
  if(entry.request!=request){
   if(request!=255&&!ff3_opening_ack(&opening_state,ticket,0)){scene_error=16;return;}
   request=entry.request;ticket=opening_state.ticket;
   ff3_scene_rom_copy(7,opening_kinds+(uint16_t)action_profile_index*64+request,&kind,1);
   ff3_scene_rom_copy(7,opening_values+(uint16_t)action_profile_index*64+request,&value,1);
   if(opening_state.pending!=kind||opening_state.value!=value){scene_error=16;return;}
   opening_request=request;opening_profile=action_profile_index;opening_serial++;
  }
  action_next_step=n;action_dirty|=action_ui_index!=entry.ui;action_ui_index=entry.ui;action_mask=entry.live;
  if(entry.run!=255){scene_page=entry.run;play_numbers();continue;}
  scene_page=entry.frame;show();if(scene_error)return;action_observe();
  opening_sound(entry.soundOp,entry.soundArg);
  CRITICAL{now=native_clock;}until=now+(uint16_t)(((uint32_t)entry.hold*ACTION_FRAME_NUM)/ACTION_FRAME_DEN);
  if(n+1<profile.count){
   ff3_scene_rom_copy(7,action_entries+profile.first+n+1,&peek,sizeof(peek));
   /* Speculate only immutable display data. The source caller is not acked,
    * and no future sound, state change or picture is published before until.
    * Numeral runs retain both OAM shadows and their dedicated scheduler. */
   if(peek.run==255){
    action_dirty|=action_ui_index!=peek.ui;action_ui_index=peek.ui;action_mask=peek.live;scene_page=peek.frame;
    CRITICAL{begin=native_clock;}
    stage_show();if(scene_error)return;
    CRITICAL{now=native_clock;}
    elapsed=now-begin;available=(int16_t)(until-begin)>0?until-begin:0;
    opening_overlap_ticks+=elapsed<available?elapsed:available;opening_prefetch_count++;
    if((int16_t)(now-until)>0){elapsed=now-until;opening_prefetch_late++;if(elapsed>opening_prefetch_max_late)opening_prefetch_max_late=elapsed;}
   }
  }
  scene_phase=10;
  do{CRITICAL{now=native_clock;}if((int16_t)(now-until)>=0)break;ff3_native_service();__asm halt __endasm;}while(!scene_error);
 }
 if(opening_state.phase||!(opening_state.pending==FF3_OPEN_SELECT||opening_state.pending==FF3_OPEN_VICTORY)){scene_error=16;return;}
 opening_terminal=opening_state.pending;
}
