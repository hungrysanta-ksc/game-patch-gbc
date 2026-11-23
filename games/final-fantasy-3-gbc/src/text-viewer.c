#include <gb/cgb.h>
#include <string.h>
#include "field-objects.h"
#include "game-state.h"
#include "text-window.h"
#include "text-config.h"
uint8_t text_game_state[1024];
volatile uint8_t text_ready,text_request,text_view_error,text_key_press;
volatile uint16_t text_selection,text_loads;
void main(void){uint8_t previous=0,keys,pressed,i;
 cpu_fast();NR52_REG=0;SVBK_REG=1;rROMB1=0;SWITCH_ROM(1);memset((void*)0xd7f0,0xa7,16);memset((void*)0xda50,0xa7,16);
 ff3_state_init(text_game_state);memset(shadow_OAM,0,160);
 if(!ff3_map_display(0,2,0,40)||!ff3_objects_init(0,map_workspace.properties[4],text_game_state+0x80)||!ff3_objects_display(0,2,0,40,0))text_view_error=asset_error;
 text_ready=0xa5;text_request=1;
 while(1){
  if(text_request){asset_error=0;text_error=0;
   if(text_request==1){if(text_selection<TEXT_SAMPLES)ff3_text_open_source(text_source_ids[text_selection]);else ff3_text_open(text_selection);}
   else if(text_request==2)ff3_text_next();else if(text_request==3)ff3_text_close();
   else if(text_request==4)ff3_text_open_source(text_selection);
   else text_error=TEXT_FORMAT;
   if(CURRENT_BANK!=1)text_view_error=7;
   for(i=0;i<16;i++)if(((volatile uint8_t*)0xd7f0)[i]!=0xa7||((volatile uint8_t*)0xda50)[i]!=0xa7)text_view_error=9;
   text_loads++;text_request=0;
  }
  wait_vbl_done();keys=joypad();pressed=keys&~previous;previous=keys;text_key_press=pressed;
  if(pressed&J_A){text_request=text_visible?2:1;}
  if(pressed&J_B)text_request=3;
  if(pressed&J_RIGHT){text_selection=(text_selection+1)%TEXT_SAMPLES;text_request=1;}
  if(pressed&J_LEFT){text_selection=text_selection?text_selection-1:TEXT_SAMPLES-1;text_request=1;}
 }
}
