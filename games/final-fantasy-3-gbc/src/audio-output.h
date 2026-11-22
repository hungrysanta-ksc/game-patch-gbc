#ifndef FF3_AUDIO_OUTPUT_H
#define FF3_AUDIO_OUTPUT_H
#include <stdint.h>
extern uint8_t ff3_pop_seen;
void ff3_backend_reset(void);
void ff3_backend_write(uint8_t reg,uint8_t value);
void ff3_backend_sweep(void);
void ff3_backend_flush(uint8_t pop);
void ff3_backend_restore(void);
uint16_t ff3_pitch_lookup(uint16_t timer);
uint8_t ff3_noise_lookup(uint8_t period);
void ff3_gb_write(uint8_t reg,uint8_t value);
#endif
