#ifndef FF3_BATTLE_LIVE_UI_H
#define FF3_BATTLE_LIVE_UI_H
#include <gb/gb.h>
/* Display-boundary ABI: 1=open, 2=close, 3=HP row. Glyph handles refer to
 * the checked private dictionary. No battle result is calculated here. */
extern volatile uint8_t live_ui_request,live_ui_error,live_ui_ready;
extern uint8_t live_ui_input[18];
void ff3_live_ui_reset(void) BANKED;
#ifdef FF3_SCENE_LAYOUT
void ff3_live_ui_party_hp(void) BANKED;
void ff3_live_ui_records(const uint8_t*records) BANKED;
void ff3_live_ui_stone(void) BANKED;
#endif
void ff3_live_ui_prime(void) BANKED;
void ff3_live_ui_update(void) BANKED;
#endif
