#include <gb/cgb.h>
#include <string.h>
#include "exploration.h"
#include "game-state.h"
#include "npc-dialogue.h"
#include "dialogue-config.h"
#include "exploration-config.h"
#include "text-vblank.h"
#include "platform.h"
#include "memory.h"
#ifdef FF3_SCENE_LAYOUT
#include "scene-loop.h"
#include "battle-encounter.h"
#endif
void ff3_native_begin(void) NONBANKED;void ff3_native_service(void) NONBANKED;
extern volatile uint8_t native_request,native_argument;
uint16_t dialogue_name_state[24];
static uint8_t neskeys(uint8_t k){return (k&3)|((k&4)<<1)|((k&8)>>1)|((k&0x10)<<3)|((k&0x20)<<1)|((k&0x40)>>1)|((k&0x80)>>3);}
static void deadline(void){field.deadline=ff3_clock_now()+FF3_LOGIC_STEP;field.fraction=0;}
static void advance(void){field.frame++;field.deadline+=FF3_LOGIC_STEP;field.fraction+=FF3_LOGIC_FRACTION;if(field.fraction>=FF3_LOGIC_DENOMINATOR){field.fraction-=FF3_LOGIC_DENOMINATOR;field.deadline++;}}
/* ECB5/ECC7/ECDB keep $F0 running while NPC movement is suspended. Account
 * for time spent inside the Korean window renderer without moving any NPC. */
static void dialogue_clock(void){while((int16_t)(ff3_clock_now()-field.deadline)>=0)advance();}
static void event_pixels(void){field.event_busy=2;ff3_npc_pixels();field.event_busy=0;}
void main(void)
#ifdef FF3_SCENE_LAYOUT
BANKED
#endif
{uint8_t k,pressed,old=0,i,was,catchup;
#ifdef FF3_SCENE_LAYOUT
 if(scene_mode&&scene_phase==4){
  /* Diagnostic completion consumes this request, without a victory/result. */
  if(scene_mode==3){field.trigger=0;field.error=0;}
  if(!ff3_field_restore_display()){scene_fault=4;return;}
  ff3_field_video_init();ff3_text_video_init();text_idle=ff3_native_service;
  old=joypad();field.previous=neskeys(old);field.pressed=0;
  ff3_scene_song(FIELD_SONG);deadline();field.ready=0xa5;scene_phase=1;
 }else{
#endif
 cpu_fast();NR52_REG=0;SVBK_REG=1;rROMB1=0;
#ifndef FF3_SCENE_LAYOUT
 SWITCH_ROM(1);
#endif
 ff3_memory_init();
 memset((void*)0xd7f0,0xa7,16);memset((void*)0xd940,0xa7,16);memset((void*)0xdb60,0xa7,16);memset((void*)0xdca0,0xa7,16);
 ff3_state_init(ff3_game_state);memcpy(dialogue_name_state,dialogue_names,sizeof(dialogue_name_state));
 text_context.state=ff3_game_state;text_context.names=dialogue_name_state;text_context.item=0xa6;
 ff3_npc_select(DIALOGUE_WORLD,DIALOGUE_NPC,ff3_game_state);
 memset(shadow_OAM,0,160);memset(object_part2,0,192);
 if(!ff3_map_display(FIELD_WORLD,FIELD_MAP,DIALOGUE_X,DIALOGUE_Y)||!ff3_objects_init(FIELD_WORLD,map_workspace.properties[4],ff3_game_state+0x80)||!ff3_objects_display(FIELD_WORLD,FIELD_MAP,DIALOGUE_X,DIALOGUE_Y,0))asset_error=10;
 ff3_field_init();ff3_field_render(1);ff3_field_video_init();ff3_text_video_init();
 ff3_native_begin();text_idle=ff3_native_service;native_argument=FIELD_SONG;native_request=2;deadline();field.ready=0xa5;
#ifdef FF3_SCENE_LAYOUT
 if(scene_mode)scene_phase=1;
 }
#endif
 while(1){ff3_native_service();
#ifdef FF3_SCENE_LAYOUT
  /* Finish the source tile step/event before exchanging owners. */
  /* 3F/FA2F disables the source PPU before FA34 preserves field context.
   * GBC publication is asynchronous: drain/retry the final tile picture
   * before suspending that owner. Never poll another game tick here. */
  if(field.error==4&&field.trigger==0x20&&field.render_dirty){
   ff3_field_flush();
   if(ff3_field_render(0)){field.result=(uint8_t)field.steps;field.render_dirty=0;}
   ff3_field_flush();
  }
  if(scene_mode==3&&scene_rng_ready&&field.error==4&&field.trigger==0x20&&!field.world&&field.map==29&&!field.mode&&!field.speed&&!field.subx&&!field.suby&&!field.request&&!npc_active&&!text_visible){
   scene_formation=field.battle;scene_background=field.battle_background;
   ff3_field_flush();if(ff3_field_video_suspend()){scene_request=0;return;}
  }
  if(scene_mode&&scene_mode!=3&&scene_request==1&&!field.mode&&!field.error&&!field.trigger&&!field.speed&&!field.subx&&!field.suby&&!field.request&&!npc_active&&!text_visible){
   ff3_field_flush();if(ff3_field_video_suspend()){scene_request=0;return;}
  }
#endif
  if(memory_probe_request){memory_probe_request=0;ff3_memory_probe();}
  if(field.request){switch(field.request){case 1:ff3_field_front();break;case 2:field.result=ff3_field_touch();break;case 3:field.result=ff3_field_talk();break;case 4:field.result=ff3_field_terrain();break;case 5:ff3_field_pixel();break;case 6:npc_draw_valid=0;ff3_field_render(0);break;case 7:ff3_npc_pixels();break;case 8:ff3_npc_schedule();break;case 9:ff3_npc_pixels();ff3_npc_schedule();ff3_field_render(0);break;case 10:npc_execution[0]+=ff3_npc_command(npc_execution[1]);break;case 11:ff3_npc_frame();break;case 12:field.result=ff3_field_video_suspend();break;case 13:ff3_field_video_init();npc_draw_valid=0;field.result=ff3_field_render(0);break;case 14:ff3_field_encounter(field.keys);break;case 15:ff3_field_tick();break;case 16:ff3_field_battle_background();break;}field.request=0;}
  if(field.pause||field.error||asset_error||text_error||npc_error||field.video_fault){__asm halt __endasm;continue;}
  if((int16_t)(ff3_clock_now()-field.deadline)<0){__asm halt __endasm;continue;}
  for(i=0;i<16;i++)if(((volatile uint8_t*)0xd7f0)[i]!=0xa7||((volatile uint8_t*)0xd940)[i]!=0xa7||((volatile uint8_t*)0xdb60)[i]!=0xa7||((volatile uint8_t*)0xdca0)[i]!=0xa7)field.error=10;
  k=joypad();field.polled=k;pressed=k&~old;old=k;
  if(field.mode==2){advance();if(pressed&(J_A|J_B)){
    if(text_visible)ff3_text_next();
    dialogue_clock();if(!text_visible){field.mode=3;field.face=0xff;field.pressed=0;field.previous=neskeys(k);event_pixels();ff3_field_flush();ff3_field_render(0);ff3_field_flush();dialogue_clock();}
   }continue;}
  if(field.mode==3){catchup=0;
   do{advance();npc_draw_valid=0;field.event_busy=1;ff3_npc_frame();field.event_busy=0;catchup++;
    if(text_visible){field.dialogue_frame=field.frame;field.mode=2;dialogue_clock();break;}
    if(npc_error||field.error)break;
    event_pixels();if(!npc_active){field.mode=0;field.face=0xff;field.pressed=0;field.previous=neskeys(k);ff3_npc_schedule();break;}
    if(catchup==1)ff3_native_service();
   }while(catchup<2&&(int16_t)(ff3_clock_now()-field.deadline)>=0);
   if(field.mode==2)continue;
   if(field.render_dirty&&ff3_field_render(0))field.render_dirty=0;continue;
  }
  field.keys=neskeys(k);catchup=0;
  do{was=field.direction;advance();ff3_field_tick();catchup++;
   if(field.speed||field.subx||field.suby||was!=field.direction||(uint8_t)field.steps!=field.result)field.render_dirty=1;
   if(field.mode||field.error)break;
   field.npc_busy=1;ff3_npc_pixels();
   ff3_npc_schedule();field.npc_busy=0;if(catchup==1)ff3_native_service();
  }while(catchup<2&&(int16_t)(ff3_clock_now()-field.deadline)>=0);
  if(field.mode==1){npc_draw_valid=0;field.dialogue_frame=field.frame;ff3_field_flush();ff3_field_render(0);ff3_field_flush();ff3_npc_start(field.world,object_part1[field.slot],ff3_game_state);field.mode=npc_active?3:0;dialogue_clock();continue;}
  if(field.render_dirty&&ff3_field_render(0)){field.result=(uint8_t)field.steps;field.render_dirty=0;}
 }
}
