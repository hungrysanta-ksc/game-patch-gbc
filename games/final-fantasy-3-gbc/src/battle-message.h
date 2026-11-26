#ifndef FF3_BATTLE_MESSAGE_H
#define FF3_BATTLE_MESSAGE_H
#include <gb/gb.h>
/* Consumer boundary, not an action-script interpreter. Source op 0..9;
 * adapter op 15 = one numeric HP row. Input: op,value,item,next-queue,
 * script,currentLE,maxLE,HP-mode. Names and monster tables belong to caller.
 * wait/rewind are returned obligations; no graphics/script opcode is skipped. */
extern volatile uint8_t message_request;
extern uint8_t message_input[10],message_names[24],message_monsters[12];
extern uint8_t message_error,message_wait,message_rewind;
extern uint16_t message_source;
void ff3_message_reset(void) BANKED;
void ff3_message_update(void) BANKED;
#endif
