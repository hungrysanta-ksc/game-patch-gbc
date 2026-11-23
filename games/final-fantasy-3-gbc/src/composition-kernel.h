#ifndef FF3_COMPOSITION_KERNEL_H
#define FF3_COMPOSITION_KERNEL_H
#include <gb/gb.h>
/* count, 12 source-color mappings, BG 2bpp tile, then count records:
 * signed dx/dy, palette|behind flag, source 2bpp tile. Max 16 ordered OBJs.
 * Output: BG, residual OBJ palette 0, residual OBJ palette 1 (48 bytes).
 * Main-thread only, non-reentrant fixed scratch; disjoint WRAM input/output. */
#define FF3_CELL_INPUT_MAX 333u
uint8_t ff3_compose_cell(const uint8_t *input,uint16_t size,uint8_t *output) BANKED;
#endif
