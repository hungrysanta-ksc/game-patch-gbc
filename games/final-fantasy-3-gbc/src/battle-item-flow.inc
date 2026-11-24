/* 35/ADAF..B5FF item-list caller. The persistent bag remains canonical;
 * only column graphics, cursor state and a pending action are cached. */
static void item_column(uint8_t column,uint8_t slot,uint8_t offset){uint8_t r;
 item_loading_slot=slot;scene_phase=10;
 for(r=0;r<6;r++){ff3_item_render_row(column,r,column==item_cursor.column?item_cursor.row:255,offset,selection_party.actor,text_staging);queue(7,text_staging,0,0x8000u+(uint16_t)slot*960+(uint16_t)r*160,160);flush();}
 item_loading_slot=255;
}
static void item_map(uint8_t page,uint8_t a,uint8_t b,uint8_t c){uint8_t r,x,slot,*attrs=text_staging;
 scene_phase=10;
 if(item_map_slots[page*3]==a&&item_map_slots[page*3+1]==b&&item_map_slots[page*3+2]==c)return;
 if(!(item_maps&(1<<page))){queue(target.bank,target.maps,0,page?0x9c00u:0x9800u,416);queue(target.bank,target.maps+1216,1,page?0x9c00u:0x9800u,416);flush();item_maps|=1<<page;}
 for(r=0;r<6;r++){for(x=0;x<32;x++){slot=x<10?a:x<20?b:c;scene_input[r*32+x]=slot*60+r*10+(x<10?x:x<20?x-10:x-20);attrs[r*32+x]=7;}ff3_native_service();}
 queue(7,scene_input,0,(page?0x9c00u:0x9800u)+416,192);queue(7,attrs,1,(page?0x9c00u:0x9800u)+416,192);flush();
 item_map_slots[page*3]=a;item_map_slots[page*3+1]=b;item_map_slots[page*3+2]=c;
}
static void item_hand(uint8_t *oam,uint8_t row,uint8_t column,uint8_t scroll,uint8_t selected){uint8_t i,left;
 if(column<scroll||column>scroll+1){memset(oam,0,16);return;}
 ff3_scene_rom_copy(7,selection_cursors+(uint16_t)SELECTION_VIEW*208,oam,16);left=oam[1];for(i=1;i<4;i++)if(oam[i*4+1]<left)left=oam[i*4+1];
 for(i=0;i<4;i++){oam[i*4]=oam[i*4]+row*8;oam[i*4+1]=oam[i*4+1]-left+8+(column-scroll)*80+selected*4;oam[i*4+2]+=64;}
}
static void item_oam(uint8_t page){uint8_t i,n=0,*oam=page?scene_oam1:scene_oam0;scene_phase=10;
 memset(oam,0,160);
 if(selection_mode==3){item_hand(oam,item_cursor.row,item_cursor.column,item_cursor.scroll,0);n=4;if(item_cursor.selected){item_hand(oam+16,item_cursor.saved_row,item_cursor.saved_column,item_cursor.scroll,1);n=8;}}
 else if(selection_mode==4){uint8_t mask=selection_target.ad?selection_target.ad:selection_target.ae,start=0;
  /* Source 32/9A69 renders at most four enemy hands in a phase. */
  if(selection_target.ad&&!(mask&240))start=4;
  for(i=start;i<start+4;i++)if(mask&(128>>i)){ff3_scene_rom_copy(7,selection_cursors+(uint16_t)SELECTION_VIEW*208+(uint16_t)(1+i+(selection_target.ad?0:8))*16,oam+n*4,16);n+=4;}
  for(i=0;i<n;i++)oam[i*4+2]+=64;
 }
 ff3_scene_rom_copy(target.bank,target.oam,oam+n*4,(uint16_t)target.objects*4);
 for(i=n;i<n+target.objects;i++)oam[i*4+2]+=64;
}
static void item_publish(uint8_t page,uint8_t scroll){item_oam(page);item_next_visible=1;item_next_scroll=scroll;scene_phase=10;ff3_scene_publish(page,0,0,6);active_page=page;scene_frames++;}
static void item_show(void){uint8_t page=active_page^1;item_map(page,item_slots[0],item_slots[1],3-item_slots[0]-item_slots[1]);item_publish(page,0);}
static void item_open(void){
 if(active_page!=1){prepare(1);ff3_scene_publish(1,0,0,6);active_page=1;}
 CRITICAL{IE_REG|=LCD_IFLAG;}
 ff3_item_begin(&item_cursor);selection_mode=3;selection_repeat=8;selection_delay=0;item_hp=item_marquee=item_marquee_reverse=0;item_wait=24;item_maps=2;item_slots[0]=0;item_slots[1]=1;
 memset(item_map_slots,255,6);item_column(1,0,0);item_column(2,1,0);
}
static void item_leave(void){
 uint8_t i;
 if(item_visible){
  /* Restore only the reserved UI tiles in pinned bank 1 first. Restoring
   * bank 0 geometry while its unsigned item tiles are visible would tear. */
  if(active_page==1)item_show();
  scene_phase=11;overlay(1);party_valid_pages=0;party_overlay(1);
  ff3_scene_rom_copy(target.bank,target.oam,scene_oam1,160);for(i=0;i<target.objects;i++)scene_oam1[i*4+2]+=64;
  item_next_visible=0;item_next_scroll=0;ff3_scene_publish(1,0,0,6);active_page=1;last_frame[1]=scene_page;
 }
 item_next_visible=0;item_next_scroll=0;last_frame[0]=255;action_tiles[0]=255;party_valid_pages=0;
}
static void item_update_equipment(void){uint16_t at=(uint16_t)selection_party.actor*64;
 /* Bank 5 $400..4FF owns derived equipment records. UI scratch is borrowed
  * only after the closing publication has finished. Never map the stack. */
 ff3_native_service();
 if(!ff3_wram_copy(5,0x400u+at,scene_input,64,0)){scene_error=18;return;}
 ff3_equipment_update(ff3_game_state+0x100u+at,ff3_game_state+0x200u+at,scene_input);
 if(!ff3_wram_copy(5,0x400u+at,scene_input,64,1))scene_error=18;
 ff3_native_service();
}
static void item_move(uint8_t old_scroll){uint8_t page,i,spare=3-item_slots[0]-item_slots[1],right=item_cursor.scroll>old_scroll;
 item_column(right?item_cursor.scroll+1:item_cursor.scroll,spare,0);
 page=active_page^1;item_map(page,right?item_slots[0]:spare,right?item_slots[1]:item_slots[0],right?spare:item_slots[1]);
 /* Publish the preloaded map at the old view before its six motion frames.
  * The list hands are hidden during the original scroll transition. */
 memset(page?scene_oam1:scene_oam0,0,160);ff3_scene_rom_copy(target.bank,target.oam,page?scene_oam1:scene_oam0,160);
 for(i=0;i<target.objects;i++)(page?scene_oam1:scene_oam0)[i*4+2]+=64;
 item_next_scroll=right?0:80;item_next_visible=1;ff3_scene_publish(page,0,0,6);active_page=page;
 /* Arm after the initial map/OAM publication. The six VBlank steps do not
  * wait for a foreground music decode to finish; audio remains serviced. */
 item_scroll_right=right;item_scroll_step=1;
 while(item_scroll_step){ff3_native_service();if(item_scroll_step){__asm halt __endasm;}}
 if(right){item_slots[0]=item_slots[1];item_slots[1]=spare;}else{item_slots[1]=item_slots[0];item_slots[0]=spare;}
}
static void item_reserve(void){uint8_t actor=selection_party.actor,at=actor*3;
 selection_party.action[at]=item_id;
 if(!item_cursor.column){selection_party.used[actor]=item_id;party_used_equipped[actor]=1;}
 else if(!ff3_inventory_reserve(ff3_game_state+0xc0,(item_cursor.column-1)*4+item_cursor.row,selection_party.used+actor)){scene_error=18;return;}
 item_leave();item_update_equipment();selection_party.actor++;party_enter();
}
static void item_use(void){uint8_t actor=selection_party.actor,at=actor*3,property,i,mask=0;
 item_id=ff3_item_byte(item_cursor.column,item_cursor.row,actor,0);
 selection_party.action[at]=item_id;if(item_id)selection_party.flags[actor]|=8;
 item_hp=item_id==0xa6||item_id==0xa7||item_id==0xa8;
 if(!item_id||item_id>=0xc8||(item_id>=0x57&&item_id<0x98)||(item_cursor.column&&!ff3_item_eligible(item_id,actor))){selection_party.action[at]=0;selection_sound=0x86;return;}
 selection_sound=0x85;property=ff3_item_property(item_id);
 if(!(property&0x18)){item_reserve();return;}
 if(property&0x40){for(i=0;i<8;i++)if(!(item_monster_status[i]&0xc0))mask|=128>>i;selection_party.action[at+1]=mask;selection_party.action[at+2]=0xc0;item_reserve();return;}
 selection_target.selected=selection_party.selected[actor];selection_target.sound=selection_sound;ff3_target_begin(&selection_target,&selection_env,((property&0x20)?0:1)|((property&0x80)?2:0));selection_mode=4;selection_repeat=16;
 if(item_hp)item_leave();
}
static void item_key(uint8_t key){uint8_t old=item_cursor.scroll,oldrow=item_cursor.row,oldcol=item_cursor.column,event,actor=selection_party.actor,at=actor*3;
 if(selection_mode==4){ff3_target_input(&selection_target,&selection_env,key);selection_sound=selection_target.sound;selection_party.selected[actor]=selection_target.selected;
  if(!selection_target.ad&&!selection_target.ae){if(selection_target.b4){selection_party.action[at+1]=selection_target.b4;selection_party.action[at+2]=selection_target.b5;item_reserve();}else{item_leave();item_update_equipment();party_enter();}}return;
 }
 event=ff3_item_input(&item_cursor,key);if(key&240)selection_sound=0x98;
 if(event==FF3_ITEM_CLOSE){item_leave();item_update_equipment();party_enter();return;}
 if(event==FF3_ITEM_EQUIP){uint8_t col=item_cursor.column?item_cursor.column:item_cursor.saved_column,r=item_cursor.column?item_cursor.row:item_cursor.saved_row;
  uint8_t id=ff3_item_byte(col,r,actor,0),eligible=ff3_item_eligible(id,actor);
  if(!ff3_equipment_swap(ff3_game_state+0xc0,ff3_game_state+0x200u+(uint16_t)actor*64,&item_cursor,eligible)){selection_sound=0x86;return;}
  selection_sound=0x85;item_leave();item_update_equipment();party_enter();return;
 }
 if(event==FF3_ITEM_ERROR){selection_sound=0x86;return;}
 if(event==FF3_ITEM_USE){item_use();return;}
 if(key==1){selection_sound=0x85;selection_delay=16;}
 if(oldrow!=item_cursor.row||oldcol!=item_cursor.column){
  if(item_marquee){uint8_t slot=3-item_slots[0]-item_slots[1];item_column(oldcol,slot,0);item_slots[oldcol-old]=slot;}
  item_marquee=item_marquee_reverse=0;item_wait=24;
 }
 if(old!=item_cursor.scroll)item_move(old);
}
static void item_marquee_step(void){uint8_t width,id,spare,index;
 id=ff3_item_byte(item_cursor.column,item_cursor.row,selection_party.actor,0);if(!id)return;width=ff3_item_width(id);if(width<=36)return;
 if(!item_marquee_reverse){if(item_marquee+2>=width-36){item_marquee=width-36;item_marquee_reverse=1;item_wait=24;}else item_marquee+=2;}
 else if(item_marquee<=2){item_marquee=0;item_marquee_reverse=0;item_wait=24;}else item_marquee-=2;
 spare=3-item_slots[0]-item_slots[1];item_column(item_cursor.column,spare,item_marquee);index=item_cursor.column-item_cursor.scroll;item_slots[index]=spare;item_show();
}
