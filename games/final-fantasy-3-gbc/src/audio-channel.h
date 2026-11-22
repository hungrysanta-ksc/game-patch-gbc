#ifndef FF3_AUDIO_CHANNEL_H
#define FF3_AUDIO_CHANNEL_H
#include "audio-control.h"
typedef struct {
    /* Logical NES CPU address in the currently selected source bank mapping. */
    uint8_t (*read)(uint16_t address);
    void (*write)(uint8_t reg, uint8_t value);
} FF3ChannelOps;
/* Return 0 on invalid caller arguments or an unbounded command/tie chain.
 * Caller must stop on failure. No sample/state replay is used here. */
uint8_t ff3_channel_script(FF3AudioState *s, const FF3ChannelOps *ops,
                         uint8_t channel, uint8_t format, uint8_t effect);
uint8_t ff3_channel_envelope(FF3AudioState *s, const FF3ChannelOps *ops,
                           uint8_t channel, uint8_t effect);
#endif
