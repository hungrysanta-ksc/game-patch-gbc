/* Same differential checker compiled by MSVC and GBDK. No output state replay. */
#include <stdio.h>
#include "audio-channel.h"
#ifdef CHANNEL_HOST
#include <stdlib.h>
static FILE *fixture;
static uint8_t byte(void){int v=fgetc(fixture);if(v<0){fprintf(stderr,"Truncated fixture\n");exit(3);}return (uint8_t)v;}
#else
#include <gb/gb.h>
#include <gb/cgb.h>
#include "channel-assets.h"
static uint8_t bank=1;
static const uint8_t *position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v=*position++;if(position==(const uint8_t*)0x8000){bank++;SWITCH_ROM(bank);position=(const uint8_t*)0x4000;}return v;}
static const palette_color_t palette[]={RGB(28,30,29),RGB(18,22,21),RGB(9,13,14),RGB(2,4,6)};
#endif
volatile uint8_t channel_ready=0,channel_status=0,channel_failure=0;
volatile uint16_t channel_case=0,channel_index=0;
static FF3AudioState state;
static uint16_t addresses[512],read_count;
static uint8_t values[512],writes[128][2],used;
static uint16_t word(void){uint16_t v=byte();return v|((uint16_t)byte()<<8);}
static void fail(uint8_t kind,uint16_t index){if(!channel_failure){channel_failure=kind;channel_index=index;}}
static void load(uint8_t *p,uint16_t n,uint8_t compare,uint8_t kind){uint16_t i;uint8_t v;for(i=0;i<n;i++){v=byte();if(compare){if(p[i]!=v)fail(kind,i);}else p[i]=v;}}
static uint8_t source(uint16_t address){uint16_t l=0,h=read_count,m;while(l<h){m=l+(h-l)/2;if(addresses[m]<address)l=m+1;else h=m;}if(l<read_count&&addresses[l]==address)return values[l];fail(10,address);return 0;}
static void write(uint8_t reg,uint8_t v){if(used>=128){fail(11,used);return;}writes[used][0]=reg;writes[used++][1]=v;}
static const FF3ChannelOps ops={source,write};
static void run(uint16_t count){uint16_t i;uint8_t op,ch,format,effect,n,v;
 for(channel_case=0;channel_case<count;channel_case++){
  op=byte();ch=byte();format=byte();effect=byte();used=0;
  load(state.ram,192,op&128,1);load(state.apu,24,op&128,2);
  read_count=word();if(read_count>512){fail(12,read_count);break;}
  for(i=0;i<read_count;i++){addresses[i]=word();values[i]=byte();}
  v=(op&127)?ff3_channel_envelope(&state,&ops,ch,effect):ff3_channel_script(&state,&ops,ch,format,effect);if(!v)fail(13,0);
  load(state.ram,192,1,4);load(state.apu,24,1,5);n=byte();if(n!=used)fail(6,n);
  for(i=0;i<n;i++){if(byte()!=writes[i][0])fail(7,i*2);if(byte()!=writes[i][1])fail(7,i*2+1);}
  if(channel_failure)break;
 }
 channel_status=channel_failure?2:1;
 printf("%s %u/%u\nERROR %u AT %u\n",channel_failure?"FAIL":"PASS",channel_case,count,channel_failure,channel_index);
}
#ifdef CHANNEL_HOST
int main(int argc,char **argv){uint16_t n;if(argc!=3)return 2;fixture=fopen(argv[1],"rb");if(!fixture)return 2;n=(uint16_t)atoi(argv[2]);run(n);fclose(fixture);return channel_failure?1:0;}
#else
void main(void){cpu_fast();NR52_REG=0;printf("FF3 CHANNEL TEST\nSOURCE ROM FIXTURES\n\nRUNNING...\n");set_bkg_palette(0,1,palette);SHOW_BKG;DISPLAY_ON;SWITCH_ROM(bank);channel_ready=0xa5;run(CHANNEL_CASES);while(1)wait_vbl_done();}
#endif
