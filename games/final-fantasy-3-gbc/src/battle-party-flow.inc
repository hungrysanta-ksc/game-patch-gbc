/* Original 34/986F collector + 35/A843/A877/A8AB reservation boundaries.
 * Only the current diagnostic job/formation is supplied by this bridge.
 * AUTO, row changes and submenus remain explicit callers. Reservation
 * returns borrow the persistent canonical bag, never a display-only copy. */
/* Fixed 80-byte transparent mask merge. Stack ABI is explicit; no bank
 * switching or interrupt masking. Service audio between these short runs. */
static void party_or(uint8_t *destination,const uint8_t *mask) __sdcccall(0) __naked {__asm
 ldhl sp,#2
 ld a,(hl+)
 ld e,a
 ld a,(hl+)
 ld d,a
 ld a,(hl+)
 ld h,(hl)
 ld l,a
 ld b,#80
93001$:
 ld a,(de)
 or (hl)
 ld (de),a
 inc de
 inc hl
 dec b
 jr nz,93001$
 ret
 __endasm;}
static void party_overlay(uint8_t page){uint8_t r,x,n,variant,cmd,*mask=(uint8_t*)scene_keys;uint16_t at;
 if((party_valid_pages&(1<<page))&&last_frame[page]==scene_page&&!memcmp(party_cached_commands+page*4,party_display_commands,4))return;
 ff3_scene_rom_copy(7,party_ui_base,text_staging,400);
 for(r=0;r<4;r++){
  cmd=party_display_commands[r];if(cmd!=255&&cmd!=4&&cmd!=5&&cmd!=6
#ifdef FF3_ITEM_WINDOW
 &&cmd!=20
#endif
 ){scene_error=16;return;}
  variant=cmd==255?0:cmd-3;
#ifdef FF3_ITEM_WINDOW
  if(cmd==20)variant=4;
#endif
  for(n=0;n<2;n++){
   ff3_scene_rom_copy(7,party_ui_masks+(uint16_t)variant*160+(uint16_t)n*80,mask,80);
   party_or(text_staging+(uint16_t)(r+n)*80,mask);ff3_native_service();
  }
 }
 queue(7,text_staging,page,0x9670u,400);flush();
#ifdef FF3_ITEM_WINDOW
 if(selection_mode==4&&item_hp){memset(text_staging,0,16);queue(7,text_staging,page,0x9660u,16);flush();}
#endif
 /* scene_input aliases the tail of the 400-byte glyph staging region.
  * The preceding flush is mandatory before composing map rows here. */
 ff3_scene_rom_copy(7,action_cells+(uint16_t)action_ui_index*120,scene_keys,120);
 for(r=0;r<5;r++){
  at=(uint16_t)(14+r)*32;
  ff3_scene_rom_copy(target.bank,target.maps+at,scene_input+r*32,32);
  ff3_scene_rom_copy(target.bank,target.maps+(page?1216u:608u)+at,text_staging+r*32,32);
  for(x=0;x<20;x++){
   scene_input[r*32+x]=x<15?((uint8_t*)scene_keys)[(r+1)*20+x]:103+r*5+x-15;
   text_staging[r*32+x]=7|(page?8:0);
#ifdef FF3_ITEM_WINDOW
   if(selection_mode==4&&item_hp&&x<6)scene_input[r*32+x]=102;
#endif
  }
  queue(7,scene_input+r*32,0,(page?0x9c00u:0x9800u)+at,32);
  queue(7,text_staging+r*32,1,(page?0x9c00u:0x9800u)+at,32);ff3_native_service();
 }
 flush();memcpy(party_cached_commands+page*4,party_display_commands,4);party_valid_pages|=1<<page;
}
static void party_enter(void){
#ifdef FF3_ITEM_WINDOW
 party_valid_pages=0;
#endif
 ff3_party_enter(&selection_party);
 if(selection_party.phase==FF3_PARTY_RETURN_ITEM){
  if(!ff3_inventory_return(ff3_game_state+0xc0,selection_party.used+selection_party.actor,party_used_equipped+selection_party.actor)){scene_error=16;return;}
  selection_party.phase=FF3_PARTY_SELECT;
 }
 memcpy(party_display_commands,selection_party.command,4);
 selection_mode=selection_party.phase==FF3_PARTY_SELECT?0:2;
 selection_row=selection_left=selection_right=selection_dispatch=0;selection_repeat=8;selection_delay=0;
}
static void party_key(uint8_t key){uint8_t bit=key&((uint8_t)(~key)+1),command,slot;
 if(selection_mode==0){
  if(key)selection_sound=0x98;selection_row=ff3_command_cursor(selection_row,0,key);
  if(bit==2){ff3_party_previous(&selection_party);party_enter();return;}
  slot=selection_row;
  if(bit==64){if(!selection_left){selection_left=1;selection_right=0;return;}slot=selection_back?5:4;}
  else if(bit==128){if(!selection_right){selection_right=1;selection_left=0;return;}slot=selection_back?4:5;}
  else if(bit!=1)return;
  command=slot<4?selection_commands_local[slot]:slot-2;selection_sound=0x85;
  ff3_party_pick(&selection_party,slot,command);
  #ifdef FF3_ITEM_WINDOW
  if(command==20){item_open();return;}
#endif
  if(command==4){selection_target.selected=selection_party.selected[selection_party.actor];selection_target.sound=selection_sound;ff3_target_begin(&selection_target,&selection_env,0);selection_mode=1;selection_repeat=16;selection_delay=0;}
  else if(ff3_party_accept(&selection_party,command,0,0))party_enter();
  else{selection_dispatch=command;selection_party.phase=FF3_PARTY_CALLER;selection_mode=2;}
 }else{
  ff3_target_input(&selection_target,&selection_env,key);selection_sound=selection_target.sound;
  selection_party.selected[selection_party.actor]=selection_target.selected;
  if(!selection_target.ad&&!selection_target.ae){ff3_party_accept(&selection_party,4,selection_target.b4,selection_target.b5);party_enter();}
 }
}
