#ifndef FF3_AUDIO_CONTROL_H
#define FF3_AUDIO_CONTROL_H
#include <stdint.h>

/* Offsets preserve NES $7F40..$7FFF for comparison during the port.
 * These are logical NES APU writes, not Game Boy hardware registers. */
typedef struct { uint8_t ram[192]; uint8_t apu[24]; } FF3AudioState;
enum { FF3_SCRIPT = 0, FF3_ENVELOPE = 1, FF3_MUSIC = 2 };
typedef struct {
    uint8_t (*read_bank36)(uint16_t address);
    void (*write_apu)(uint8_t reg, uint8_t value);
    /* Required script/envelope/music implementations. No fallback/no-op. */
    void (*advance)(uint8_t routine, uint8_t channel, uint8_t format, uint8_t effect);
} FF3AudioOps;

uint8_t ff3_audio_song(FF3AudioState *s, uint8_t id);
uint8_t ff3_audio_effect(FF3AudioState *s, uint8_t id);
void ff3_audio_stop_effect(FF3AudioState *s);
void ff3_audio_init(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_release_effect(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_start_effect(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_update_effect(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_flush_effect(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_flush_music(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_silence_music(FF3AudioState *s, const FF3AudioOps *ops);
void ff3_audio_tick(FF3AudioState *s, const FF3AudioOps *ops);
#endif
