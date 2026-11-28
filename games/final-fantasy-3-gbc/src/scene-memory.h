#ifndef FF3_SCENE_MEMORY_H
#define FF3_SCENE_MEMORY_H
#include <gb/gb.h>
/* Only combined-layout builds allocate this arena. No callbacks may remain
 * attached during a transition. GameState/audio/common transfer state never
 * belong to the saved field image. ROM/frame rendering is a separate owner. */
extern volatile uint8_t scene_arena_owner,scene_arena_fault;
uint8_t ff3_scene_field_begin(void) BANKED;
uint8_t ff3_scene_battle_begin(void) BANKED;
uint8_t ff3_scene_field_restore(void) BANKED;
uint8_t ff3_scene_field_discard(void) BANKED;
#endif
