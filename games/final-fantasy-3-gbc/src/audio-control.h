#ifndef FF3_AUDIO_CONTROL_H
#define FF3_AUDIO_CONTROL_H
#include <stdint.h>
#include "platform-call.h"

/* Offsets preserve NES $7F40..$7FFF for comparison during the port.
 * These are logical NES APU writes, not Game Boy hardware registers. */
typedef struct { uint8_t ram[192]; uint8_t apu[24]; } FF3AudioState;
/* Product engine has one instance. Direct addressing avoids repeated generic
 * pointer arithmetic and indirect calls on SM83. Standalone unit consumers
 * retain the supplied state and callback pointers. */
#ifdef FF3_SINGLE_ENGINE
extern FF3AudioState ff3_state;
uint8_t ff3_engine_read36(uint16_t address);
uint8_t ff3_engine_read(uint16_t address);
void ff3_output(uint8_t reg, uint8_t value);
void ff3_engine_advance(uint8_t routine, uint8_t channel, uint8_t format, uint8_t effect);
#define FF3_READ36(ops, a) ff3_engine_read36(a)
#define FF3_READ(ops, a) ff3_engine_read(a)
#define FF3_WRITE(ops, r, v) ff3_output(r, v)
#define FF3_ADVANCE(ops, r, c, f, e) ff3_engine_advance(r, c, f, e)
#define FF3_RAM(s) ff3_state.ram
#define FF3_APU(s) ff3_state.apu
#else
#define FF3_READ36(ops, a) ((ops)->read_bank36(a))
#define FF3_READ(ops, a) ((ops)->read(a))
#define FF3_WRITE(ops, r, v) ((ops)->write_apu(r, v))
#define FF3_ADVANCE(ops, r, c, f, e) ((ops)->advance(r, c, f, e))
#define FF3_RAM(s) ((s)->ram)
#define FF3_APU(s) ((s)->apu)
#endif
enum { FF3_SCRIPT = 0, FF3_ENVELOPE = 1, FF3_MUSIC = 2 };
typedef struct {
    uint8_t (*read_bank36)(uint16_t address);
    void (*write_apu)(uint8_t reg, uint8_t value);
    /* Required script/envelope/music implementations. No fallback/no-op. */
    void (*advance)(uint8_t routine, uint8_t channel, uint8_t format, uint8_t effect);
} FF3AudioOps;

uint8_t ff3_audio_song(FF3AudioState *s, uint8_t id);
uint8_t ff3_audio_effect(FF3AudioState *s, uint8_t id) FF3_BANKED;
void ff3_audio_stop_effect(FF3AudioState *s) FF3_BANKED;
void ff3_audio_init(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_release_effect(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_start_effect(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_update_effect(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_flush_effect(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_flush_music(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_silence_music(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_tick(FF3AudioState *s, const FF3AudioOps *ops);
#endif
