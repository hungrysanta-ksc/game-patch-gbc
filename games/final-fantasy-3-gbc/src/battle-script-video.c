#pragma bank 46
#include "battle-script-video.h"
#include "battle-message.h"
#include "battle-live-ui.h"
#include "platform.h"
#include <string.h>
Ff3ActionScript action_script;
volatile uint8_t action_request,action_enabled,action_blocked,action_gate,action_probe;
volatile uint16_t action_serial;
uint8_t action_previous,action_repeat=8;
uint16_t action_wait_frames,action_cleanups;
uint32_t action_wait_ticks;
static uint16_t seen,deadline,wait_begin;
static uint32_t fraction;
static uint8_t waiting;
extern volatile uint8_t party_work,party_error;
extern volatile uint8_t party_page,party_pending;
/* Match the absolute, page-aligned shadow definitions. */
extern uint8_t __at(0xdc00) party_oam0[160];
extern uint8_t __at(0xdd00) party_oam1[160];
extern uint8_t next_page;
void ff3_native_service(void) NONBANKED;
/* 2F/AFD8: temporary NES objects only. Native enemy residuals represent
 * source BG, and party objects represent source 02A0..02FF: retain both. */
static void cleanup(void){uint8_t page=party_page^1;
 /* Explicit pairs avoid SDCC merging the high bytes of the selected source
  * and destination pointers. The inactive page must be the only write owner. */
 if(page){memcpy(party_oam1,party_oam0,160);memset(party_oam1,0,32);}
 else {memcpy(party_oam0,party_oam1,160);memset(party_oam0,0,32);}
 next_page=page;party_pending=1;while(party_pending){ff3_native_service();__asm halt __endasm;}}
static uint8_t buttons(void){uint8_t gb=joypad(),held=((gb&1)<<7)|((gb&2)<<5)|((gb&4)<<2)|((gb&8)<<2)|((gb&0xf0)>>4),pressed;
 /* 3F/FBC6..FBEE, same repeat rule as the command/target input consumer. */
 if(!(action_previous|held)){action_repeat=8;pressed=0;}
 else {pressed=(~action_previous)&held;if(action_previous&held){if(!--action_repeat){action_repeat=4;pressed=held;}}}
 action_previous=held;return pressed;
}
/* 40960000 / 600988 = 68 + 92816/600988. Retain the exact remainder
 * without importing 32-bit division into the permanently mapped ROM bank. */
static void next_wait(void){deadline+=68;fraction+=92816UL;if(fraction>=600988UL){fraction-=600988UL;deadline++;}}
void ff3_script_video(void) BANKED {Ff3ActionScript*s=&action_script;uint8_t op,v,key=0;uint16_t now;
 /* One banked owner handles both direct UI requests and script requests.
  * Keep packet/render work out of the permanently mapped interrupt bank. */
 if(!action_request&&!action_enabled){party_work=2;ff3_native_service();if(message_request)ff3_message_update();else if(live_ui_request)ff3_live_ui_update();if(live_ui_error)party_error=60+live_ui_error;party_work=0;return;}
 if(action_request){if(action_enabled||live_ui_request||message_request||!live_ui_ready){action_blocked=2;action_request=0;return;}
  action_request=0;action_blocked=action_gate=0;seen=0;waiting=0;fraction=0;action_wait_frames=action_cleanups=0;action_wait_ticks=0;
  if(!ff3_script_start(s)){action_blocked=2;return;}action_enabled=1;
 }
 if(!action_enabled||action_blocked)return;
 if(s->error){action_blocked=10+s->error;return;}
 if(s->done){action_enabled=0;return;}
 if(s->ticket!=seen){seen=s->ticket;action_serial++;if(action_probe){action_gate=1;return;}}
 if(action_gate)return;
 op=s->op;
 if(s->kind==FF3_SCRIPT_MESSAGE){v=op<4?s->names[op]:op==4?s->messages[0]:op<9?s->names[op-5]:s->messages[s->queue];
  message_input[0]=op;message_input[1]=v;message_input[2]=s->item;message_input[3]=s->messages[s->queue];message_input[4]=s->script;
  party_work=2;ff3_native_service();ff3_message_update();party_work=0;if(live_ui_error){party_error=60+live_ui_error;return;}if(message_error){action_blocked=20+message_error;return;}
 }else if(s->kind==FF3_SCRIPT_WAIT){
  now=ff3_clock_now();if(!waiting){waiting=1;wait_begin=deadline=now;next_wait();}
  if((int16_t)(now-deadline)<0)return;key=buttons();action_wait_frames++;action_wait_ticks+=now-wait_begin;wait_begin=now;next_wait();
 }else if(s->kind==FF3_SCRIPT_BUTTON){key=buttons();if(!(key&1))return;
 }else if(s->kind==FF3_SCRIPT_CLEANUP){party_work=2;cleanup();party_work=0;action_cleanups++;
 }else {action_blocked=1;return;} /* Actual graphics owner is not connected. */
 if(!ff3_script_ack(s,s->ticket,key)){action_blocked=3;return;}
 if(s->kind!=FF3_SCRIPT_WAIT)waiting=0;if(s->done)action_enabled=0;
}
