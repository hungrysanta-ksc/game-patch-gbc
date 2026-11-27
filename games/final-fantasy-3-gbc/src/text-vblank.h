#ifndef FF3_TEXT_VBLANK_H
#define FF3_TEXT_VBLANK_H
#include <gb/gb.h>
extern void (*text_idle)(void);
extern volatile uint8_t text_transfer_busy,text_transfer_fault,text_transfer_max_ly;
extern volatile uint16_t text_transfer_chunks,text_transfer_bytes,text_transfer_frames,text_transfer_max_frames;
void ff3_text_service(void) NONBANKED;
void ff3_text_video_init(void) NONBANKED;
void ff3_text_video(uint8_t visible) NONBANKED;
/* Bank 1 remains selected: the live stack must never be bank-switched. */
extern uint8_t __at(0xd950) text_staging[256];
void ff3_text_copy(uint8_t bank,uint16_t address,const uint8_t *data,uint16_t count) NONBANKED;
void ff3_text_palette(const uint16_t *colors) NONBANKED;
/* Queue contiguous palettes from the shared WRAM staging area. */
void ff3_text_palette_range(uint8_t bg,uint8_t first,uint8_t count,const uint8_t *data) NONBANKED;
/* Double-speed-only initial loads: bounded 256-byte DMA; updates stay 128. */
void ff3_text_rom_copy(uint8_t bank,uint16_t address,uint8_t rom_bank,const uint8_t *data,uint16_t count) NONBANKED;
void ff3_text_clear_map(uint8_t bank) NONBANKED;
/* Release owner keeps WRAM 3 backup and dead membership scratch immutable.
 * pairs=1 additionally restores the magic owner's WRAM 4 retained OBJ pairs. */
#ifdef FF3_EFFECTS
uint8_t ff3_text_restore_map(uint8_t page,const uint8_t *dirty,uint8_t pairs) NONBANKED;
#endif
#endif
