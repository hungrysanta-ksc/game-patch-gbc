#ifndef FF3_AUDIO_MUSIC_H
#define FF3_AUDIO_MUSIC_H
#include "audio-channel.h"
void ff3_music_update(FF3AudioState *s,const FF3AudioOps *ops,const FF3ChannelOps *channels);
uint8_t ff3_music_request(FF3AudioState *s,uint8_t id,uint8_t fade) FF3_BANKED;
void ff3_music_stop(FF3AudioState *s,uint8_t fade) FF3_BANKED;
void ff3_music_resume(FF3AudioState *s) FF3_BANKED;
#endif
