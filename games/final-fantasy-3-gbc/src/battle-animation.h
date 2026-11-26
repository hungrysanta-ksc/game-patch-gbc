#ifndef FF3_BATTLE_ANIMATION_H
#define FF3_BATTLE_ANIMATION_H
#include "game-state.h"
/* 34/8411 caller state. Graphics requests retain their source IDs; each
 * owner must finish its drawing, sounds and state writes before ack. */
typedef struct {
 uint8_t effect,summon,flags,spell,magic,overload,escape,split,summon_attack,layout;
 uint8_t attacker,targets,hit,hits[2],item;
 uint8_t previous[8],status[8],dead[8],types[8],numbers[32],rows[8];
 uint8_t animation,target_enemy,actor,target,mask,flash_mask,flash_palette;
 uint8_t magic_targets,sound,sound_pending,summon_id,summon_kind,party_vs;
 uint8_t stage,request,done,error,saved[2];uint16_t ticket;
} Ff3Animation;
uint8_t ff3_animation_start(Ff3Animation*s) FF3_STATE_BANKED;
uint8_t ff3_animation_ack(Ff3Animation*s,uint16_t ticket) FF3_STATE_BANKED;
#endif
