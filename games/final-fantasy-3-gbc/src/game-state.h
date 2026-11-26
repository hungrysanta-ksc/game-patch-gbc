#ifndef FF3_GAME_STATE_H
#define FF3_GAME_STATE_H
#include <stdint.h>
#ifdef STATE_HOST
#define FF3_STATE_BANKED
#else
#include <gb/gb.h>
#define FF3_STATE_BANKED BANKED
#endif
#define FF3_STATE_BYTES 1024u
/* Byte-exact NES $6000..63FF. Keep unknown/reserved bytes on load and save. */
void ff3_state_init(uint8_t *state) FF3_STATE_BANKED;
/* $AE5C: world, vehicle, x, y are live field state, not inferred from save. */
void ff3_state_seal(uint8_t *state,const uint8_t *position) FF3_STATE_BANKED;
uint8_t ff3_state_valid(const uint8_t *state) FF3_STATE_BANKED;
/* $A897..A8BA / $A93D..A949: menu entry and accepted save are separate. */
void ff3_save_menu_prepare(uint8_t *state,uint8_t *counter,const uint8_t *position) FF3_STATE_BANKED;
void ff3_save_count_commit(uint8_t *counter) FF3_STATE_BANKED;
typedef struct {uint8_t index,direction;} FF3FieldRng;
typedef struct {uint8_t table[256],counter[3];} FF3BattleRng;
/* FC27's generated table is immutable until the next seed; (seed&2)>>1
 * selects one of two ROM-resident tables. Keep all three original counters. */
typedef struct {uint8_t variant,counter[3];} Ff3BattleRngCursor;
typedef char Ff3BattleRngCursorSize[(sizeof(Ff3BattleRngCursor)==4)?1:-1];
uint8_t ff3_field_random(FF3FieldRng *rng) FF3_STATE_BANKED;
/* Explicit virtual NES zero page + entry A/C; never hash arbitrary GBC RAM. */
void ff3_battle_seed(FF3BattleRng *rng,const uint8_t *zero_page,uint8_t accumulator,uint8_t carry) FF3_STATE_BANKED;
/* selector must be 0..2. Return 0 on invalid selector, leaving state/output unchanged. */
uint8_t ff3_battle_random(FF3BattleRng *rng,uint8_t selector,uint8_t lower,uint8_t upper,uint8_t *result) FF3_STATE_BANKED;
#ifndef STATE_HOST
/* Storage only: caller owns original menu/confirmation/message-speed semantics.
 * Slots 1..3 are SRAM bank 0 A000..ABFF. Calls restore ROM bank and disable RAM.
 * Buffers must be WRAM. No calls from IRQ. No power-loss atomicity claim. */
uint8_t ff3_save_write(uint8_t slot,const uint8_t *state) BANKED;
uint8_t ff3_save_read(uint8_t slot,uint8_t *state) BANKED;
#endif
#endif
