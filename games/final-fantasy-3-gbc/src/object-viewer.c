#include <gb/cgb.h>
#include <string.h>
#include "field-objects.h"
#include "game-state.h"
uint8_t object_game_state[1024];
volatile uint8_t object_ready,object_request,object_error,object_world,object_map=2,object_x,object_y=40,object_phase,object_flags;
volatile uint16_t object_loads;
volatile uint8_t object_bad_list;
void main(void){uint8_t previous=0,keys,pressed,i;
 cpu_fast();NR52_REG=0;SVBK_REG=1;rROMB1=0;SWITCH_ROM(1);memset((void*)0xd7f0,0xa7,16);
 object_ready=0xa5;object_request=1;
 while(1){
  if(object_request){
   asset_error=0;object_error=0;ff3_state_init(object_game_state);
   /* Explicit test inputs, not a gameplay reveal-all switch. Default is original new-game state. */
   if(object_flags==1)memset(object_game_state+0x80,0,64);
   if(object_flags==2)memset(object_game_state+0x80,0xff,64);
   memset(object_part1,0xa5,192);memset(object_part2,0xa5,192);
   memset(shadow_OAM,0,160);
   if(!ff3_map_display(object_world,object_map,object_x,object_y)||!ff3_objects_init(object_world,object_bad_list?197:map_workspace.properties[4],object_game_state+0x80)||!ff3_objects_display(object_world,object_map,object_x,object_y,object_phase))object_error=asset_error?asset_error:8;
   else object_loads++;
   if(CURRENT_BANK!=1)object_error=7;
   for(i=0;i<16;i++)if(((volatile uint8_t*)0xd7f0)[i]!=0xa7)object_error=9;
   object_request=0;
  }
  wait_vbl_done();keys=joypad();pressed=keys&~previous;previous=keys;
  if(pressed&J_A){object_map++;object_request=1;}if(pressed&J_B){object_map--;object_request=1;}
  if(pressed&J_SELECT){object_world=(object_world+1)%3;object_request=1;}
  if(pressed&J_START){object_phase^=1;object_request=1;}
  if((pressed&J_LEFT)&&object_x){object_x--;object_request=1;}if((pressed&J_RIGHT)&&object_x<44){object_x++;object_request=1;}
  if((pressed&J_UP)&&object_y){object_y--;object_request=1;}if((pressed&J_DOWN)&&object_y<46){object_y++;object_request=1;}
 }
}
