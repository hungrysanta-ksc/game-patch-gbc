#pragma bank 125
#include <gb/cgb.h>
#include <string.h>
#include "battle-defeat-video.h"
#include "battle-end.h"
#include "battle-live-command.h"
#include "battle-script-video.h"
#include "battle-live-ui.h"
#include "battle-message.h"
#include "battle-workspace.h"
#include "battle-terrain.h"
#include "scene-loop.h"
#include "battle-encounter.h"
#include "scene-memory.h"
#include "battle-effect-freeze.h"
#include "battle-resident-bg.h"
#include "memory.h"
#include "game-state.h"
#include "text-vblank.h"
#include "restart-assets.h"
uint8_t defeat_phase,defeat_error,defeat_frames;
#define end ((Ff3BattleEnd*)0xd800)
#define colors ((uint8_t*)0xd840)
#define fade_palettes ((uint8_t*)0xd600)
#define fade_start (*(uint16_t*)0xd80c)
#define fade_level (*(uint8_t*)0xd80e)
extern volatile uint8_t party_work,party_page,party_pending;
extern uint8_t next_page;
extern uint8_t __at(0xdc00) party_oam0[160];
extern uint8_t __at(0xdd00) party_oam1[160];
extern uint8_t ff3_game_state[1024];
void ff3_native_service(void) NONBANKED;
uint8_t ff3_script_buttons(void) BANKED;
void ff3_party_copy(uint8_t bank,const void*src,void*dst,uint16_t n) NONBANKED;
/* Publication, not busy foreground polling, is the input/fade clock. */
static void frame(void){uint16_t before=sys_time;while(sys_time==before){ff3_native_service();__asm halt __endasm;}}
static uint8_t ack(void){if(!ff3_end_ack(end,end->ticket)){defeat_error=2;return 0;}return 1;}
static uint8_t read_party(void){uint8_t i;for(i=0;i<4;i++){if(!ff3_wram_copy(5,(uint16_t)i*64,(uint8_t*)0xd600+(uint16_t)i*64,64,0))return 0;ff3_native_service();}return 1;}
static void consolidate(void){uint8_t i,id,n;uint16_t k;
 /* 31/BEBF, same 8-bit ADC and descending ID order. Canonical GBC bag
  * stays deinterlaced, so no redundant 3D/BC12 / BC2D representation copy. */
 memset(battle_workspace.map,0,256);
 for(i=0;i<32;i++){id=ff3_game_state[192+i];n=battle_workspace.map[id]+ff3_game_state[224+i];battle_workspace.map[id]=n>=100?99:n;}
 memset(ff3_game_state+192,0,64);i=0;
 for(k=255;k;k--)if(battle_workspace.map[k]){ff3_game_state[192+i]=k;ff3_game_state[224+i++]=battle_workspace.map[k];}
}
static void palette_snapshot(void){uint8_t bg,i,j;
 for(bg=0;bg<2;bg++)for(i=0;i<8;i++){ff3_native_service();while(LY_REG<144||LY_REG>148){__asm halt __endasm;}if(bg)BCPS_REG=i*8;else OCPS_REG=i*8;
  for(j=0;j<8;j++){if(bg){BCPS_REG=i*8+j;colors[64+i*8+j]=BCPD_REG;}else{OCPS_REG=i*8+j;colors[i*8+j]=OCPD_REG;}}}
}
static void fade_prepare(void){uint8_t step,i,n,*p;uint16_t v,out;
 /* Palette preparation dies before the timed fade. No variable-shift loop
  * or color arithmetic competes with the four-frame publication cadence. */
 for(step=0;step<4;step++){p=fade_palettes+(uint16_t)step*128;n=3-step;
  for(i=0;i<64;i++){v=colors[i*2]|((uint16_t)colors[i*2+1]<<8);
   out=((v&31)*n>>2)|(((((v>>5)&31)*n)>>2)<<5)|(((((v>>10)&31)*n)>>2)<<10);
   p[i*2]=out;p[i*2+1]=out>>8;if(!(i&3))ff3_native_service();
  }
 }
}
static void fade_step(uint8_t step){uint8_t bg;
 for(bg=0;bg<2;bg++){memcpy(text_staging,fade_palettes+(uint16_t)(step-1)*128+bg*64,64);ff3_text_palette_range(bg,0,8,text_staging);ff3_native_service();}
}
static void restart(void){uint8_t i,row,rows,page=party_page^1,*out=page?party_oam1:party_oam0;uint16_t count;
 /* C058 -> C000 -> C0C3: abandon the suspended map; soft restart skips
  * developer/prophecy and opens B9F6's three-slot/new-game menu. */
 ff3_terrain_shutdown();memset(page?party_oam1:party_oam0,0,160);next_page=page;party_pending=1;
 while(party_pending){ff3_native_service();__asm halt __endasm;}
 if(!ff3_scene_field_discard()){defeat_error=4;return;}effect_freeze_cache_valid=resident_effect_clone_valid=0;
 /* Do not misrepresent a valid existing save as an empty slot. Its preview
  * and load consumer are not supplied by this blank-SRAM screen boundary. */
 for(i=1;i<=3;i++){if(ff3_save_read(i,(uint8_t*)0xd000)){defeat_error=5;return;}ff3_native_service();}
 ff3_scene_song(1);
 ff3_text_rom_copy(0,0x8000,126,restart_tiles,RESTART_TILE_BYTES);
 /* Contiguous map rows share a transfer, like the source window buffer.
  * Every native transfer keeps the DMA's 16-byte alignment contract. */
 for(row=0;row<18;row+=8){rows=row<16?8:2;count=(uint16_t)rows*32;memset(text_staging,0,count);
  for(i=0;i<rows;i++)ff3_party_copy(126,restart_map+(uint16_t)(row+i)*20,text_staging+(uint16_t)i*32,20);
  ff3_text_copy(0,0x9800+(uint16_t)row*32,text_staging,count);ff3_native_service();memset(text_staging,0,count);ff3_text_copy(1,0x9800+(uint16_t)row*32,text_staging,count);ff3_native_service();
 }
 ff3_text_rom_copy(0,0x8dc0,126,restart_cursor_tiles,RESTART_CURSOR_BYTES*4);
 ff3_party_copy(126,restart_cursor_palette,text_staging,8);ff3_text_palette_range(0,3,1,text_staging);
 page=party_page^1;out=page?party_oam1:party_oam0;memset(out,0,160);ff3_party_copy(126,restart_cursor,text_staging,RESTART_CURSOR_BYTES);
 for(i=0;i<RESTART_CURSOR_BYTES;i+=4){out[i]=text_staging[i]-text_staging[0]+21;out[i+1]=text_staging[i+3]-text_staging[3]+10;out[i+2]=220+i/4;out[i+3]=3|((text_staging[i+2]&64)>>1)|((text_staging[i+2]&128)>>1);}
 resident_page=resident_scroll=0;next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}
 ff3_party_copy(126,restart_palette,text_staging,8);ff3_text_palette_range(1,0,1,text_staging);
 memset(ff3_game_state+256,0,256); /* 3D/BA00: active character preview. */
 frame();SCX_REG=SCY_REG=0;LCDC_REG=0x93;scene_phase=5;defeat_phase=5;
 /* This boundary is deliberately a load-menu owner, not a fake revival.
  * Save-slot selection/new-game field startup has a separate consumer. */
}
void ff3_defeat_video(void) BANKED {uint8_t r[4];
 if(defeat_error||defeat_phase==5)return;
 if(!defeat_phase){
  if(!ff3_wram_copy(5,816,r,4,0)){defeat_error=1;return;}
  if((r[0]&130)!=128)return; /* Escape wins over defeat; other end owners remain separate. */
  memset(end,0,sizeof(*end));end->battle=scene_formation;end->result=r[0];end->first=r[2];
  if(!ff3_end_start(end)){defeat_error=2;return;}defeat_phase=1;
 }
 party_work=2;ff3_native_service();
 if(end->request==FF3_END_HP){if(!read_party()){defeat_error=1;goto done;}ff3_live_ui_records((uint8_t*)0xd600);if(!ack())goto done;}
 if(end->request==FF3_END_MESSAGE){
  memset(&action_script,0,sizeof(action_script));action_script.script=2;action_script.effect=2;action_script.result=end->result;action_script.speed=ff3_game_state[16]&7;
  memset(action_script.names,255,4);memset(action_script.messages,255,10);action_script.messages[0]=end->message;
  action_request=1;defeat_phase=2;if(!ack())goto done;goto done;
 }
 if(end->request==FF3_END_ANIMATION){
  if(action_request||action_enabled)goto done;
  if(defeat_phase==2){ff3_scene_song(end->song);defeat_phase=3;}
  frame();if(end->wait_a&&!(ff3_script_buttons()&1))goto done;
  if(!ack())goto done;
 }
 if(end->request==FF3_END_INVENTORY){consolidate();if(!ack())goto done;}
 if(end->request==FF3_END_FADE){
  if(defeat_phase!=4){palette_snapshot();fade_prepare();defeat_frames=fade_level=0;fade_start=sys_time;defeat_phase=4;}
  /* FA5B owns the whole wait loop. Returning to the idle battle scheduler
   * here refilled its third audio tick and delayed the next palette step. */
  while(defeat_frames<20){
   frame();defeat_frames=(uint8_t)(sys_time-fade_start);
   if(defeat_frames<20){uint8_t level=((defeat_frames-1)>>2)+1;if(level>4)level=4;if(level!=fade_level){fade_step(level);fade_level=level;}}
  }
  if(!ack())goto done;
 }
 if(end->request==FF3_END_RESTART){restart();if(defeat_error||!ack())goto done;}
 else if(end->request==FF3_END_FIELD){/* 0179 must resume its event, not restart. */defeat_error=3;}
 done:party_work=0;
}
