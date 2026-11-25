/* Same pitch/noise/wave, sweep and phase-retrigger approximations as the
 * existing VGZ player. This module does not introduce timbre tuning. */
#include "audio-engine.h"
#include "audio-output.h"
static uint8_t dirty,trigger,reload[2],divider[2],volume[4],high[3],duty[2],noise;
/* Separate bytes avoid this pinned SDCC version's in-place 16-bit OR
 * miscompile (a post-increment wrote into the following object). */
static uint8_t period_lo[2],period_hi[2];
uint8_t ff3_pop_seen;
void ff3_backend_reset(void){uint8_t i;dirty=trigger=ff3_pop_seen=0;for(i=0;i<2;i++){reload[i]=divider[i]=period_lo[i]=period_hi[i]=0;duty[i]=255;}for(i=0;i<4;i++)volume[i]=255;for(i=0;i<3;i++)high[i]=255;noise=255;}
void ff3_backend_write(uint8_t r,uint8_t v){
 static const uint8_t masks[24]={1,1,1,1,2,2,2,2,4,0,4,4,8,0,8,8,0,8,0,0,0,0,0,0};
 dirty|=masks[r];switch(r){case 1:reload[0]=1;break;case 5:reload[1]=1;break;case 2:period_lo[0]=v;break;case 3:period_hi[0]=v&7;trigger|=1;break;case 6:period_lo[1]=v;break;case 7:period_hi[1]=v&7;trigger|=2;break;case 15:trigger|=8;break;case 17:trigger|=8;if(v&127)ff3_pop_seen=1;break;}
}
#if defined(FF3_OPENING_VIDEO) || defined(FF3_AUDIO_FAST)
/* Fixed channels also remove repeated sweep-state address calculations. */
#define SWEEP_BODY(ch) {uint8_t s,shift;uint16_t t,delta,target;s=ff3_state.apu[ch*4+1];shift=s&7;t=period_lo[ch]|((uint16_t)period_hi[ch]<<8);delta=t>>shift;target=(s&8)?t-delta-(ch?0:1):t+delta;if(!divider[ch]&&(s&128)&&shift&&t>=8&&target<=2047){period_lo[ch]=(uint8_t)target;period_hi[ch]=target>>8;dirty|=1<<ch;}if(!divider[ch]||reload[ch]){divider[ch]=(s>>4)&7;reload[ch]=0;}else divider[ch]--;}
void ff3_backend_sweep(void){SWEEP_BODY(0) SWEEP_BODY(1)}
#undef SWEEP_BODY
#else
void ff3_backend_sweep(void){uint8_t ch,s,shift;uint16_t t,delta,target;for(ch=0;ch<2;ch++){s=ff3_state.apu[ch*4+1];shift=s&7;t=period_lo[ch]|((uint16_t)period_hi[ch]<<8);delta=t>>shift;target=(s&8)?t-delta-(ch?0:1):t+delta;if(!divider[ch]&&(s&128)&&shift&&t>=8&&target<=2047){period_lo[ch]=(uint8_t)target;period_hi[ch]=target>>8;dirty|=1<<ch;}if(!divider[ch]||reload[ch]){divider[ch]=(s>>4)&7;reload[ch]=0;}else divider[ch]--;}}
#endif
#if defined(FF3_OPENING_VIDEO) || defined(FF3_AUDIO_FAST)
/* Channel identities are fixed by flush; constant indices avoid repeated
 * address/mask arithmetic without changing writes, sweep or retriggers. */
#define PULSE_BODY(ch) uint8_t base=ch*4,gb=ch*5,s=ff3_state.apu[base+1],v=ff3_state.apu[base]&15,d=ff3_state.apu[base]&192,h;uint16_t t=period_lo[ch]|((uint16_t)period_hi[ch]<<8),f;if(t<8||(!(s&8)&&t+(t>>(s&7))>2047))v=0;f=ff3_pitch_lookup(t&2047);h=f>>8;if(duty[ch]!=d)ff3_gb_write(gb+1,d);ff3_gb_write(gb+3,(uint8_t)f);if(volume[ch]!=v||(trigger&(1<<ch))){ff3_gb_write(gb+2,v<<4);ff3_gb_write(gb+4,h|(v?128:0));}else if(high[ch]!=h)ff3_gb_write(gb+4,h);volume[ch]=v;duty[ch]=d;high[ch]=h;
static void pulse0(void){PULSE_BODY(0)}
static void pulse1(void){PULSE_BODY(1)}
#undef PULSE_BODY
#define PULSE(ch) pulse##ch()
#else
static void pulse(uint8_t ch){uint8_t base=ch*4,gb=ch*5,s=ff3_state.apu[base+1],v=ff3_state.apu[base]&15,d=ff3_state.apu[base]&192,h;uint16_t t=period_lo[ch]|((uint16_t)period_hi[ch]<<8),f;if(t<8||(!(s&8)&&t+(t>>(s&7))>2047))v=0;f=ff3_pitch_lookup(t&2047);h=f>>8;if(duty[ch]!=d)ff3_gb_write(gb+1,d);ff3_gb_write(gb+3,(uint8_t)f);if(volume[ch]!=v||(trigger&(1<<ch))){ff3_gb_write(gb+2,v<<4);ff3_gb_write(gb+4,h|(v?128:0));}else if(high[ch]!=h)ff3_gb_write(gb+4,h);volume[ch]=v;duty[ch]=d;high[ch]=h;}
#define PULSE(ch) pulse(ch)
#endif
void ff3_backend_restore(void){dirty|=8;}
void ff3_backend_flush(uint8_t pop){uint16_t f;uint8_t v,n,h;if(dirty&1)PULSE(0);if(dirty&2)PULSE(1);if(dirty&4){f=ff3_pitch_lookup(ff3_state.apu[10]|((uint16_t)(ff3_state.apu[11]&7)<<8));v=(ff3_state.apu[8]&127)?32:0;h=f>>8;ff3_gb_write(13,(uint8_t)f);ff3_gb_write(12,v);if(volume[2]==255)ff3_gb_write(14,h|128);else if(high[2]!=h)ff3_gb_write(14,h);volume[2]=v;high[2]=h;}if(dirty&8){v=ff3_state.apu[12]&15;n=ff3_noise_lookup(ff3_state.apu[14]&15)|((ff3_state.apu[14]&128)?8:0);if(pop){v=7;n=0;}if(noise!=n)ff3_gb_write(18,n);if(volume[3]!=v||(trigger&8)){ff3_gb_write(17,v<<4);ff3_gb_write(19,128);}noise=n;volume[3]=v;}dirty=trigger=0;}
