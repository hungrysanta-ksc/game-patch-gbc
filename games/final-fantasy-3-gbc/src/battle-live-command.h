#ifndef FF3_LIVE_COMMAND_H
#define FF3_LIVE_COMMAND_H
#include <gb/gb.h>
/* The turn owner submits actor+1 after writing that actor's original action
 * tuple in the resident records. Zero is idle, never an implicit Fight. */
extern uint8_t command_request,command_error,command_phase,command_ready;
extern uint16_t command_serial;
uint8_t ff3_live_command_init(void) BANKED;
void ff3_live_command_update(void) BANKED;
uint8_t ff3_live_command_commit(uint8_t cannon) BANKED;
#endif
