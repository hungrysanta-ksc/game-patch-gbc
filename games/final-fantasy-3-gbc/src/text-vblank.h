#ifndef FF3_TEXT_VBLANK_H
#define FF3_TEXT_VBLANK_H
#include <gb/gb.h>
extern void (*text_idle)(void);
extern volatile uint8_t text_transfer_busy,text_transfer_fault,text_transfer_max_ly;
extern volatile uint16_t text_transfer_chunks,text_transfer_bytes,text_transfer_frames,text_transfer_max_frames;
void ff3_text_service(void) NONBANKED;
void ff3_text_video_init(void) NONBANKED;
/* Scene owner change corresponds to original FAB5/FADD dispatch replacement.
 * Fixed-ROM callbacks only. The caller must stop new work before detach.
 * ready/leave are bounded, nonblocking and run with interrupts masked.
 * leave removes scene-only LCD hooks; shared text and audio stay installed.
 * Detach refuses live transfers/window/borrowed resources and disables the
 * default OAM DMA. The next scene supplies its own valid shadow before use. */
#define FF3_VIDEO_FIELD 1u
#define FF3_VIDEO_BATTLE 2u
extern volatile uint8_t scene_video_owner;
uint8_t ff3_scene_video_attach(uint8_t id,void (*publish)(void),uint8_t (*ready)(void),void (*leave)(void)) BANKED;
uint8_t ff3_scene_video_detach(uint8_t id) BANKED;
/* Internal fixed-ROM helpers for the masked scene-video boundary. */
uint8_t ff3_text_transfer_idle(void) NONBANKED;
void ff3_text_scene_hook(void (*publish)(void),uint8_t attach) NONBANKED;
void ff3_text_drain(void) NONBANKED;
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
/* Prepared mirror (text_staging), frozen patterns (WRAM 3, 2816..4095),
 * then BG4..7 (effect_palettes). Caller owns all sources until completion. */
uint8_t ff3_text_frozen_patterns(uint8_t cells) NONBANKED;
#endif
#endif
