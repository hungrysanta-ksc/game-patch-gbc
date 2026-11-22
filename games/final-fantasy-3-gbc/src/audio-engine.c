#include "audio-engine.h"
FF3AudioState ff3_state;
uint8_t ff3_error;
static uint8_t mapped_song=255,mapped_source;
uint8_t ff3_engine_read36(uint16_t address){if(address<0x8000||address>=0xa000){ff3_error=1;return 0;}return ff3_rom_byte(0x36,address&8191);}
uint8_t ff3_engine_read(uint16_t address){uint8_t id=ff3_state.ram[3],index;if(address>=0x8000&&address<0xa000)return ff3_engine_read36(address);if(address<0xa000||address>=0xc000){ff3_error=2;return 0;}if(id!=mapped_song){index=id<0x19?0:id<0x2b?1:id<0x3b?2:3;mapped_source=ff3_engine_read36(0x89bf+index);mapped_song=id;}return ff3_rom_byte(mapped_source,address&8191);}
void ff3_engine_advance(uint8_t routine,uint8_t channel,uint8_t format,uint8_t effect);
static const FF3AudioOps ops={ff3_engine_read36,ff3_output,ff3_engine_advance};
static const FF3ChannelOps channels={ff3_engine_read,ff3_output};
void ff3_engine_advance(uint8_t routine,uint8_t channel,uint8_t format,uint8_t effect){uint8_t ok=1;if(routine==FF3_SCRIPT)ok=ff3_channel_script(&ff3_state,&channels,channel,format,effect);else if(routine==FF3_ENVELOPE)ok=ff3_channel_envelope(&ff3_state,&channels,channel,effect);else if(routine==FF3_MUSIC)ff3_music_update(&ff3_state,&ops,&channels);else ok=0;if(!ok)ff3_error=3;}
void ff3_engine_init(void){ff3_error=0;mapped_song=255;ff3_audio_init(&ff3_state,&ops);}
void ff3_engine_tick(void){if(!ff3_error)ff3_audio_tick(&ff3_state,&ops);}
