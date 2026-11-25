#ifndef FF3_BATTLE_ENTRY_H
#define FF3_BATTLE_ENTRY_H
#include "game-state.h"
/* The end of this consumer is 2F/B479, NOT the end of battle entry.
 * Boss entry, canonical row placement and status/stone restoration still own
 * the tail. The caller must handle FF3_ENTRY_TAIL; it cannot acknowledge it. */
enum {FF3_ENTRY_INITIAL=1,FF3_ENTRY_TERRAIN,FF3_ENTRY_WALK,FF3_ENTRY_TAIL};
typedef struct {
 uint8_t battle_type,rows[4],status[4],confused_position[4];
 uint8_t x[4],y[4],destination[4],pose[4];
 uint8_t enemy_scroll,menu_scroll,menu_remaining,enemy_table,menu_table,frame;
 uint8_t phase,mask,row,ticket;
} Ff3EntryDisplay;
uint8_t ff3_entry_start(Ff3EntryDisplay *s) FF3_STATE_BANKED;
/* One acknowledgement per presented original wait. No LCD/audio blocking. */
uint8_t ff3_entry_ack(Ff3EntryDisplay *s,uint8_t ticket) FF3_STATE_BANKED;
/* Original 33/BE89 forward movement, also used by the confused entry tail. */
void ff3_entry_motion(Ff3EntryDisplay *s) FF3_STATE_BANKED;
/* 2F/ADC0: produce only the four terrain tiles for the pending row.
 * Both buffers must be WRAM (the banked call selects code bank 16).
 * Input is the original terrain's 256-byte NES 2bpp pattern; output is 64
 * masked NES bytes. Target encoding/VRAM publication belongs to the adapter.
 * Invalid phase returns 0 without touching output. No composed frame input. */
uint8_t ff3_entry_terrain(const Ff3EntryDisplay *s,const uint8_t *terrain,uint8_t *out) FF3_STATE_BANKED;
#endif
