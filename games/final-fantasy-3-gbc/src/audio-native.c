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
#ifdef FF3_SCENE
#include "field-scene.h"
#endif
volatile uint8_t native_ready=0,native_request=0,native_argument=0,native_playing=0,native_done=0,native_busy=0,native_irq_busy=0,native_pop_enabled=1;
volatile uint16_t native_clock=0,native_max_late=0,native_underruns=0,native_pops=0;
volatile uint32_t native_ticks=0,native_events=0;
uint16_t native_source_hash=0,native_gb_hash=0;
volatile uint8_t native_consumed[12];
/* Publish an immutable completed-event snapshot. Debugger observations must
 * not require the producer to become idle at a particular timer phase. */
uint8_t native_snapshot[2][232];
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
void ff3_gb_write(uint8_t reg,uint8_t value){if(emitted>=23){ff3_error=5;return;}slot[18+emitted*2]=reg;slot[19+emitted*2]=value;emitted++;native_gb_hash=(native_gb_hash<<1)|(native_gb_hash>>15);native_gb_hash^=((uint16_t)reg<<8)|value;}
static void silence(void){NR12_REG=NR22_REG=NR32_REG=NR42_REG=0;}
static void text(const char *p){while(*p)putchar(*p++);}
static void command(uint8_t op,uint8_t arg){switch(op){case 2:case 3:if(!ff3_music_request(&ff3_state,arg,op==3))ff3_error=6;break;case 4:ff3_music_resume(&ff3_state);break;case 5:case 6:ff3_music_stop(&ff3_state,op==6);break;case 7:if(!ff3_audio_effect(&ff3_state,arg))ff3_error=6;break;case 8:ff3_audio_stop_effect(&ff3_state);break;default:ff3_error=6;}}
static void put16(uint8_t at,uint16_t value){slot[at]=(uint8_t)value;slot[at+1]=value>>8;}
static void put32(uint8_t at,uint32_t value){put16(at,(uint16_t)value);put16(at+2,(uint16_t)(value>>16));}
/* Publish the same immutable diagnostics, using the toolchain's sequential
 * copy instead of redoing indexed pointer arithmetic for every byte. */
static void publish(void){uint8_t index=native_published^1,*p=native_snapshot[index];memcpy(p,&ff3_state,216);p+=216;memcpy(p,slot+4,12);p[12]=(uint8_t)native_pops;p[13]=native_pops>>8;native_published=index;}
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
  else if(native_request&&native_request!=255){command(native_request,native_argument);native_request=0;}
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
 slot[2]=emitted;slot[3]=end;put32(4,native_ticks);put32(8,native_events);put16(12,native_source_hash);put16(14,native_gb_hash);slot[16]=slot[17]=0;
 #ifdef FF3_SCENE
 slot[16]=field_event.shake;slot[17]=field_event.revision;
 #endif
 if(platform_error)ff3_error=26;
 if(ff3_error){preparing=0;native_playing=0;TAC_REG=0;silence();return;}
 /* RAM snapshots are diagnostics, not audio work. Sample every eight logical
  * ticks; consumed output metadata still covers every queued event. */
 if(advanced&&(!(native_ticks&7)||end))publish();
 native_tail=(native_tail+1)&15;
}
static void start(uint8_t test){uint8_t i;CRITICAL{TAC_REG=0;IF_REG&=~TIM_IFLAG;native_clock=0;native_head=native_tail=0;}silence();memset(&ff3_state,0,sizeof(ff3_state));ff3_backend_reset();native_ticks=native_events=0;native_source_hash=native_gb_hash=0;native_underruns=native_pops=native_max_late=0;native_done=0;for(i=0;i<12;i++)native_consumed[i]=0;prepare_due=next_vm=0;next_sweep=34;fraction=0;sweep_fraction=16;automatic=test;plan_index=pop_active=0;preparing=native_playing=1;native_request=0;
#ifdef FF3_SCENE
ff3_scene_init();
#endif
ff3_engine_init();while(preparing&&!full())prepare();if(!ff3_error)dispatch_due();if(native_playing){CRITICAL{TIMA_REG=TMA_REG=128;IF_REG&=~TIM_IFLAG;TAC_REG=5;}}}
#ifdef FF3_TEXT_AUDIO
/* Fixed-bank cooperative service. Text code may call from any mapped bank;
 * the timer consumer never calls the producer or changes ROM/WRAM banks. */
void ff3_native_service(void) NONBANKED {uint8_t op,arg;native_busy=1;if(native_request==255)start(1);else if(native_request&&!native_playing){op=native_request;arg=native_argument;start(0);native_request=op;native_argument=arg;}while(preparing&&!full())prepare();native_busy=0;}
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
