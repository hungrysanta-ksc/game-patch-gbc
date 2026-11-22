#include <stdio.h>
#include <string.h>
#include "audio-engine.h"
#ifdef ENGINE_HOST
#include <stdlib.h>
static FILE *fixture;static uint8_t rom[524304];
static uint8_t byte(void){int v=fgetc(fixture);if(v<0){fprintf(stderr,"Truncated fixture\n");exit(3);}return (uint8_t)v;}
uint8_t ff3_rom_byte(uint8_t bank,uint16_t offset){return rom[16+(uint32_t)bank*8192+offset];}
#else
#include <gb/gb.h>
#include <gb/cgb.h>
#include "engine-assets.h"
static uint8_t bank=6;static const uint8_t *position=(const uint8_t*)0x4000;
static uint8_t byte(void){uint8_t v=*position++;if(position==(const uint8_t*)0x8000){bank++;SWITCH_ROM(bank);position=(const uint8_t*)0x4000;}return v;}
uint8_t ff3_rom_byte(uint8_t source,uint16_t offset){uint8_t b,v;b=source==0x36?1:source==0x37?2:source==0x38?3:source==0x39?4:source==9?5:0;if(!b){ff3_error=4;return 0;}SWITCH_ROM(b);v=*((const uint8_t*)(0x4000+offset));SWITCH_ROM(bank);return v;}
static const palette_color_t palette[]={RGB(28,30,29),RGB(18,22,21),RGB(9,13,14),RGB(2,4,6)};
#endif
volatile uint8_t engine_ready=0,engine_status=0,engine_failure=0;
volatile uint16_t engine_case=0,engine_index=0;
static uint8_t used,writes[128][2];
static void fail(uint8_t kind,uint16_t index){if(!engine_failure){engine_failure=kind;engine_index=index;}}
void ff3_output(uint8_t reg,uint8_t value){if(used>=128){fail(11,used);return;}writes[used][0]=reg;writes[used++][1]=value;}
static void command(uint8_t op,uint8_t arg){switch(op){case 1:memset(&ff3_state,0,sizeof(ff3_state));ff3_engine_init();break;case 2:case 3:if(!ff3_music_request(&ff3_state,arg,op==3))fail(12,arg);break;case 4:ff3_music_resume(&ff3_state);break;case 5:case 6:ff3_music_stop(&ff3_state,op==6);break;case 7:if(!ff3_audio_effect(&ff3_state,arg))fail(12,arg);break;case 8:ff3_audio_stop_effect(&ff3_state);break;case 9:ff3_state.ram[5]=arg;break;case 10:ff3_state.ram[6]=arg;break;case 11:ff3_state.ram[7]=arg;break;case 12:ff3_state.ram[2]=arg;break;case 13:ff3_state.ram[4]=arg;break;case 14:ff3_state.ram[8]=arg;break;default:fail(13,op);}}
static void compare(const uint8_t *p,uint16_t n,uint8_t kind){uint16_t i;for(i=0;i<n;i++){uint8_t expected=byte();if(p[i]!=expected){
#ifdef ENGINE_HOST
 if(!engine_failure)printf("Expected %02x actual %02x\n",expected,p[i]);
#endif
 fail(kind,i);}}}
static void run(uint16_t count){uint8_t n,op,arg,i;
 for(engine_case=0;engine_case<count;engine_case++){used=0;n=byte();while(n--){op=byte();arg=byte();command(op,arg);}ff3_engine_tick();if(ff3_error)fail(14,ff3_error);compare(ff3_state.ram,192,4);compare(ff3_state.apu,24,5);n=byte();if(n!=used)fail(6,n);for(i=0;i<n;i++){if(byte()!=writes[i][0])fail(7,i*2);if(byte()!=writes[i][1])fail(7,i*2+1);}if(engine_failure)break;}
 engine_status=engine_failure?2:1;printf("%s %u/%u\nERROR %u AT %u\n",engine_failure?"FAIL":"PASS",engine_case,count,engine_failure,engine_index);
}
#ifdef ENGINE_HOST
int main(int argc,char **argv){FILE *source;if(argc!=4)return 2;source=fopen(argv[1],"rb");if(!source||fread(rom,1,sizeof(rom),source)!=sizeof(rom))return 2;fclose(source);fixture=fopen(argv[2],"rb");if(!fixture)return 2;run((uint16_t)atoi(argv[3]));fclose(fixture);return engine_failure?1:0;}
#else
void main(void){cpu_fast();NR52_REG=0;printf("FF3 ENGINE TEST\nALL C / NO REPLAY\n\nRUNNING...\n");set_bkg_palette(0,1,palette);SHOW_BKG;DISPLAY_ON;SWITCH_ROM(bank);engine_ready=0xa5;run(ENGINE_CASES);while(1)wait_vbl_done();}
#endif
