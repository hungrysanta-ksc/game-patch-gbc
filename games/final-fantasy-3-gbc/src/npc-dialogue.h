#ifndef FF3_NPC_DIALOGUE_H
#define FF3_NPC_DIALOGUE_H
#include "text-window.h"
enum {FF3_DIALOGUE_SOURCE=20,FF3_ITEM_PRICES,FF3_JONG};
extern uint8_t npc_event,npc_dialogue[32],npc_error,npc_active,npc_world;
extern uint16_t npc_pc,npc_text_id;
uint8_t ff3_npc_select(uint8_t world,uint8_t id,uint8_t *state) BANKED;
uint8_t ff3_npc_start(uint8_t world,uint8_t id,uint8_t *state) BANKED;
uint8_t ff3_npc_resume(void) BANKED;
void ff3_npc_flag(uint8_t *state,uint8_t id,uint8_t set) BANKED;
#endif
