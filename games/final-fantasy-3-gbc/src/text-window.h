#ifndef FF3_TEXT_WINDOW_H
#define FF3_TEXT_WINDOW_H
#include "assets.h"
enum {FF3_TEXT_POINTERS=15,FF3_TEXT_BLOCKS,FF3_KOREAN_TEXT,FF3_TEXT_GLYPHS,FF3_TEXT_BINDINGS};
enum {TEXT_OK,TEXT_ASSET=20,TEXT_FORMAT,TEXT_UNSUPPORTED,TEXT_GLYPH,TEXT_LAYOUT,TEXT_UNTRANSLATED,TEXT_SOURCE,TEXT_CONTEXT,TEXT_DEPTH};
typedef struct {uint8_t *state;uint16_t *names;uint8_t item,variable_gil[3];} FF3TextContext;
extern FF3TextContext text_context;
void ff3_text_number(uint32_t value,uint8_t digits,uint16_t *out) BANKED;
uint8_t ff3_text_open(uint16_t id) BANKED;
uint8_t ff3_text_open_source(uint16_t source_id) BANKED;
uint8_t ff3_text_next(void) BANKED;
void ff3_text_close(void) BANKED;
extern uint8_t text_visible,text_more,text_error,text_page,text_cache_count;
extern uint16_t text_offset,text_cells[160],text_cache[128];
#endif
