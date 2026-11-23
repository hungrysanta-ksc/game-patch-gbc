#ifndef FF3_COMPOSITION_INPUT_H
#define FF3_COMPOSITION_INPUT_H
#include <gb/gb.h>
/* Normal-map, walking 16x16 actors. World coordinates wrap at 1024 pixels.
 * Caller supplies source pose/graphics/priority identity; no lossy key hash.
 * Epoch changes invalidate map/palette/animation/background interpretation. */
#define FF3_COMPOSITION_ACTORS 14u
typedef struct {uint16_t x,y;uint8_t visible,order,shape[12];} FF3CompositionActor;
typedef struct {uint16_t camera_x,camera_y,epoch;uint8_t valid,reserved;FF3CompositionActor actors[14];} FF3CompositionInput;
typedef struct {uint8_t tiles[128];uint16_t count;uint8_t scroll,objects,full;} FF3CompositionDirty;
/* 21x19 world-aligned tiles include the fine-scroll edge. Bits address a
 * 32x32 ring; they are work requests, not permission to overwrite live VRAM.
 * Non-reentrant main-thread planner. scratch is 128 separate writable bytes;
 * it may borrow an idle DMA buffer. The optional service callback must preserve
 * inputs/output/scratch, restore mapped banks, reside in fixed ROM, and must
 * not reenter the planner or start DMA on those buffers. */
extern void (*ff3_composition_idle)(void);
void ff3_composition_dirty(const FF3CompositionInput *before,const FF3CompositionInput *after,FF3CompositionDirty *out,uint8_t *scratch) BANKED;
#endif
