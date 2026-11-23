#pragma bank 15
#include <string.h>
#include "npc-dialogue.h"
uint8_t npc_event,npc_dialogue[32],npc_error,npc_active,npc_world;
uint16_t npc_pc,npc_text_id;
static uint8_t record[64],*game;
static FF3Asset source;
static uint8_t fail(uint8_t error){npc_error=error;npc_active=0;return 0;}
static uint8_t read(uint16_t at,void *dest,uint16_t count){if(!ff3_asset_read(&source,at,dest,count))return fail(31);return 1;}
uint8_t ff3_npc_select(uint8_t world,uint8_t id,uint8_t *state) BANKED {
 uint8_t p[2],at=0,code,match;uint16_t pointer;
 npc_error=0;npc_active=0;npc_event=0;npc_world=world;game=state;
 if(id>=224)return fail(30);
 if(!ff3_asset_open(FF3_DIALOGUE_SOURCE,0,&source)||!read(0x200+(world?512u:0u)+(uint16_t)id*2,p,2))return fail(31);
 pointer=p[0]|((uint16_t)p[1]<<8);if(pointer<0x8000||pointer>0xbfc0)return fail(31);
 if(!read(pointer-0x8000,record,64))return 0;
 // 92F3 finds the unconditional fallback, then copies exactly 32 dialogue IDs.
 while(at<64){if(record[at]==255){at+=2;break;}while(at<64&&record[at]!=255)at++;at+=2;}
 if(at>32)return fail(31);memcpy(npc_dialogue,record+at,32);
 at=0;while(at<64){match=1;while(at<64&&(code=record[at++])!=255){if(!!(game[0x20+((code&127)>>3)]&(1<<(code&7)))!=!!(code&128))match=0;}if(at>=64)return fail(31);code=record[at++];if(match){npc_event=code;return 1;}}
 return fail(31);
}
uint8_t ff3_npc_start(uint8_t world,uint8_t id,uint8_t *state) BANKED {
 uint8_t p[2],op,arg;uint16_t scan;
 ff3_text_close();if(!ff3_npc_select(world,id,state))return 0;
 if(!npc_event)return 1; /* E9DD: event zero means no event. */
 if(npc_event>=254||!read(0x600+(uint16_t)npc_event*2,p,2))return fail(31);
 scan=p[0]|((uint16_t)p[1]<<8);if(scan<0x8000||scan>=0xc000)return fail(31);npc_pc=scan-0x8000;scan=npc_pc;
 // Reject a partially supported event before displaying or mutating any flags.
 while(1){if(!read(scan++,&op,1))return 0;if(op==255)break;if(op<240||op>243)return fail(32);if(!read(scan++,&arg,1))return 0;if(op==240&&arg>=32)return fail(31);}
 npc_active=1;return ff3_npc_resume();
}
uint8_t ff3_npc_resume(void) BANKED {uint8_t op,arg;if(text_visible)return fail(33);if(!npc_active)return !npc_error;
 while(1){if(!read(npc_pc++,&op,1))return 0;if(op==255){npc_active=0;return 1;}if(!read(npc_pc++,&arg,1))return 0;
  if(op==240||op==241){npc_text_id=op==240?(npc_world?768u:512u)+npc_dialogue[arg]:arg;if(!ff3_text_open_source(npc_text_id))return fail(34);return 1;}
  if(op==242||op==243)ff3_npc_flag(game,arg,op==242);else return fail(32);
 }
}
/* B983/B999 do NOT mask bit 7 like the condition reader 9344 does. */
void ff3_npc_flag(uint8_t *state,uint8_t id,uint8_t set) BANKED {if(set)state[0x20+(id>>3)]|=1<<(id&7);else state[0x20+(id>>3)]&=~(1<<(id&7));}
