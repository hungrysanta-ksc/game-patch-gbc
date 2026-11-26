#ifdef FF3_BANKED_RUNTIME
#pragma bank 8
#endif
#include "audio-music.h"
#if defined(FF3_EFFECTS) && defined(FF3_SINGLE_ENGINE)
/* Source channel loops stay inside $7F40..$7FFF (192 bytes). */
#define R(a) FF3_RAM(s)[(uint8_t)((a)-0x7f40)]
#else
#define R(a) FF3_RAM(s)[(a)-0x7f40]
#endif
uint8_t ff3_music_request(FF3AudioState *s,uint8_t id,uint8_t fade) FF3_BANKED {if(!ff3_audio_song(s,id))return 0;if(fade)R(0x7f42)|=8;return 1;}
void ff3_music_stop(FF3AudioState *s,uint8_t fade) FF3_BANKED {R(0x7f42)=fade?12:4;}
void ff3_music_resume(FF3AudioState *s) FF3_BANKED {R(0x7f42)=2;}
/* 36/89C3..8AA6. Read the original pointer tables in the selected bank. */
static void start(FF3AudioState *s,const FF3AudioOps *ops,const FF3ChannelOps *channels){
 int8_t i;uint8_t id=R(0x7f43),lo;uint16_t table,pointer;
 ff3_audio_silence_music(s,ops);
 for(i=4;i>=0;i--){R(0x7f4a+i)=R(0x7f5f+i)=R(0x7f7b+i)=0;R(0x7f82+i)=8;R(0x7f89+i)=0x30;R(0x7f90+i)=15;R(0x7fc1+i)=R(0x7feb+i)=R(0x7fa5+i)=R(0x7fba+i)=255;}
 R(0x7f45)=150;R(0x7f46)=R(0x7f47)=0;
 if(id<0x19)table=0xa000+(uint8_t)(id<<1);
 else if(id<0x2b)table=0xa000+(uint8_t)((id-0x19)<<1);
 else if(id<0x37)table=0x8c77+(uint8_t)((id-0x2b)<<1);
 else if(id<0x3b)table=0xb3ae+(uint8_t)((id-0x37)<<1);
 else table=0xb400+(uint8_t)((id-0x3b)<<1);
 lo=FF3_READ(channels,table);pointer=lo|((uint16_t)FF3_READ(channels,table+1)<<8);
 for(i=4;i>=0;i--){R(0x7f58+i)=FF3_READ(channels,pointer+i*2+1);R(0x7f51+i)=FF3_READ(channels,pointer+i*2);if(R(0x7f58+i)!=255||R(0x7f51+i)!=255)R(0x7f4a+i)|=128;}
 if(R(0x7f42)&8){R(0x7f42)=0xa0;R(0x7f44)=R(0x7f48)=0;}
 else {R(0x7f42)=128;R(0x7f44)=15;}
}
/* 36/8B2D..8B9C. Tempo can execute several script ticks; envelopes run once. */
static void advance(FF3AudioState *s,const FF3AudioOps *ops){
 uint16_t counter=(R(0x7f46)|((uint16_t)R(0x7f47)<<8))+R(0x7f45);int8_t ch;
 R(0x7f46)=(uint8_t)counter;R(0x7f47)=(uint8_t)(counter>>8);
 while(counter>=150){counter-=150;R(0x7f46)=(uint8_t)counter;R(0x7f47)=(uint8_t)(counter>>8);for(ch=4;ch>=0;ch--)FF3_ADVANCE(ops,FF3_SCRIPT,ch,4-ch,0);}
 for(ch=0;ch<4;ch++)FF3_ADVANCE(ops,FF3_ENVELOPE,ch,4,0);
}
/* 36/8925..899E, 8AA7..8ABF, 8AF0..8B2C. Flags have source priority. */
void ff3_music_update(FF3AudioState *s,const FF3AudioOps *ops,const FF3ChannelOps *channels){
 uint8_t flags=R(0x7f42),previous=R(0x7f40);
 if(flags&1){
  if(previous&128){previous&=127;if(previous==R(0x7f43)||previous==0x37){if(previous==0x37)R(0x7f43)=previous;R(0x7f42)=128;advance(s,ops);return;}}
  R(0x7f41)=previous;R(0x7f40)=R(0x7f43);start(s,ops,channels);return;
 }
 if(flags&2){R(0x7f40)=R(0x7f43)=R(0x7f41);R(0x7f42)=1;start(s,ops,channels);return;}
 if(flags&4){if(flags&8){R(0x7f42)=0xc0;R(0x7f48)=0;}else{R(0x7f42)=0;ff3_audio_silence_music(s,ops);}}
 if(R(0x7f42)&32){
  if(!R(0x7f48)){R(0x7f44)++;if(R(0x7f44)>=15)R(0x7f42)&=0xdf;else{R(0x7f48)=15;}}
  else R(0x7f48)--;
 }else if(R(0x7f42)&64){
  if(!R(0x7f48)){R(0x7f44)--;if(!R(0x7f44)){R(0x7f42)=0;ff3_audio_silence_music(s,ops);}else R(0x7f48)=15;}
  else R(0x7f48)--;
 }
 if(R(0x7f42)&128)advance(s,ops);
}
