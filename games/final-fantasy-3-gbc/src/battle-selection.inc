/* Included in the shared atlas, using the same inactive-page and audio pump.
 * One actor's selection boundary; dispatch is consumed by a future battle
 * caller. It must not run a made-up attack or the unrelated item diagnostic. */
static uint16_t selection_observed;
static uint8_t selection_held,selection_repeat,selection_delay;
static uint8_t selection_glyphs_loaded[2];
#ifdef FF3_PARTY_COMMANDS
#include "battle-party-flow.inc"
#define SELECTION_VIEW (selection_back*5+selection_party.actor)
#else
#define SELECTION_VIEW selection_back
#endif
#ifdef FF3_ITEM_WINDOW
#include "battle-item-flow.inc"
#endif
static void selection_cursor(uint8_t page){uint8_t id=0,i,*oam=page?scene_oam1:scene_oam0;
 ff3_scene_rom_copy(target.bank,target.oam,oam,160);
 for(i=0;i<target.objects;i++)oam[i*4+2]+=page*64;
 if(selection_mode==2)return;
 if(selection_mode==1
#ifdef FF3_ITEM_WINDOW
 ||selection_mode==4
#endif
 ){uint8_t mask=selection_target.ad?selection_target.ad:(selection_target.ae&240);for(i=0;i<8;i++)if(mask&(128>>i)){id=1+i+(selection_target.ad?0:8);break;}}
 memmove(oam+16,oam,(uint16_t)target.objects*4);
 ff3_scene_rom_copy(7,selection_cursors+(uint16_t)SELECTION_VIEW*208+(uint16_t)id*16,oam,16);
 for(i=0;i<4;i++){uint8_t at=i*4;oam[at+2]+=page*64;if(selection_mode==0)oam[at]+=selection_row*8;}
 if(!selection_glyphs_loaded[page]){ff3_scene_rom_copy(7,selection_glyphs,text_staging,64);queue(7,text_staging,1,0x83c0u+(uint16_t)page*1024,64);flush();selection_glyphs_loaded[page]=1;}
}
static void selection_begin(void){
 #ifdef FF3_ITEM_WINDOW
 /* scene_page carries the requested normal/back selector here, not the
  * outgoing actor frame. Close with that frame so the restored atlas page
  * is tagged correctly before a different formation reuses its cache. */
 if(item_visible){uint8_t back=scene_page;
  ff3_scene_rom_copy(7,selection_frames+SELECTION_VIEW,(void*)&scene_page,1);
  item_leave();scene_page=back;
 }
#endif
 if(scene_page>1||battle_active){scene_error=16;return;}selection_back=scene_page;
#ifdef FF3_ITEM_WINDOW
 ff3_scene_rom_copy(7,item_source_status+(uint16_t)selection_back*8,item_monster_status,8);
#endif
 ff3_scene_rom_copy(7,selection_envs+(uint16_t)selection_back*25,&selection_env,25);if(!ff3_target_valid(&selection_env)){scene_error=16;return;}
 ff3_scene_rom_copy(7,selection_commands,selection_commands_local,4);memset(&selection_target,0,sizeof(selection_target));
 selection_row=selection_mode=selection_dispatch=selection_left=selection_right=selection_sound=0;selection_enabled=1;
 selection_held=selection_delay=0;selection_repeat=8;
 selection_glyphs_loaded[0]=selection_glyphs_loaded[1]=0;
#ifdef FF3_PARTY_COMMANDS
 memset(&selection_party,0,sizeof(selection_party));memset(party_used_equipped,0,4);memset(selection_party.command,255,4);party_valid_pages=0;party_enter();
#endif
 action_profile_index=4+selection_back;action_mask=3;ff3_scene_rom_copy(7,selection_uis+selection_back,&action_ui_index,1);ff3_scene_rom_copy(7,selection_frames+SELECTION_VIEW,(void*)&scene_page,1);action_dirty=1;show();selection_serial++;
 /* Warm the inactive page before accepting a key. Moving the hand must not
  * pay a first-use geometry/UI upload or re-upload its invariant 64 bytes. */
 if(!scene_error)prepare(active_page^1);
}
static void selection_input(void){uint8_t key=selection_buttons,bit=key&((uint8_t)(~key)+1),row=selection_row;
 if(!selection_enabled||selection_mode==2){scene_error=16;return;}
#ifdef FF3_ITEM_WINDOW
 /* The diagnostic request carries a normal/back selector in scene_page.
  * Resolve the current actor's actual frame before a submenu can prepare it. */
 ff3_scene_rom_copy(7,selection_frames+SELECTION_VIEW,(void*)&scene_page,1);
#endif
#ifdef FF3_PARTY_COMMANDS
 #ifdef FF3_ITEM_WINDOW
 if(selection_mode>=3)item_key(key);else
#endif
 party_key(key);
#else
 if(selection_mode==0){
  if(key)selection_sound=0x98;
  selection_row=ff3_command_cursor(row,0,key);
  if(bit==1){selection_sound=0x85;selection_dispatch=selection_commands_local[selection_row];
   if(selection_dispatch==4){selection_target.sound=selection_sound;ff3_target_begin(&selection_target,&selection_env,0);selection_mode=1;selection_dispatch=0;selection_repeat=16;selection_delay=0;}else selection_mode=2;
  }else if(bit==2){selection_row=0;selection_left=selection_right=0;}
  else if(bit==64){if(selection_left){selection_sound=0x85;selection_dispatch=selection_back?3:2;selection_mode=2;}else{selection_left=1;selection_right=0;}}
  else if(bit==128){if(selection_right){selection_sound=0x85;selection_dispatch=selection_back?2:3;selection_mode=2;}else{selection_right=1;selection_left=0;}}
 }else{
  ff3_target_input(&selection_target,&selection_env,key);selection_sound=selection_target.sound;
  if(!selection_target.ad&&!selection_target.ae){if(selection_target.b4){selection_dispatch=4;selection_mode=2;}else{selection_mode=selection_row=selection_left=selection_right=0;}}
 }
#endif
 #ifdef FF3_ITEM_WINDOW
 if(selection_mode==3||(selection_mode==4&&!item_hp)){item_show();selection_serial++;return;}
#endif
 /* Publish geometry, UI and hand together on the inactive page.
  * Hidden/selected cursor states never modify an active OAM shadow. */
 ff3_scene_rom_copy(7,selection_frames+SELECTION_VIEW,(void*)&scene_page,1);
 action_dirty=1;show();selection_serial++;
#ifdef FF3_PARTY_COMMANDS
 /* An actor/HP change must finish warming both pages before accepting the
  * next cursor key; otherwise that key inherits the old page's upload. */
 if(!scene_error&&(last_frame[active_page^1]!=scene_page||memcmp(party_cached_commands+(active_page^1)*4,party_display_commands,4)))prepare(active_page^1);
#endif
}
void ff3_selection_poll(void) BANKED {uint16_t now;uint8_t gb,keys,pressed;
 CRITICAL{now=sys_time;}if(now==selection_observed||!selection_enabled||selection_mode==2)return;selection_observed=now;
 #ifdef FF3_ITEM_WINDOW
 if(item_raster_fault){scene_error=17;return;}
 if(selection_mode==3){if(item_wait)item_wait--;else if(!scene_request){item_wait=8;scene_request=10;return;}}
#endif
 if(selection_delay){selection_delay--;return;}gb=joypad();keys=(gb>>4)|((gb&4)<<2)|((gb&8)<<2)|((gb&2)<<5)|((gb&1)<<7);
 pressed=ff3_input_repeat(selection_held,keys,&selection_repeat);selection_held=keys;if(!pressed)return;
 selection_buttons=pressed;scene_request=9;if(selection_mode==0)selection_delay=3;
}
