#include <gb/gb.h>
#include <gb/cgb.h>
#include <gb/isr.h>
#include <gbdk/console.h>
#include <stdio.h>
#include <string.h>
#include "audio-engine.h"
#include "audio-output.h"
#include "native-assets.h"
#include "platform.h"
#ifdef FF3_TEXT_AUDIO
#include "memory.h"
#include "text-vblank.h"
#endif
#ifdef FF3_SCENE
#include "field-scene.h"
#endif
#ifdef FF3_EXPLORATION
#include "exploration.h"
#endif
#ifdef FF3_COMPOSITION_CACHE
extern volatile uint8_t cache_request;
#endif
#ifdef FF3_OPENING_VIDEO
extern volatile uint8_t scene_phase,scene_pending,transfer_pending,battle_active;
#endif
volatile uint8_t native_ready=0,native_request=0,native_argument=0,native_playing=0,native_done=0,native_busy=0,native_irq_busy=0,native_pop_enabled=1;
volatile uint16_t native_clock=0,native_max_late=0,native_underruns=0,native_pops=0;
volatile uint32_t native_ticks=0,native_events=0;
uint16_t native_source_hash=0,native_gb_hash=0;
volatile uint8_t native_consumed[12];
/* Publish an immutable completed-event snapshot. Debugger observations must
 * not require the producer to become idle at a particular timer phase. */
#ifdef FF3_TEXT_AUDIO
const uint8_t native_snapshot_bank=FF3_WRAM_DIAGNOSTICS;
static uint8_t snapshot_due;
#else
uint8_t native_snapshot[2][232];
#endif
volatile uint8_t native_published=0;
uint8_t native_queue[16][64];
volatile uint8_t native_head=0,native_tail=0;
static uint8_t irq_due,irq_write_count,irq_flags,irq_wait;
static uint8_t *slot;static uint8_t emitted,preparing,automatic,plan_index,pop_active;
static uint16_t next_vm,next_sweep,next_restore,prepare_due;
static uint32_t fraction;
static uint8_t sweep_fraction;
static const palette_color_t palette[]={RGB(28,30,29),RGB(18,22,21),RGB(9,13,14),RGB(2,4,6)};
#include "audio-native-irq.inc"
#ifdef FF3_ITEM_WINDOW
/* Keep both absolute vector constants in one translation unit. SDCC's
 * _CABS0 sections concatenate across units and would move a second vector. */
void ff3_item_lcd(void) NONBANKED;
ISR_VECTOR(VECTOR_STAT,ff3_item_lcd)
#endif
/* Both audio builders link and verify five exact 8 KiB source banks at 1..5
 * and the 4128-byte conversion table at 6. These bounded lookups need no
 * generic range-table checks or two-byte memcpy. Keep the old checked path for
 * out-of-domain arguments, and restore the caller's bank before returning.
 * IRQ consumers never switch ROM banks. */
static uint8_t audio_byte(uint8_t bank,uint16_t offset){uint8_t saved=CURRENT_BANK,value;SWITCH_ROM(bank);value=*(const uint8_t*)(0x4000u+offset);SWITCH_ROM(saved);return value;}
uint8_t ff3_rom_byte(uint8_t source,uint16_t offset){uint8_t bank=source==9?5:source-0x35;if(source!=9&&(source<0x36||source>0x39)){ff3_error=4;return 0;}if(offset>=8192)return ff3_resource_byte(bank,offset);return audio_byte(bank,offset);}
uint16_t ff3_pitch_lookup(uint16_t t){uint16_t value;uint8_t saved,lo,hi;const uint8_t *p;if(t>=2048){if(!ff3_resource_copy(&value,6,t*2,2))return 0;return value;}saved=CURRENT_BANK;p=(const uint8_t*)(0x4000u+t*2);SWITCH_ROM(6);lo=*p++;hi=*p;SWITCH_ROM(saved);return lo|((uint16_t)hi<<8);}
uint8_t ff3_noise_lookup(uint8_t p){if(p>=16)return ff3_resource_byte(6,4096u+p);return audio_byte(6,4096u+p);}
void ff3_output(uint8_t reg,uint8_t value){native_source_hash=(native_source_hash<<1)|(native_source_hash>>15);native_source_hash^=((uint16_t)reg<<8)|value;ff3_backend_write(reg,value);}
void ff3_gb_write(uint8_t reg,uint8_t value){if(emitted>=23){ff3_error=5;return;}slot[18+emitted*2]=reg
#ifdef FF3_ITEM_WINDOW
 +0x10 /* Resolve the FFxx register address outside the timer IRQ. */
#endif
 ;slot[19+emitted*2]=value;emitted++;native_gb_hash=(native_gb_hash<<1)|(native_gb_hash>>15);native_gb_hash^=((uint16_t)reg<<8)|value;}
static void silence(void){NR12_REG=NR22_REG=NR32_REG=NR42_REG=0;}
#ifndef FF3_ITEM_WINDOW
/* The item build owns STAT. Even an unused putchar helper pulls GBDK's
 * bitmap-console LCD vector from the archive and conflicts with that owner. */
static void text(const char *p){while(*p)putchar(*p++);}
#endif
static void command(uint8_t op,uint8_t arg){switch(op){case 2:case 3:if(!ff3_music_request(&ff3_state,arg,op==3))ff3_error=6;break;case 4:ff3_music_resume(&ff3_state);break;case 5:case 6:ff3_music_stop(&ff3_state,op==6);break;case 7:if(!ff3_audio_effect(&ff3_state,arg))ff3_error=6;break;case 8:ff3_audio_stop_effect(&ff3_state);break;default:ff3_error=6;}}
#ifdef FF3_OPENING_VIDEO
volatile uint16_t native_external_serial,native_external_tick;
volatile uint8_t native_external_op,native_external_arg;
#endif
static void put16(uint8_t at,uint16_t value){slot[at]=(uint8_t)value;slot[at+1]=value>>8;}
#if !defined(FF3_OPENING_VIDEO) && !defined(FF3_AUDIO_FAST)
static void put32(uint8_t at,uint32_t value){put16(at,(uint16_t)value);put16(at+2,(uint16_t)(value>>16));}
#else
/* Keep all twelve metadata bytes, but copy their SM83 little-endian storage
 * directly. Only the foreground producer writes these counters/hashes; the
 * timer preserves registers and cannot observe the unpublished tail slot. */
static void packet_metadata(void) __naked {__asm
 ld hl,#_slot
 ld a,(hl+)
 ld d,(hl)
 ld e,a
 inc de
 inc de
 inc de
 inc de
 ld hl,#_native_ticks
 .rept 4
 ld a,(hl+)
 ld (de),a
 inc de
 .endm
 ld hl,#_native_events
 .rept 4
 ld a,(hl+)
 ld (de),a
 inc de
 .endm
 ld hl,#_native_source_hash
 .rept 2
 ld a,(hl+)
 ld (de),a
 inc de
 .endm
 ld hl,#_native_gb_hash
 ld a,(hl+)
 ld (de),a
 inc de
 ld a,(hl)
 ld (de),a
 ret
 __endasm;
}
#endif
/* Publish one immutable completed-event record. Banked storage is diagnostic
 * only; it never moves the audio queue, engine or IRQ state out of fixed RAM. */
static void publish(void){uint8_t index=native_published^1;
#ifdef FF3_TEXT_AUDIO
 uint16_t offset=(uint16_t)index*FF3_WRAM_SNAPSHOT_BYTES,zero=0;
 if(!ff3_wram_copy(FF3_WRAM_DIAGNOSTICS,offset,&ff3_state,216,1)||
    !ff3_wram_copy(FF3_WRAM_DIAGNOSTICS,offset+216,slot+4,12,1)||
    !ff3_wram_copy(FF3_WRAM_DIAGNOSTICS,offset+228,(void*)&native_pops,2,1)||
    !ff3_wram_copy(FF3_WRAM_DIAGNOSTICS,offset+230,&zero,2,1)){memory_fault=1;ff3_error=27;return;}
#else
 uint8_t *p=native_snapshot[index];memcpy(p,&ff3_state,216);p+=216;memcpy(p,slot+4,12);p[12]=(uint8_t)native_pops;p[13]=native_pops>>8;
#endif
 native_published=index;
}
/* About three source ticks of lookahead absorb note/SFX decode peaks.
 * The next packet may extend this bound by one event interval. */
static uint8_t full(void){return ((native_tail+1)&15)==native_head||FF3_AUDIO_IS_AHEAD(prepare_due,ff3_clock_now());}
static void prepare(void){uint8_t end=0,advanced=0;
 slot=native_queue[native_tail];emitted=0;prepare_due=(int16_t)(next_vm-next_sweep)<=0?next_vm:next_sweep;
 if(pop_active&&(int16_t)(next_restore-prepare_due)<0)prepare_due=next_restore;
 put16(0,prepare_due);
 if(pop_active&&prepare_due==next_restore){pop_active=0;ff3_backend_restore();}
 if(prepare_due==next_sweep){ff3_backend_sweep();next_sweep+=34;sweep_fraction+=16;if(sweep_fraction>=120){sweep_fraction-=120;next_sweep++;}}
 if(prepare_due==next_vm){
  advanced=1;
  #ifdef FF3_SCENE
  ff3_scene_before(native_ticks);
  #else
  if(automatic){while(plan_index<NATIVE_PLAN_COUNT&&native_plan_ticks[plan_index]==native_ticks){command(native_plan_ops[plan_index],native_plan_args[plan_index]);plan_index++;}}
#ifdef FF3_OPENING_VIDEO
  if(native_request&&native_request!=255){command(native_request,native_argument);native_external_tick=(uint16_t)native_ticks;native_external_op=native_request;native_external_arg=native_argument;native_external_serial++;native_request=0;}
#else
  else if(native_request&&native_request!=255){command(native_request,native_argument);native_request=0;}
#endif
  #endif
  ff3_pop_seen=0;ff3_engine_tick();
  #ifdef FF3_SCENE
  ff3_scene_after(native_ticks);
  #endif
  native_ticks++;
  if(ff3_pop_seen&&native_pop_enabled){pop_active=1;next_restore=prepare_due+2;native_pops++;}
  next_vm+=FF3_LOGIC_STEP;fraction+=FF3_LOGIC_FRACTION;if(fraction>=FF3_LOGIC_DENOMINATOR){fraction-=FF3_LOGIC_DENOMINATOR;next_vm++;}
  if(automatic&&native_ticks>=NATIVE_TEST_TICKS){end=1;preparing=0;}
 }
 ff3_backend_flush(pop_active);native_events++;
 slot[2]=emitted;slot[3]=end;
#if defined(FF3_OPENING_VIDEO) || defined(FF3_AUDIO_FAST)
 packet_metadata();
#else
 put32(4,native_ticks);put32(8,native_events);put16(12,native_source_hash);put16(14,native_gb_hash);
#endif
 slot[16]=slot[17]=0;
 #ifdef FF3_SCENE
 slot[16]=field_event.shake;slot[17]=field_event.revision;
 #endif
 if(platform_error)ff3_error=26;
 if(ff3_error){preparing=0;native_playing=0;TAC_REG=0;silence();return;}
 /* RAM snapshots are diagnostics, not audio work. Sample every eight logical
  * ticks; consumed output metadata still covers every queued event. */
 if(advanced&&(!(native_ticks&7)||end)){
#ifdef FF3_TEXT_AUDIO
  snapshot_due=1;
#else
  publish();
#endif
 }
 native_tail=(native_tail+1)&15;
}
static void start(uint8_t test){uint8_t i;CRITICAL{TAC_REG=0;IF_REG&=~TIM_IFLAG;native_clock=0;native_head=native_tail=0;}silence();memset(&ff3_state,0,sizeof(ff3_state));ff3_backend_reset();native_ticks=native_events=0;native_source_hash=native_gb_hash=0;native_underruns=native_pops=native_max_late=0;native_done=0;for(i=0;i<12;i++)native_consumed[i]=0;prepare_due=next_vm=0;next_sweep=34;fraction=0;sweep_fraction=16;automatic=test;plan_index=pop_active=0;preparing=native_playing=1;native_request=0;
#ifdef FF3_SCENE
ff3_scene_init();
#endif
ff3_engine_init();
#ifdef FF3_TEXT_AUDIO
snapshot_due=0;
#endif
while(preparing&&!full())prepare();
#ifdef FF3_TEXT_AUDIO
if(snapshot_due){publish();snapshot_due=0;}
#endif
if(!ff3_error)dispatch_due();if(native_playing){CRITICAL{TIMA_REG=TMA_REG=128;IF_REG&=~TIM_IFLAG;TAC_REG=5;}}}
#ifdef FF3_TEXT_AUDIO
/* Fixed-bank cooperative service. Text code may call from any mapped bank;
 * the timer consumer never calls the producer or changes ROM/WRAM banks. */
void ff3_native_service(void) NONBANKED {uint8_t op,arg;
#ifdef FF3_OPENING_VIDEO
 int16_t lead;
#endif
native_busy=1;if(native_request==255)start(1);else if(native_request&&!native_playing){op=native_request;arg=native_argument;start(0);native_request=op;native_argument=arg;}while(preparing
#ifndef FF3_OPENING_VIDEO
 &&!full()
#endif
 ){
#ifdef FF3_OPENING_VIDEO
 /* Keep the established three-tick budget and completed-wait-only yield.
  * One atomic clock sample serves both decisions. Check its lead before
  * reading the caller's flags; no packet or pending command is skipped. */
 if(((native_tail+1)&15)==native_head)break;
 lead=(int16_t)(prepare_due-ff3_clock_now());
 if(lead>FF3_AUDIO_AHEAD)break;
 if(lead>136&&cache_request&&!native_request&&!battle_active&&
    ((text_transfer_busy&&!transfer_pending)||(scene_phase==4&&!scene_pending)))break;
#endif
#if defined(FF3_COMPOSITION_CACHE) && !defined(FF3_OPENING_VIDEO)
 /* Same two-tick cooperative yield used by exploration. Do not hold a due
  * display update hostage to repeatedly refilling the third lookahead tick. */
 #ifdef FF3_STONE
 /* Resident stone work reserves value 2 for the existing three-tick refill
  * target. Two ticks alone do not cover a costly source tick plus allocation. */
 if(cache_request==1&&(int16_t)(prepare_due-ff3_clock_now())>136)break;
 #else
 if(cache_request&&(int16_t)(prepare_due-ff3_clock_now())>136)break;
 #endif
#endif
 prepare();
#ifdef FF3_EXPLORATION
 /* Preserve the three-tick queue target, but let a due exploration picture
  * run after two ticks are already queued. Resume filling on the next call.
  * Commands, event deadlines and the IRQ consumer are unchanged. */
 if(field.ready&&!field.pause&&!field.mode&&(int16_t)(prepare_due-ff3_clock_now())>136&&(int16_t)(ff3_clock_now()-field.deadline)>=0)break;
#endif
 }
 /* Diagnostics must not extend the refill loop by consuming its queue lead.
  * Publish the latest completed event only after refill/yield. All consumed
  * events are still observed independently; no game tick is skipped. */
 if(snapshot_due&&!text_transfer_busy
#ifdef FF3_COMPOSITION_CACHE
  &&!cache_request
#endif
#ifdef FF3_EXPLORATION
  /* Diagnostic copies are lower priority than a due movement picture.
   * Require ~4.9ms until its logic deadline; coalesce pending observations
   * under load. This never coalesces music/game ticks or output packets. */
  &&(!field.ready||field.pause||field.mode||(!field.speed&&(int16_t)(field.deadline-ff3_clock_now())>20))
#endif
 ){publish();snapshot_due=0;}
 native_busy=0;}
void ff3_native_begin(void) NONBANKED {uint8_t i;NR52_REG=128;NR50_REG=0x77;NR51_REG=0xff;NR10_REG=0;NR30_REG=0;for(i=0;i<16;i++)((volatile uint8_t*)0xff30)[i]=ff3_resource_byte(6,4112u+i);NR30_REG=128;silence();set_interrupts(VBL_IFLAG|TIM_IFLAG);native_busy=1;
#ifdef FF3_EXPLORATION
start(0);
#else
start(1);
#endif
native_busy=0;native_ready=0xa5;}
#else
void main(void){uint8_t i,keys,old=0,pressed,frame=0,selection=0x20,mode=0,op,arg;ff3_platform_init();cpu_fast();set_bkg_palette(0,1,palette);NR52_REG=128;NR50_REG=0x77;NR51_REG=0xff;NR10_REG=0;NR30_REG=0;for(i=0;i<16;i++)((volatile uint8_t*)0xff30)[i]=ff3_resource_byte(6,4112u+i);NR30_REG=128;silence();
#ifndef FF3_SCENE
text("FF3 NATIVE AUDIO\nORIGINAL ROM DATA\n\nSONG 32\n\nA REQUEST B STOP\nL/R SELECT ID\nSELECT SONG/SFX\nUP FADE DOWN RESUME\nSTART AUTO CHECK\n\n65 SONGS / 97 SFX\n");set_bkg_palette(0,1,palette);SHOW_BKG;DISPLAY_ON;
#else
ff3_scene_video_init();
#endif
 set_interrupts(VBL_IFLAG|TIM_IFLAG);native_busy=1;
#ifdef FF3_SCENE
start(1);
#else
start(0);
#endif
native_busy=0;native_ready=0xa5;
 while(1){native_busy=1;if(native_request==255)start(1);else if(native_request&&!native_playing){op=native_request;arg=native_argument;start(0);native_request=op;native_argument=arg;}
  while(preparing&&!full()){prepare();
#ifdef FF3_SCENE
   /* Let a pending display frame run once at least one source tick of audio
    * is queued. Filling the entire lookahead first can starve rendering. */
   if(frame!=(uint8_t)sys_time&&(int16_t)(prepare_due-ff3_clock_now())>68)break;
#endif
  }native_busy=0;
  if(frame!=(uint8_t)sys_time){frame=(uint8_t)sys_time;ff3_platform_check();keys=joypad();pressed=keys&~old;old=keys;
   #ifdef FF3_SCENE
   ff3_scene_render();
   if(pressed&J_START)native_request=255;
   #else
   if(pressed&J_SELECT){mode^=1;selection=0;}
   if(pressed&J_RIGHT)selection=(selection+1)%(mode?97:65);if(pressed&J_LEFT)selection=selection?selection-1:(mode?96:64);
   if(pressed&(J_SELECT|J_RIGHT|J_LEFT)){gotoxy(0,3);text(mode?"SFX  ":"SONG ");putchar('0'+selection/10);putchar('0'+selection%10);}
   if(pressed&J_A){automatic=0;native_argument=selection;native_request=mode?7:2;}
   if(pressed&J_B){automatic=0;native_request=mode?8:5;}
   if(pressed&J_UP){automatic=0;native_request=6;}if(pressed&J_DOWN){automatic=0;native_request=4;}
   if(pressed&J_START)native_request=255;
   #endif
  }
  __asm halt __endasm;
 }
}
#endif
