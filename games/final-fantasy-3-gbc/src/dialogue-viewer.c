#include <gb/cgb.h>
#include <string.h>
#include "field-objects.h"
#include "game-state.h"
#include "npc-dialogue.h"
#include "dialogue-config.h"
#include "text-vblank.h"
#ifdef FF3_TEXT_AUDIO
#include "platform.h"
#include "memory.h"
void ff3_native_begin(void) NONBANKED;
void ff3_native_service(void) NONBANKED;
#define text_game_state ff3_game_state
#else
uint8_t text_game_state[1024];
#endif
uint16_t dialogue_name_state[24],number_output[7];
volatile uint8_t text_ready,text_request,text_view_error,text_key_press,text_polled_keys;
volatile uint16_t text_selection,text_loads;
volatile uint8_t dialogue_world=DIALOGUE_WORLD,dialogue_npc=DIALOGUE_NPC,number_digits=6;
volatile uint8_t dialogue_flag,dialogue_set;
volatile uint32_t number_value;
void main(void){uint8_t previous=0,keys,pressed,i,example=0;
 cpu_fast();NR52_REG=0;SVBK_REG=1;rROMB1=0;SWITCH_ROM(1);memset((void*)0xd7f0,0xa7,16);memset((void*)0xdb60,0xa7,16);
 #ifdef FF3_TEXT_AUDIO
 ff3_memory_init();
 #endif
 ff3_state_init(text_game_state);memcpy(dialogue_name_state,dialogue_names,sizeof(dialogue_name_state));
 text_context.state=text_game_state;text_context.names=dialogue_name_state;text_context.item=0xa6;text_context.variable_gil[0]=200;
 memset(shadow_OAM,0,160);
 if(!ff3_map_display(DIALOGUE_WORLD,DIALOGUE_MAP,DIALOGUE_X,DIALOGUE_Y)||!ff3_objects_init(DIALOGUE_WORLD,map_workspace.properties[4],text_game_state+0x80)||!ff3_objects_display(DIALOGUE_WORLD,DIALOGUE_MAP,DIALOGUE_X,DIALOGUE_Y,0))text_view_error=asset_error;
 if(object_part1[DIALOGUE_SLOT*16]!=DIALOGUE_NPC)text_view_error=10;
 ff3_text_video_init();
 #ifdef FF3_TEXT_AUDIO
 memset((void*)0xd940,0xa7,16);ff3_native_begin();text_idle=ff3_native_service;
 #endif
 text_ready=0xa5;
 while(1){
  #ifdef FF3_TEXT_AUDIO
  ff3_native_service();
  if(memory_probe_request){memory_probe_request=0;ff3_memory_probe();}
  #endif
  if(text_request){asset_error=0;text_error=0;
   if(text_request==1){ff3_text_close();npc_active=0;ff3_text_open_source(text_selection);}
   else if(text_request==2){if(text_visible)ff3_text_next();if(!text_visible&&npc_active&&!text_error)ff3_npc_resume();}
   else if(text_request==3){ff3_text_close();npc_active=0;}
   else if(text_request==4)ff3_npc_start(dialogue_world,dialogue_npc,text_game_state);
   else if(text_request==5)ff3_npc_select(dialogue_world,dialogue_npc,text_game_state);
   else if(text_request==6)ff3_text_number(number_value,number_digits,number_output);
   else if(text_request==7)ff3_npc_flag(text_game_state,dialogue_flag,dialogue_set);
   else if(text_request==8){npc_active=0;ff3_text_open(text_selection);}
   if(CURRENT_BANK!=1)text_view_error=7;
   for(i=0;i<16;i++)if(((volatile uint8_t*)0xd7f0)[i]!=0xa7||((volatile uint8_t*)0xdb60)[i]!=0xa7)text_view_error=9;
   text_loads++;text_request=0;
  }
  #ifdef FF3_TEXT_AUDIO
  ff3_platform_check();for(i=0;i<16;i++)if(((volatile uint8_t*)0xd940)[i]!=0xa7||((volatile uint8_t*)0xdb60)[i]!=0xa7)text_view_error=11;
  #endif
  wait_vbl_done();keys=joypad();text_polled_keys=keys;pressed=keys&~previous;previous=keys;text_key_press=pressed;
  if(pressed&(J_A|J_B))text_request=text_visible?2:4;
  if(pressed&J_START){ff3_text_close();npc_active=0;text_game_state[0x20+(DIALOGUE_FLAG>>3)]^=1<<(DIALOGUE_FLAG&7);text_request=4;}
  if(pressed&J_SELECT){text_selection=dialogue_examples[example];example=(example+1)%DIALOGUE_EXAMPLES;text_request=1;}
 }
}
