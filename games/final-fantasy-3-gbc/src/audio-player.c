#include <gb/gb.h>
#include <gb/cgb.h>
#include <stdio.h>
#include <gbdk/console.h>
#include <stdint.h>
#include "audio-assets.h"
volatile uint8_t audio_ready=0,audio_request=0,audio_done=0,audio_clip=0,audio_pop_enabled=1;
volatile uint8_t audio_busy=0;
volatile uint16_t audio_tick=0;
uint8_t audio_packet[12];
#define packet audio_packet
static uint8_t bank,remain=0,playing=0,previous[12],noise_volume,noise_frequency;
static const uint8_t *position;
static uint16_t rate=0;
static const palette_color_t ui_palette[]={RGB(28,30,29),RGB(18,22,21),RGB(9,13,14),RGB(2,4,6)};
static uint8_t get(void){uint8_t b;SWITCH_ROM(bank);b=*position++;if(position==(const uint8_t*)0x8000){bank++;position=(const uint8_t*)0x4000;}return b;}
static void pop_end(void){TAC_REG=0;NR42_REG=noise_volume<<4;NR43_REG=noise_frequency;if(noise_volume)NR44_REG=0x80;}
static void silence(void){TAC_REG=0;NR12_REG=NR22_REG=NR32_REG=NR42_REG=0;}
static void start_clip(uint8_t id){uint8_t i;silence();audio_clip=id;bank=clip_banks[id];position=(const uint8_t*)(0x4000u+clip_offsets[id]);remain=0;audio_tick=0;rate=0;audio_done=0;playing=1;for(i=0;i<12;i++)previous[i]=255;}
static void apply(void){uint8_t vol,trigger=packet[11],p;
 for(p=0;p<2;p++){
  uint8_t base=p*3;vol=packet[base+2]&15;
  if(p==0){NR11_REG=packet[2]&192;NR13_REG=packet[0];if(packet[2]!=previous[2]||(trigger&1)){NR12_REG=vol<<4;NR14_REG=packet[1]|(vol?128:0);}else if(packet[1]!=previous[1])NR14_REG=packet[1];}
  else{NR21_REG=packet[5]&192;NR23_REG=packet[3];if(packet[5]!=previous[5]||(trigger&2)){NR22_REG=vol<<4;NR24_REG=packet[4]|(vol?128:0);}else if(packet[4]!=previous[4])NR24_REG=packet[4];}
 }
 NR33_REG=packet[6];NR32_REG=packet[8];if(previous[8]!=packet[8]||(trigger&4))NR34_REG=packet[7]|128;else if(previous[7]!=packet[7])NR34_REG=packet[7];
 TAC_REG=0;noise_volume=packet[10];noise_frequency=packet[9];NR43_REG=noise_frequency;
 if(previous[10]!=noise_volume||(trigger&8)){NR42_REG=noise_volume<<4;NR44_REG=0x80;}
 if((trigger&16)&&audio_pop_enabled){NR42_REG=0x70;NR43_REG=0;NR44_REG=0x80;TIMA_REG=254;TMA_REG=0;TAC_REG=4;}
 for(p=0;p<12;p++)previous[p]=packet[p];
}
static void tick(void){uint8_t i;if(!remain){remain=get();for(i=0;i<12;i++)packet[i]=get();}apply();packet[11]=0;remain--;audio_tick++;if(audio_tick==clip_frames[audio_clip]){playing=0;audio_done=1;silence();}}
static void screen(void){printf("\n FF3 SOURCE AUDIO\n\n CLIP %u / %u\n %s\n\n A PLAY  B STOP\n LEFT/RIGHT CLIP\n SELECT DMC TEST\n\n DMC BURST: %u\n\n NES DATA -> CGB\n BOUNDED TEST CLIP\n",(unsigned)(audio_clip+1),(unsigned)CLIP_COUNT,clip_names[audio_clip],(unsigned)audio_pop_enabled);}
void main(void){uint8_t keys,old=0,pressed,i;
 set_bkg_palette(0,1,ui_palette);
 NR52_REG=0x80;NR50_REG=0x77;NR51_REG=0xff;NR10_REG=0;NR30_REG=0;for(i=0;i<16;i++)((volatile uint8_t*)0xff30)[i]=triangle_wave[i];NR30_REG=0x80;silence();
 add_TIM(pop_end);set_interrupts(VBL_IFLAG|TIM_IFLAG);screen();audio_ready=0xa5;
 while(1){wait_vbl_done();keys=joypad();pressed=keys&~old;old=keys;
  if(pressed&J_B){playing=0;silence();}if(pressed&J_SELECT){audio_pop_enabled^=1;if(!playing){cls();screen();}}
  if(!playing){if(pressed&J_RIGHT){audio_clip=(audio_clip+1)%CLIP_COUNT;cls();screen();}if(pressed&J_LEFT){audio_clip=audio_clip?audio_clip-1:CLIP_COUNT-1;cls();screen();}if(pressed&J_A)audio_request=audio_clip+1;}
  if(audio_request){start_clip((audio_request-1)%CLIP_COUNT);audio_request=0;}
  if(playing){audio_busy=1;rate+=10062;while(rate>=10000&&playing){rate-=10000;tick();}audio_busy=0;}
 }
}
