/* Included inside the shared atlas translation unit: a separate UI layer and
 * original display-boundary stream, not another framebuffer implementation. */
static void play_action(void){ActionProfile profile;ActionEntry entry;uint8_t n;uint16_t until,now;
 if(window_owned||battle_active||scene_page>=ACTION_PROFILES){scene_error=15;return;}
 action_profile_index=scene_page;action_dirty=1;action_mask=0;
 ff3_scene_rom_copy(7,action_profiles+action_profile_index,&profile,sizeof(profile));
 for(n=0;n<profile.count&&!scene_error;n++){
  ff3_scene_rom_copy(7,action_entries+profile.first+n,&entry,sizeof(entry));
  action_next_step=n;action_dirty|=action_ui_index!=entry.ui;action_ui_index=entry.ui;action_mask=entry.live;
  if(entry.run!=255){scene_page=entry.run;play_numbers();continue;}
  scene_page=entry.frame;show();if(scene_error)return;action_observe();
  /* Preserve source hold counts after publication. Preparation cost is
   * measured separately; this does not claim whole-scene source cadence. */
  CRITICAL{now=native_clock;}
  until=now+(uint16_t)(((uint32_t)entry.hold*ACTION_FRAME_NUM)/ACTION_FRAME_DEN);
  while(!scene_error){CRITICAL{now=native_clock;}if((int16_t)(now-until)>=0)break;ff3_native_service();__asm halt __endasm;}
 }
}
