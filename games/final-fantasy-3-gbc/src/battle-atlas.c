#pragma bank 13
#include <gb/cgb.h>
#include <string.h>
#include "composition-window.h"
#include "text-window.h"
#include "text-vblank.h"
#include "memory.h"
#include "scene-assets.h"
#if defined(FF3_BATTLE_TIMELINE) || defined(FF3_NUMBER_TIMELINE)
#include "battle-timeline.h"
#endif
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
#ifdef FF3_BATTLE_STREAM
/* The C descriptor walk consumed most of the short VBlank window. Retain the
 * LY gate and cap stream DMA at 256 bytes (descriptor bytes=0 encodes 256).
 * At double speed its ~128us DMA plus setup stays below one 4096Hz tick.
 * Restore the interrupted bank before EI; timer IRQ preserves all registers. */
static void transfer_irq(void) NONBANKED __naked {__asm
 ld a,(_transfer_pending)
 or a
 ret z
 ei
scene_dma_loop:
 ld a,(_transfer_index)
 ld e,a
 ld a,(_transfer_count)
 cp e
 jr z,scene_dma_done
 ld d,#0
 ld l,e
 ld h,d
 add hl,hl
 add hl,hl
 add hl,hl
 or a
 ld a,l
 sub e
 ld l,a
 ld a,h
 sbc d
 ld h,a
 ld de,#_transfers
 add hl,de
 .globl _scene_dma_begin, _scene_dma_end
_scene_dma_begin:
 di
 ldh a,(_LY_REG)
 cp #144
 jr c,scene_dma_return
 cp #150
 jr nc,scene_dma_return
 ldh a,(_STAT_REG)
 and #3
 cp #1
 jr nz,scene_dma_return
 ldh a,(__current_bank)
 ld b,a
 ld a,(hl+)
 ldh (_HDMA2_REG),a
 ld a,(hl+)
 ldh (_HDMA1_REG),a
 ld a,(hl+)
 ldh (_HDMA4_REG),a
 ld a,(hl+)
 ldh (_HDMA3_REG),a
 ld a,(hl+)
 ldh (__current_bank),a
 ld (#0x2000),a
 ld a,(hl+)
 ldh (_VBK_REG),a
 ld a,(hl)
 ld c,a
 swap a
 and #15
 dec a
 and #15
 ldh (_HDMA5_REG),a
 ld a,b
 ld (#0x2000),a
 ldh (__current_bank),a
 xor a
 ldh (_VBK_REG),a
_scene_dma_end:
 ei
 ld hl,#_transfer_index
 inc (hl)
 ld hl,#_text_transfer_chunks
 inc (hl)
 jr nz,scene_dma_bytes
 inc hl
 inc (hl)
scene_dma_bytes:
 ld hl,#_text_transfer_bytes
 ld a,c
 or a
 jr nz,scene_dma_partial
 inc hl
 inc (hl)
 jr scene_dma_loop
scene_dma_partial:
 ld a,(hl)
 add c
 ld (hl+),a
 jr nc,scene_dma_loop
 inc (hl)
 jr scene_dma_loop
scene_dma_done:
 xor a
 ld (_transfer_count),a
 ld (_transfer_pending),a
scene_dma_return:
 di
 ret
 __endasm;
}
#else
static void transfer_irq(void) NONBANKED {uint8_t saved;Transfer *t;
 if(!transfer_pending)return;
#ifdef FF3_BATTLE_TIMELINE
 /* This IRQ precedes publication. Never use the due publication's budget. */
 {extern volatile uint16_t native_clock;if(battle_active&&(battle_entry==255||(int16_t)(native_clock-battle_due)>=0))return;}
#endif
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
#endif
static void flush(void){if(!transfer_count)return;transfer_index=0;text_transfer_busy=1;transfer_pending=1;
 while(transfer_pending){ff3_native_service();__asm halt __endasm;}text_transfer_busy=0;
}
static void queue(uint8_t bank,const uint8_t *source,uint8_t vram,uint16_t destination,uint16_t bytes){Transfer *t;
#ifdef FF3_BATTLE_STREAM
 uint16_t n;
#else
 uint8_t n;
#endif
 if(!bytes)return;
 if(((uint16_t)source|destination|bytes)&15||(uint16_t)source<0x4000u||(uint16_t)source+bytes>0x8000u||destination<0x8000u||destination+bytes>0xa000u){scene_error=11;return;}
 while(bytes){if(transfer_count==32)flush();
#ifdef FF3_BATTLE_STREAM
 n=bytes>256?256:bytes;
#else
 n=bytes>128?128:(uint8_t)bytes;
#endif
 t=transfers+transfer_count;t->source=(uint16_t)source;t->destination=destination;t->bank=bank;t->vram=vram;t->bytes=(uint8_t)n;transfer_count++;source+=n;destination+=n;bytes-=n;}
}
static void read_frame(uint8_t n,SceneBattleFrame *out){ff3_scene_rom_copy(7,scene_battle_frames+n,out,sizeof(*out));}
#ifdef FF3_BATTLE_STREAM
/* Coalesce adjacent dirty tiles in 16-bit masks, up to 256 bytes. The last
 * byte of the map/OBJ masks has zero padding; never read beyond its row. */
static void queue_mask(uint8_t bank,const uint8_t *source,uint8_t vram,uint16_t destination,const uint8_t *mask,uint8_t count){uint8_t n,start;uint16_t bits,at=0;
 while(count){bits=*mask++;count--;if(count){bits|=(uint16_t)*mask++<<8;count--;}n=0;while(bits){if(!(bits&1)){bits>>=1;n++;continue;}start=n;do{bits>>=1;n++;}while(bits&1);queue(bank,source+at+(uint16_t)start*16,vram,destination+at+(uint16_t)start*16,(uint16_t)(n-start)*16);}at+=256;}
}
#endif
static void preload(void){
#ifndef FF3_BATTLE_STREAM
 queue(SCENE_BLOCK_BANK,scene_bg_tiles,0,0x9000u,SCENE_JOB_COUNT*16u);scene_misses+=SCENE_JOB_COUNT;
 flush();memset(scene_pins,1,SCENE_JOB_COUNT);loaded=1;
#else
 loaded=1;
#endif
}
static void prepare(uint8_t page){uint8_t i,bank,old,*oam=page?scene_oam1:scene_oam0;uint16_t *spans=(uint16_t*)scene_input;
 read_frame(scene_page,&target);
 if(last_frame[page]==255)old=SCENE_VISUAL_COUNT;
 else {read_frame(last_frame[page],&previous);old=previous.visual;}
#ifdef FF3_BATTLE_STREAM
 ff3_scene_rom_copy(target.bank,target.spans+(uint16_t)old*48,scene_input,48);
 queue_mask(target.bank,target.background,page,0x8800u,scene_input+10,32);
#else
 ff3_scene_rom_copy(target.bank,target.spans+(uint16_t)old*8,scene_input,8);
#endif
 scene_phase=2;
 for(bank=0;bank<2;bank++){
#ifdef FF3_BATTLE_STREAM
  queue_mask(target.bank,target.maps+(uint16_t)bank*608+(bank&&page?608u:0u),bank,page?0x9c00u:0x9800u,scene_input+bank*5,5);
#else
  queue(target.bank,target.maps+(uint16_t)bank*608
   +spans[bank*2],bank,(page?0x9c00u:0x9800u)+spans[bank*2],spans[bank*2+1]);
#endif
 }
 scene_phase=3;
 if(last_frame[page]==255||previous.visual!=target.visual){
  ff3_scene_rom_copy(target.bank,target.oam,oam,160);
  for(i=0;i<target.objects;i++)oam[i*4+2]+=page*64;
#ifdef FF3_BATTLE_STREAM
  queue_mask(target.bank,target.graphics,1,0x8000u+(uint16_t)page*1024,scene_input+42,5);
#else
  queue(target.bank,target.graphics,1,0x8000u+(uint16_t)page*1024,(uint16_t)target.objects*16);
#endif
 }
 flush();last_frame[page]=scene_page;
}
static void show(void){uint8_t page=active_page^1;
 if(window_owned||scene_page>=SCENE_FRAME_COUNT){scene_error=5;return;}
 read_frame(scene_page,&target);
 if(active_frame!=255){read_frame(active_frame,&previous);if(previous.visual==target.visual){active_frame=scene_page;scene_hits++;scene_frames++;return;}}
 scene_phase=1;if(!loaded)preload();if(scene_error)return;
 prepare(page);if(scene_error)return;ff3_scene_rom_copy(7,scene_frames_data+scene_page,&frame,sizeof(frame));
 scene_phase=4;ff3_scene_rom_copy(frame.bank,frame.palette,scene_palette,96);
#ifdef FF3_BATTLE_STREAM
 ff3_scene_publish(page,1,0,0);
#else
 ff3_scene_publish(page,active_frame==255,0,0);
#endif
 active_page=page;active_frame=scene_page;scene_frames++;
}
static void open(void){
 if(window_owned||active_frame==255){scene_error=9;return;}
 scene_phase=5;scene_page=active_frame;if(active_page){prepare(0);if(scene_error)return;ff3_scene_publish(0,0,0,0);active_page=0;}
 if(!ff3_wram_copy(6,1600,scene_keys,256,1)){scene_error=3;return;}window_owned=1;
 if(!ff3_text_open_source(SCENE_TEXT_SOURCE))scene_error=10;
}
static void close(void){if(!window_owned){scene_error=9;return;}scene_phase=7;ff3_text_close();if(!ff3_wram_copy(6,1600,scene_keys,256,0))scene_error=3;last_frame[1]=255;window_owned=0;}
#ifdef FF3_BATTLE_TIMELINE
static void play(void){uint8_t n,page=active_page^1,visual;SceneBattleFrame item;
 if(window_owned||battle_active){scene_error=12;return;}
 scene_page=0;if(!loaded)preload();prepare(page);if(scene_error)return;
 ff3_scene_rom_copy(7,scene_frames_data,&frame,sizeof(frame));ff3_scene_rom_copy(frame.bank,frame.palette,scene_palette,96);
 ff3_battle_start(page);
 while(battle_entry==255&&!scene_error){ff3_native_service();__asm halt __endasm;}
 active_page=page;active_frame=0;read_frame(0,&item);visual=item.visual;
 for(n=1;n<SCENE_FRAME_COUNT&&!scene_error;n++){
  read_frame(n,&item);if(item.visual==visual)continue;
  page=active_page^1;scene_page=n;prepare(page);if(scene_error)return;
  ff3_battle_supply(n,page);
  while(battle_entry<n&&battle_active&&!scene_error){ff3_native_service();__asm halt __endasm;}
  active_page=page;active_frame=n;visual=item.visual;
 }
 while(battle_active&&!scene_error){ff3_native_service();__asm halt __endasm;}
 scene_page=active_frame;scene_frames+=SCENE_FRAME_COUNT;
}
#endif
#ifdef FF3_NUMBER_TIMELINE
static void play_numbers(void){uint8_t n,i,page=active_page^1,storage=page,*oam;SceneNumberRun run;
 if(window_owned||battle_active||scene_page>=SCENE_NUMBER_RUNS){scene_error=12;return;}
 ff3_scene_rom_copy(7,scene_number_runs+scene_page,&run,sizeof(run));
 scene_page=run.first;scene_phase=1;if(!loaded)preload();prepare(page);if(scene_error)return;
 ff3_scene_rom_copy(7,scene_frames_data+scene_page,&frame,sizeof(frame));ff3_scene_rom_copy(frame.bank,frame.palette,scene_palette,96);
 scene_phase=4;ff3_battle_start(page);
 while(battle_entry==255&&!scene_error){ff3_native_service();__asm halt __endasm;}
 scene_phase=8;
 for(n=1;n<33&&!scene_error;n++){
  page^=1;oam=page?scene_oam1:scene_oam0;
  ff3_scene_rom_copy(run.bank,run.oam+(uint16_t)n*160,oam,160);
  for(i=0;i<run.objects;i++)oam[i*4+2]+=storage*64;
  ff3_battle_supply(n,page);
  while(battle_entry<n&&battle_active&&!scene_error){ff3_native_service();__asm halt __endasm;}
 }
 while(battle_active&&!scene_error){ff3_native_service();__asm halt __endasm;}
 /* Both shadow buffers now differ from the regular scene-frame cache.
  * The next ordinary owner must rebuild, even for an identical clear view. */
 active_page=storage;active_frame=255;last_frame[0]=last_frame[1]=255;
 scene_page=run.clear;scene_frames+=33;
}
#endif
void ff3_scene_run(void) BANKED {
#ifdef FF3_NUMBER_TIMELINE
 if(scene_request==6)play_numbers();else
#endif
#ifdef FF3_BATTLE_TIMELINE
 if(scene_request==5)play();else
#endif
 if(scene_request==1)show();else if(scene_request==2)open();else if(scene_request==3){scene_phase=6;if(!window_owned||!text_more||!ff3_text_next())scene_error=10;}else if(scene_request==4)close();else scene_error=9;
 scene_phase=0;scene_request=0;
}
void ff3_scene_begin(void) BANKED {
 memset(scene_keys,255,256);memset(scene_pins,0,128);
#ifdef FF3_BATTLE_TIMELINE
 /* Shared palette is invariant across the complete timeline. Load once at
  * boot with LCD off; the Korean window owns only BG palette 7 thereafter. */
 if(LCDC_REG&128){scene_error=14;return;}
 ff3_scene_rom_copy(7,scene_frames_data,&frame,sizeof(frame));ff3_scene_rom_copy(frame.bank,frame.palette,scene_palette,96);
 set_bkg_palette(0,7,(const palette_color_t*)scene_palette);set_sprite_palette(0,4,(const palette_color_t*)(scene_palette+64));
#endif
 CRITICAL{add_VBL(transfer_irq);}
}
