#include <gb/cgb.h>
#include <string.h>
#include "platform.h"
#include "memory.h"
#include "text-vblank.h"
#include "composition-kernel.h"
#include "kernel-assets.h"
void ff3_native_begin(void) NONBANKED;
void ff3_native_service(void) NONBANKED;
uint8_t __at(0xd800) kernel_input[FF3_CELL_INPUT_MAX];
volatile uint8_t kernel_ready,kernel_request,kernel_error,kernel_busy;
volatile uint16_t kernel_job,kernel_completed,kernel_ticks;
static Job job;
static void run(void){uint8_t saved=CURRENT_BANK;uint16_t start;
 if(kernel_job>=JOB_COUNT){kernel_error=3;kernel_request=0;return;}
 SWITCH_ROM(7);memcpy(&job,jobs+kernel_job,sizeof(job));
 if(job.size>FF3_CELL_INPUT_MAX){kernel_error=4;SWITCH_ROM(saved);kernel_request=0;return;}
 SWITCH_ROM(job.bank);memcpy(kernel_input,job.data,job.size);SWITCH_ROM(saved);
 ff3_native_service();start=ff3_clock_now();kernel_busy=1;
 kernel_error=ff3_compose_cell(kernel_input,job.size,text_staging);
 kernel_busy=0;kernel_ticks=ff3_clock_now()-start;
 ff3_native_service();
 /* Isolated destination, not a map/OAM residency implementation. Validate
  * the computed bytes reach VRAM through the existing LCD-on VBlank path. */
 if(!kernel_error)ff3_text_copy(0,0x8000,text_staging,48);
 kernel_completed++;kernel_request=0;
}
void main(void){ff3_platform_init();ff3_memory_init();cpu_fast();
 memset((void*)0xd7f0,0xa7,16);memset((void*)0xd94d,0xa7,3);
 memset((void*)0xdb60,0xa7,16);ff3_text_video_init();
 text_idle=ff3_native_service;LCDC_REG=0x91;ff3_native_begin();kernel_ready=0xa5;
 while(1){ff3_native_service();if(kernel_request)run();else {__asm halt __endasm;}}
}
