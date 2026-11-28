#ifndef FF3_BATTLE_CONTEXT_H
#define FF3_BATTLE_CONTEXT_H
#include "game-state.h"
/* Compact, byte-exact caller contracts. Full 64-byte records stay owned by
 * the battle state; these diagnostic structs do not reserve global WRAM. */
typedef struct {uint8_t flags,world,vehicle,special,levels[12],equipment_rows[4],battle_rows[4],formation,first;} Ff3Entry;
typedef struct {uint8_t raw[2],normalized[2],icon,pose,graphics,stone;} Ff3StatusView;
typedef struct {uint8_t monsters[512],numbers[32],status[32],effect,side;} Ff3Cannon;
typedef struct {uint8_t status[16],flags[8],limit,mask,selected,failed,name,visual;} Ff3Retarget;
typedef struct {uint8_t monsters[512],actor[64],status[16],types[8],dead[8],remove_mask,target,hits[2],split_id,message_count,messages[20];} Ff3Split;
void ff3_entry_rules(FF3BattleRng *rng,Ff3Entry *s) FF3_STATE_BANKED;
/* Complete source field DP at FA26, before battle initialization. No GBC RAM
 * addresses or fabricated missing field/sound bytes are accepted here. */
uint8_t ff3_encounter_seed(const uint8_t *field_dp,uint8_t flags) FF3_STATE_BANKED;
/* Approved GBC entropy contract: logical field values, then live source audio
 * RAM. This is not a fabricated NES DP image or a bit-identical NES seed. */
uint8_t ff3_play_seed(const volatile uint8_t *field,const uint8_t *audio) FF3_STATE_BANKED;
void ff3_status_view(Ff3StatusView *s) FF3_STATE_BANKED;
void ff3_status_normalize(uint8_t a,uint8_t b,uint8_t*out) FF3_STATE_BANKED;
uint8_t ff3_status_icon(uint8_t a,uint8_t b) FF3_STATE_BANKED;
void ff3_cannon_prepare(FF3BattleRng *rng,Ff3Cannon *s) FF3_STATE_BANKED;
/* A300's exhausted marker is an output, not this function's return code.
 * Return 0 only for invalid limits or a nonterminating RNG cycle; rollback RNG. */
uint8_t ff3_retarget(FF3BattleRng *rng,Ff3Retarget *s) FF3_STATE_BANKED;
uint8_t ff3_split_prepare(Ff3Split *s) FF3_STATE_BANKED;
#endif
