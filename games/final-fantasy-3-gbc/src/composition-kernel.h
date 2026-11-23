#ifndef FF3_COMPOSITION_KERNEL_H
#define FF3_COMPOSITION_KERNEL_H
#include <gb/gb.h>
/* count, 4+4*N source-color mappings, BG 2bpp tile, then count records:
 * signed dx/dy, palette|behind flag, source 2bpp tile. Max 16 ordered OBJs.
 * N defaults to 2 (legacy 48-byte output); the window integration uses N=4
 * (BG + four residual OBJ planes, 80 bytes). No palette-bit truncation.
 * Main-thread only, non-reentrant fixed scratch; disjoint WRAM input/output. */
#ifndef FF3_COMPOSITION_PALETTES
#define FF3_COMPOSITION_PALETTES 2u
#endif
#if FF3_COMPOSITION_PALETTES != 2 && FF3_COMPOSITION_PALETTES != 4
#error Only two or four source OBJ palettes are supported
#endif
#define FF3_CELL_COLORS (4u+4u*FF3_COMPOSITION_PALETTES)
#define FF3_CELL_HEADER (17u+FF3_CELL_COLORS)
#define FF3_CELL_OUTPUT (16u*(1u+FF3_COMPOSITION_PALETTES))
#define FF3_CELL_INPUT_MAX (FF3_CELL_HEADER+304u)
uint8_t ff3_compose_cell(const uint8_t *input,uint16_t size,uint8_t *output) BANKED;
#endif
