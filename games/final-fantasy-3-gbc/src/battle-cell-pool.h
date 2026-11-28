#ifndef FF3_BATTLE_CELL_POOL_H
#define FF3_BATTLE_CELL_POOL_H
#include <gb/gb.h>
/* One inactive BG page, shared by every mutable BG/OBJ cell owner. Call
 * begin once, append masked/composed glyphs, finish before map publication.
 * Palette and logical enemy identity belong to the caller, never this pool.
 * D640[54] signatures / D680[16] comparison scratch; WRAM6[192,1056)
 * exact glyph directory. The directory expires at the next begin; published
 * VRAM remains owned by its page. Main thread only; no pending owner overlap. */
#define FF3_CELL_POOL_LIMIT 54u
#define FF3_CELL_POOL_STORAGE 192u
extern uint8_t cell_pool_error,cell_pool_peak;
extern uint16_t cell_pool_written,cell_pool_reused;
void ff3_cell_pool_reset(void) BANKED;
/* shared=0 keeps the original direct upload path. shared=1 compares exact
 * glyphs; choose it before the first cell when multiple owners coexist. */
uint8_t ff3_cell_pool_begin(uint8_t base,uint8_t limit,uint8_t shared) BANKED;
uint8_t ff3_cell_pool_tile(const uint8_t*glyph) BANKED;
uint8_t ff3_cell_pool_finish(void) BANKED;
/* 0: unchanged; 1: became blank; 2: partial new glyph. */
uint8_t ff3_cell_mask(uint8_t*glyph,const uint8_t*erase) BANKED;
/* Same-palette replacement, including selected zero-color pixels. The
 * caller owns palette compatibility, source footprint and page lifetime.
 * Returns the same unchanged/blank/partial classification as mask(). */
uint8_t ff3_cell_paint(uint8_t*glyph,const uint8_t*source,const uint8_t*mask) BANKED;
/* Private hot path: caller MUST reside in bank 124. Ordinary CALL, not
 * NONBANKED (which would consume fixed ROM). Build checks linked banks.
 * Other banks, including the native probe, use the BANKED wrappers above. */
uint8_t ff3_cell_mask_local(uint8_t*glyph,const uint8_t*erase);
uint8_t ff3_cell_paint_local(uint8_t*glyph,const uint8_t*source,const uint8_t*mask);
uint8_t ff3_cell_pool_tile_local(const uint8_t*glyph);
#endif
