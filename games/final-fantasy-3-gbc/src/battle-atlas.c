#pragma bank 13
#include <gb/cgb.h>
#include <string.h>
#include "composition-window.h"
#include "text-window.h"
#include "text-vblank.h"
#include "memory.h"
#include "scene-assets.h"
void ff3_native_service(void) NONBANKED;
/* Closed-window scratch only. No field, audio or persistent GameState bytes
 * are borrowed. Unlike the exploration cache this atlas owns no WRAM 3..5. */
uint16_t __at(0xd800) scene_keys[128];
uint8_t __at(0xda60) scene_input[256];
uint8_t scene_pins[128];
volatile uint8_t scene_ready,scene_request,scene_page,scene_error,scene_phase;
volatile uint16_t scene_frames,scene_hits,scene_misses,scene_evictions,scene_composed;
static uint8_t active_page,active_frame=255,last_frame[2]={255,255},loaded,window_owned;
static SceneFrame frame;
static SceneBattleFrame target,previous;
typedef struct {uint16_t source,destination;uint8_t bank,vram,bytes;} Transfer;
typedef char transfer_abi[(sizeof(Transfer)==7)?1:-1];
static Transfer transfers[32];
static volatile uint8_t transfer_count,transfer_index,transfer_pending;
static uint8_t ready(void) NONBANKED {uint8_t ly=LY_REG;return ly>=144&&ly<=149&&(STAT_REG&3)==1;}
/* Fixed ROM and fixed WRAM descriptors. Each GDMA is at most 128 bytes;
 * restore the interrupted ROM bank before re-enabling timer interrupts. */
static void transfer_irq(void) NONBANKED {uint8_t saved;Transfer *t;
 if(!transfer_pending)return;
 __asm ei __endasm;
 while(transfer_index<transfer_count&&ready()){
  t=transfers+transfer_index;
  CRITICAL{if(ready()){
   saved=CURRENT_BANK;SWITCH_ROM(t->bank);VBK_REG=t->vram;
   HDMA1_REG=t->source>>8;HDMA2_REG=(uint8_t)t->source;HDMA3_REG=t->destination>>8;HDMA4_REG=(uint8_t)t->destination;HDMA5_REG=(t->bytes>>4)-1;
   SWITCH_ROM(saved);VBK_REG=0;transfer_index++;text_transfer_chunks++;text_transfer_bytes+=t->bytes;
   if((STAT_REG&3)!=1)text_transfer_fault=1;
  }}
 }
 if(transfer_index==transfer_count){transfer_count=0;transfer_pending=0;}
 __asm di __endasm;
}
static void flush(void){if(!transfer_count)return;transfer_index=0;text_transfer_busy=1;transfer_pending=1;
 while(transfer_pending){ff3_native_service();__asm halt __endasm;}text_transfer_busy=0;
}
static void queue(uint8_t bank,const uint8_t *source,uint8_t vram,uint16_t destination,uint16_t bytes){Transfer *t;uint8_t n;
 if(!bytes)return;
 if(((uint16_t)source|destination|bytes)&15||(uint16_t)source<0x4000u||(uint16_t)source+bytes>0x8000u||destination<0x8000u||destination+bytes>0xa000u){scene_error=11;return;}
 while(bytes){if(transfer_count==32)flush();n=bytes>128?128:(uint8_t)bytes;t=transfers+transfer_count;t->source=(uint16_t)source;t->destination=destination;t->bank=bank;t->vram=vram;t->bytes=n;transfer_count++;source+=n;destination+=n;bytes-=n;}
}
static void read_frame(uint8_t n,SceneBattleFrame *out){ff3_scene_rom_copy(7,scene_battle_frames+n,out,sizeof(*out));}
static void preload(void){
 queue(SCENE_BLOCK_BANK,scene_bg_tiles,0,0x9000u,SCENE_JOB_COUNT*16u);scene_misses+=SCENE_JOB_COUNT;
 flush();memset(scene_pins,1,SCENE_JOB_COUNT);loaded=1;
}
static void prepare(uint8_t page){uint8_t i,bank,old,*oam=page?scene_oam1:scene_oam0;uint16_t *spans=(uint16_t*)scene_input;
 read_frame(scene_page,&target);
 if(last_frame[page]==255)old=SCENE_VISUAL_COUNT;
 else {read_frame(last_frame[page],&previous);old=previous.visual;}
 ff3_scene_rom_copy(target.bank,target.spans+(uint16_t)old*8,scene_input,8);
 scene_phase=2;
 for(bank=0;bank<2;bank++){
  queue(target.bank,target.maps+(uint16_t)bank*608+spans[bank*2],bank,(page?0x9c00u:0x9800u)+spans[bank*2],spans[bank*2+1]);
 }
 scene_phase=3;
 if(last_frame[page]==255||previous.visual!=target.visual){
  ff3_scene_rom_copy(target.bank,target.oam,oam,160);
  for(i=0;i<target.objects;i++)oam[i*4+2]+=page*64;
  queue(target.bank,target.graphics,1,0x8000u+(uint16_t)page*1024,(uint16_t)target.objects*16);
 }
 flush();last_frame[page]=scene_page;
}
static void show(void){uint8_t page=active_page^1;
 if(window_owned||scene_page>=SCENE_FRAME_COUNT){scene_error=5;return;}
 read_frame(scene_page,&target);
 if(active_frame!=255){read_frame(active_frame,&previous);if(previous.visual==target.visual){active_frame=scene_page;scene_hits++;scene_frames++;return;}}
 scene_phase=1;if(!loaded)preload();if(scene_error)return;
 prepare(page);if(scene_error)return;ff3_scene_rom_copy(7,scene_frames_data+scene_page,&frame,sizeof(frame));
 scene_phase=4;ff3_scene_rom_copy(frame.bank,frame.palette,scene_palette,96);ff3_scene_publish(page,active_frame==255,0,0);
 active_page=page;active_frame=scene_page;scene_frames++;
}
static void open(void){
 if(window_owned||active_frame==255){scene_error=9;return;}
 scene_phase=5;scene_page=active_frame;if(active_page){prepare(0);if(scene_error)return;ff3_scene_publish(0,0,0,0);active_page=0;}
 if(!ff3_wram_copy(6,1600,scene_keys,256,1)){scene_error=3;return;}window_owned=1;
 if(!ff3_text_open_source(SCENE_TEXT_SOURCE))scene_error=10;
}
static void close(void){if(!window_owned){scene_error=9;return;}scene_phase=7;ff3_text_close();if(!ff3_wram_copy(6,1600,scene_keys,256,0))scene_error=3;last_frame[1]=255;window_owned=0;}
void ff3_scene_run(void) BANKED {
 if(scene_request==1)show();else if(scene_request==2)open();else if(scene_request==3){scene_phase=6;if(!window_owned||!text_more||!ff3_text_next())scene_error=10;}else if(scene_request==4)close();else scene_error=9;
 scene_phase=0;scene_request=0;
}
void ff3_scene_begin(void) BANKED {memset(scene_keys,255,256);memset(scene_pins,0,128);CRITICAL{add_VBL(transfer_irq);}}
