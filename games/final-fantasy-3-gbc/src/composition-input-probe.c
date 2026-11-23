#include <gb/cgb.h>
#include <string.h>
#include "platform.h"
#include "memory.h"
#include "text-vblank.h"
#include "composition-input.h"
#include "input-assets.h"
typedef char input_abi[(sizeof(FF3CompositionInput)==260&&sizeof(FF3CompositionDirty)==133)?1:-1];
void ff3_native_begin(void) NONBANKED;
void ff3_native_service(void) NONBANKED;
FF3CompositionInput __at(0xd800) input_before;
FF3CompositionInput __at(0xda50) input_after;
FF3CompositionDirty input_dirty;
volatile uint8_t input_ready,input_request,input_busy,input_error;
volatile uint16_t input_job,input_completed,input_ticks;
static InputJob job;
static void run(void){uint8_t saved=CURRENT_BANK;uint16_t start;
 if(input_job>=INPUT_JOB_COUNT){input_error=1;input_request=0;return;}
 SWITCH_ROM(7);memcpy(&job,input_jobs+input_job,sizeof(job));SWITCH_ROM(job.bank);memcpy(&input_before,job.data,260);memcpy(&input_after,job.data+260,260);SWITCH_ROM(saved);
 ff3_native_service();start=ff3_clock_now();input_busy=1;
 ff3_composition_dirty(&input_before,&input_after,&input_dirty,text_staging);
 input_busy=0;input_ticks=ff3_clock_now()-start;input_completed++;input_request=0;
}
void main(void){ff3_platform_init();ff3_memory_init();cpu_fast();
 memset((void*)0xd000,0x6d,2032);memset((void*)0xd904,0xa7,16);memset((void*)0xd9d0,0xa7,16);memset((void*)0xdb60,0xa7,16);
 ff3_text_video_init();text_idle=ff3_native_service;ff3_composition_idle=ff3_native_service;LCDC_REG=0x91;ff3_native_begin();input_ready=0xa5;
 while(1){ff3_native_service();if(input_request)run();else {__asm halt __endasm;}}
}
