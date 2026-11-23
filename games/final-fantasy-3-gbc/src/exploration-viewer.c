#include <gb/cgb.h>
#include <string.h>
#include "exploration.h"
#include "game-state.h"
#include "npc-dialogue.h"
#include "dialogue-config.h"
#include "exploration-config.h"
#include "text-vblank.h"
#include "platform.h"
void ff3_native_begin(void) NONBANKED;void ff3_native_service(void) NONBANKED;
extern volatile uint8_t native_request,native_argument;
uint16_t dialogue_name_state[24];
static uint8_t neskeys(uint8_t k){return (k&3)|((k&4)<<1)|((k&8)>>1)|((k&0x10)<<3)|((k&0x20)<<1)|((k&0x40)>>1)|((k&0x80)>>3);}
static void deadline(void){field.deadline=ff3_clock_now()+FF3_LOGIC_STEP;field.fraction=0;}
static void advance(void){field.deadline+=FF3_LOGIC_STEP;field.fraction+=FF3_LOGIC_FRACTION;if(field.fraction>=FF3_LOGIC_DENOMINATOR){field.fraction-=FF3_LOGIC_DENOMINATOR;field.deadline++;}}
void main(void){uint8_t k,pressed,old=0,i,was,catchup;
 cpu_fast();NR52_REG=0;SVBK_REG=1;rROMB1=0;SWITCH_ROM(1);
 memset((void*)0xd7f0,0xa7,16);memset((void*)0xd940,0xa7,16);memset((void*)0xdb60,0xa7,16);memset((void*)0xdca0,0xa7,16);
 ff3_state_init(ff3_game_state);memcpy(dialogue_name_state,dialogue_names,sizeof(dialogue_name_state));
 text_context.state=ff3_game_state;text_context.names=dialogue_name_state;text_context.item=0xa6;
 memset(shadow_OAM,0,160);memset(object_part2,0,192);
 if(!ff3_map_display(FIELD_WORLD,FIELD_MAP,DIALOGUE_X,DIALOGUE_Y)||!ff3_objects_init(FIELD_WORLD,map_workspace.properties[4],ff3_game_state+0x80)||!ff3_objects_display(FIELD_WORLD,FIELD_MAP,DIALOGUE_X,DIALOGUE_Y,0))asset_error=10;
 ff3_field_init();ff3_field_render(1);ff3_field_video_init();ff3_text_video_init();
 ff3_native_begin();text_idle=ff3_native_service;native_argument=FIELD_SONG;native_request=2;deadline();field.ready=0xa5;
 while(1){ff3_native_service();
  for(i=0;i<16;i++)if(((volatile uint8_t*)0xd7f0)[i]!=0xa7||((volatile uint8_t*)0xd940)[i]!=0xa7||((volatile uint8_t*)0xdb60)[i]!=0xa7||((volatile uint8_t*)0xdca0)[i]!=0xa7)field.error=10;
  if(field.request){switch(field.request){case 1:ff3_field_front();break;case 2:field.result=ff3_field_touch();break;case 3:field.result=ff3_field_talk();break;case 4:field.result=ff3_field_terrain();break;case 5:ff3_field_pixel();break;case 6:ff3_field_render(0);break;}field.request=0;}
  if(field.pause||field.error||asset_error||text_error||npc_error||field.video_fault){__asm halt __endasm;continue;}
  if((int16_t)(ff3_clock_now()-field.deadline)<0){__asm halt __endasm;continue;}
  k=joypad();field.polled=k;pressed=k&~old;old=k;
  if(field.mode==2){advance();if(pressed&(J_A|J_B)){
    if(text_visible)ff3_text_next();if(!text_visible&&npc_active&&!text_error)ff3_npc_resume();
    if(!text_visible&&!npc_active){field.mode=0;field.face=0xff;field.pressed=0;field.previous=neskeys(k);ff3_field_render(0);}deadline();
   }continue;}
  field.keys=neskeys(k);was=field.direction;catchup=0;
  do{advance();ff3_field_tick();catchup++;}while(!field.mode&&!field.error&&catchup<8&&(int16_t)(ff3_clock_now()-field.deadline)>=0);
  if(field.mode==1){ff3_field_render(0);ff3_npc_start(field.world,object_part1[field.slot],ff3_game_state);field.mode=2;deadline();continue;}
  if(field.speed||field.subx||field.suby||was!=field.direction||(uint8_t)field.steps!=field.result){ff3_field_render(0);field.result=(uint8_t)field.steps;}
 }
}
