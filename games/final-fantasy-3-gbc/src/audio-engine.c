#ifdef FF3_BANKED_RUNTIME
#pragma bank 8
#endif
#include "audio-engine.h"
FF3AudioState ff3_state;
uint8_t ff3_error;
static uint8_t mapped_song=255,mapped_source;
#ifdef FF3_BANKED_RUNTIME
/* Exact build-time copy of NES bank 36 beside its consumer in bank 8.
 * Envelopes are read every tick; per-byte cross-bank wrappers miss deadlines. */
extern const uint8_t ff3_audio_bank36[];
static uint8_t source_byte(uint8_t bank,uint16_t offset){if(bank==0x36)return ff3_audio_bank36[offset];return ff3_rom_byte(bank,offset);}
#else
#define source_byte ff3_rom_byte
#endif
uint8_t ff3_engine_read36(uint16_t address){if(address<0x8000||address>=0xa000){ff3_error=1;return 0;}return source_byte(0x36,address&8191);}
uint8_t ff3_engine_read(uint16_t address){uint8_t id=ff3_state.ram[3],index;
 if(address>=0x8000&&address<0xa000){
#if defined(FF3_OPENING_VIDEO) && defined(FF3_BANKED_RUNTIME)
  return ff3_audio_bank36[address&8191];
#else
  return ff3_engine_read36(address);
#endif
 }
 if(address<0xa000||address>=0xc000){ff3_error=2;return 0;}if(id!=mapped_song){index=id<0x19?0:id<0x2b?1:id<0x3b?2:3;mapped_source=ff3_engine_read36(0x89bf+index);mapped_song=id;}return source_byte(mapped_source,address&8191);
}
#ifdef FF3_OPENING_VIDEO
/* Only a word entirely inside the local immutable bank-36 copy is direct.
 * At 9FFF/BFFF/FFFF retain both ordered reads, mapping and error behavior. */
uint16_t ff3_engine_read_word(uint16_t address){uint8_t lo;
#ifdef FF3_BANKED_RUNTIME
 if(address>=0x8000&&address<0x9fff){const uint8_t *p=ff3_audio_bank36+(address&8191);lo=*p++;return lo|((uint16_t)*p<<8);}
#endif
 lo=ff3_engine_read(address);return lo|((uint16_t)ff3_engine_read((uint16_t)(address+1))<<8);
}
#endif
void ff3_engine_advance(uint8_t routine,uint8_t channel,uint8_t format,uint8_t effect);
static const FF3AudioOps ops={ff3_engine_read36,ff3_output,ff3_engine_advance};
static const FF3ChannelOps channels={ff3_engine_read,ff3_output};
void ff3_engine_advance(uint8_t routine,uint8_t channel,uint8_t format,uint8_t effect){uint8_t ok=1;if(routine==FF3_SCRIPT)ok=ff3_channel_script(&ff3_state,&channels,channel,format,effect);else if(routine==FF3_ENVELOPE)ok=ff3_channel_envelope(&ff3_state,&channels,channel,effect);else if(routine==FF3_MUSIC)ff3_music_update(&ff3_state,&ops,&channels);else ok=0;if(!ok)ff3_error=3;}
void ff3_engine_init(void) FF3_BANKED {ff3_error=0;mapped_song=255;ff3_audio_init(&ff3_state,&ops);}
void ff3_engine_tick(void) FF3_BANKED {if(!ff3_error)ff3_audio_tick(&ff3_state,&ops);}
