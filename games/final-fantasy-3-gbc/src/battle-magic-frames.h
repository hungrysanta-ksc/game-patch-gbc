#ifndef FF3_MAGIC_FRAMES_H
#define FF3_MAGIC_FRAMES_H
#include "game-state.h"
typedef struct {uint8_t code,vertical,enemy,back,x,y,properties,magic;} Ff3MagicFrame;
typedef struct {uint8_t spell,index,length;} Ff3MagicSequence;
/* Original NES OAM layout. Output is 160 bytes, followed by caller-owned party
 * OAM. Coordinates are original target anchors; GBC placement is a later step. */
uint8_t ff3_magic_frame(const Ff3MagicFrame*p,uint8_t*out) FF3_STATE_BANKED;
/* Swap 96 bytes at 0 and 160; caller supplies all 256 bytes. Invoke before and
 * after the four original waits ONLY for an enemy target. */
void ff3_magic_priority(uint8_t*out) FF3_STATE_BANKED;
uint8_t ff3_magic_begin(Ff3MagicSequence*s,uint8_t spell,uint8_t trim) FF3_STATE_BANKED;
/* 1: decoded code/vertical in two output bytes, held four source waits.
 * 0: exhausted (caller clears and waits once). 255: invalid state, no writes.
 * No sound request, graphics ownership or target routing is implicit here. */
uint8_t ff3_magic_next(Ff3MagicSequence*s,uint8_t*out) FF3_STATE_BANKED;
#endif
