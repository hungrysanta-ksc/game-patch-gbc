#ifndef FF3_AUDIO_ENGINE_H
#define FF3_AUDIO_ENGINE_H
#include "audio-music.h"
/* Single engine instance; platform callbacks must not re-enter it. */
extern FF3AudioState ff3_state;
extern uint8_t ff3_error;
uint8_t ff3_rom_byte(uint8_t source_bank,uint16_t offset);
void ff3_output(uint8_t reg,uint8_t value);
void ff3_engine_init(void);
void ff3_engine_tick(void);
#endif
