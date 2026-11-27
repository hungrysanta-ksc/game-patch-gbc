/* API diagnostic, not a field/battle game. Callback counters test ownership;
 * the original-ROM music/SFX engine runs continuously through every exchange. */
#include <gb/cgb.h>
#include <string.h>
#include "text-vblank.h"
#include "platform.h"
#include "memory.h"
volatile uint8_t state_ready,state_start,state_status,state_failure;
volatile uint32_t state_case;
volatile uint16_t state_index;
volatile uint16_t handoff_a,handoff_b,handoff_leaves,handoff_pending_rejected;
static uint8_t busy,expect_pending;
extern volatile uint8_t native_done;
extern volatile uint16_t native_underruns,native_max_late;
void ff3_native_begin(void) NONBANKED;
void ff3_native_service(void) NONBANKED;
static void require(uint8_t ok){state_case++;if(!ok&&!state_failure)state_failure=state_index;}
static void a(void) NONBANKED {handoff_a++;}
static void b(void) NONBANKED {handoff_b++;}
static uint8_t ready(void) NONBANKED {return !busy;}
static void leave(void) NONBANKED {handoff_leaves++;}
static uint16_t frame(void){uint16_t f;CRITICAL{f=sys_time;}return f;}
static void frames(uint8_t n){uint16_t start=frame();while((uint16_t)(frame()-start)<n){ff3_native_service();__asm halt __endasm;}}
static void idle(void){if(expect_pending){expect_pending=0;require(!ff3_scene_video_detach(scene_video_owner));handoff_pending_rejected++;}ff3_native_service();}
static void active(uint8_t id){uint16_t x,y,f,d;CRITICAL{x=handoff_a;y=handoff_b;f=sys_time;}frames(3);
 CRITICAL{d=sys_time-f;x=handoff_a-x;y=handoff_b-y;}
 require(id==1?(x==d&&!y):id==2?(y==d&&!x):(!x&&!y));
}
static uint16_t state_hash(void){uint16_t h=0,i;for(i=0;i<1024;i++)h=(h<<1)^(h>>15)^ff3_game_state[i];return h;}
void main(void){uint8_t i;uint16_t initial;
 ff3_platform_init();ff3_memory_init();cpu_fast();DISPLAY_ON;HIDE_WIN;
 ff3_text_video_init();ff3_text_video_init();text_idle=idle;
 state_ready=0xa5;while(!state_start){}ff3_native_begin();initial=state_hash();
 state_index=1;require(!ff3_scene_video_attach(0,a,ready,leave));require(!ff3_scene_video_attach(3,a,ready,leave));
 require(!ff3_scene_video_attach(1,0,ready,leave));require(!ff3_scene_video_attach(1,a,0,leave));
 require(!ff3_scene_video_attach(1,(void(*)(void))0x4000u,ready,leave));require(!ff3_scene_video_detach(0));
 for(i=0;i<64;i++){
  state_index=2;require(ff3_scene_video_attach(1,a,ready,leave));require(ff3_scene_video_attach(1,a,ready,leave));
  require(!ff3_scene_video_attach(2,b,ready,leave));require(!ff3_scene_video_attach(1,b,ready,leave));require(!ff3_scene_video_detach(2));active(1);
  state_index=3;busy=1;require(!ff3_scene_video_detach(1));busy=0;memory_busy=1;require(!ff3_scene_video_detach(1));memory_busy=0;
  ff3_text_video(1);require(!ff3_scene_video_detach(1));ff3_text_video(0);
  /* Begin outside VBlank so text_idle observes a real queued descriptor. */
  while(LY_REG>=32){ff3_native_service();__asm halt __endasm;}
  memset(text_staging,0,256);expect_pending=1;ff3_text_copy(0,0x9800,text_staging,256);require(!expect_pending);
  ff3_text_drain();require(!text_transfer_busy&&!text_transfer_fault);
  state_index=4;require(ff3_scene_video_detach(1));require(!scene_video_owner&&!_shadow_OAM_base);active(0);
  state_index=5;require(ff3_scene_video_attach(2,b,ready,leave));require(ff3_scene_video_attach(2,b,ready,leave));active(2);
  require(ff3_scene_video_detach(2));require(!scene_video_owner&&!_shadow_OAM_base);active(0);
  require(state_hash()==initial);require((SVBK_REG&7)==1);ff3_text_video_init();
 }
 state_index=6;require(handoff_leaves==128&&handoff_pending_rejected==64);
 while(!native_done){ff3_native_service();__asm halt __endasm;}
 require(!native_underruns&&!native_max_late&&!memory_fault&&!platform_error);require(state_hash()==initial);
 state_status=state_failure?2:1;while(1){ff3_native_service();__asm halt __endasm;}
}
