#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "audio-engine.h"
#include "field-scene.h"
#include "field-assets.h"
#include "platform.h"
FF3FieldEvent __at (0xd000) field_event;
volatile uint8_t scene_target_shake,scene_target_revision,scene_loaded,scene_render_busy;
volatile uint8_t scene_runs,scene_completed,scene_rendered_revision,scene_rendered_shake;
volatile uint16_t scene_upload_bytes,scene_render_calls,scene_max_chunk_ticks,scene_max_render_lag;
volatile uint32_t scene_begin_ticks[6],scene_render_tick;
extern volatile uint16_t native_clock;
extern volatile uint8_t native_consumed[12];
static uint16_t next_reset;
static uint8_t load_phase,load_tile,load_row,load_half,requested_music,started;
static uint8_t row[21],attrs[21];
static const uint8_t blank[16]={0};
static const uint16_t black[16]={0};
/* The raw audio ISR may return in LCD mode 3. Default GBDK upload routines
 * assume an ISR waits for VRAM access before returning. Recheck STAT inside
 * a very short critical section for every write; never block IRQs while waiting. */
static void safe_write(volatile uint8_t *p,uint8_t value){uint8_t done=0;do{while(STAT_REG&2){}CRITICAL{if(!(STAT_REG&2)){*p=value;done=1;}}}while(!done);}
static void safe_copy(uint16_t address,const uint8_t *p,uint8_t count){while(count--){safe_write((volatile uint8_t*)address++,*p++);}}
static void safe_palette(const uint16_t *p){uint8_t i;const uint8_t *bytes=(const uint8_t*)p;for(i=0;i<32;i++){BCPS_REG=i;safe_write(&BCPD_REG,bytes[i]);}}
uint8_t ff3_field_script(uint8_t offset){if(offset>=FIELD_SCRIPT_BYTES){ff3_error=20;return 0;}return ff3_resource_byte(7,FIELD_SCRIPT-0x4000u+offset);}
void ff3_field_request(uint8_t reg,uint8_t value){ff3_state.ram[reg]=value;}
static void reset_scene(void){memset(&field_event.pc,0,7);ff3_resource_copy(field_event.map,7,0,1024);scene_loaded=0;load_phase=load_tile=load_row=load_half=started=0;requested_music=1;scene_runs++;}
void ff3_scene_init(void){uint8_t i;next_reset=600;scene_runs=scene_completed=0;scene_target_shake=scene_target_revision=scene_rendered_revision=scene_rendered_shake=0;scene_render_calls=scene_upload_bytes=scene_max_chunk_ticks=scene_max_render_lag=0;scene_render_tick=0;for(i=0;i<6;i++)scene_begin_ticks[i]=0xfffffffful;reset_scene();}
void ff3_scene_video_init(void){uint8_t i;DISPLAY_OFF;HIDE_SPRITES;VBK_REG=0;set_bkg_data(112,1,blank);for(i=0;i<21;i++)row[i]=112;set_win_tiles(0,0,20,1,row);set_win_tiles(0,1,20,1,row);VBK_REG=1;memset(attrs,0,sizeof(attrs));set_win_tiles(0,0,20,1,attrs);set_win_tiles(0,1,20,1,attrs);VBK_REG=0;move_win(7,128);move_bkg(0,0);set_bkg_palette(0,4,black);SHOW_BKG;SHOW_WIN;DISPLAY_ON;}
void ff3_scene_before(uint32_t tick){/* Re-entry is a diagnostic load test, not a new game event. */
 if(tick==next_reset&&next_reset<3600u){next_reset+=600u;reset_scene();}
 if(requested_music&&scene_loaded){ff3_field_music(FIELD_SONG);requested_music=0;}
}
void ff3_scene_after(uint32_t tick){uint8_t was_done;if(!scene_loaded)return;if(!started){started=1;scene_begin_ticks[scene_runs-1]=tick;}was_done=field_event.done;ff3_field_tick(&field_event);if(field_event.error)ff3_error=21;if(!was_done&&field_event.done)scene_completed++;}
static uint8_t cell(uint8_t x,uint8_t y,uint8_t revision){uint16_t index=(uint16_t)(y>>1)*32+(x>>1);uint8_t i,m=((const uint8_t*)FIELD_MAP)[index];for(i=0;i<revision;i++)if(field_change_index[i]==index)m=field_change_value[i];return m;}
static void upload_row(uint8_t y,uint8_t revision){uint8_t x,m;for(x=0;x<21;x++){m=cell(FIELD_CAMERA_X+x,FIELD_CAMERA_Y+y,revision);row[x]=((const uint8_t*)FIELD_METAS)[(uint16_t)m*4+((FIELD_CAMERA_Y+y)&1)*2+((FIELD_CAMERA_X+x)&1)];attrs[x]=((const uint8_t*)FIELD_ATTRS)[m];}if(!load_half){VBK_REG=1;safe_copy(0x9800+(uint16_t)y*32,attrs,21);}else{VBK_REG=0;safe_copy(0x9800+(uint16_t)y*32,row,21);}VBK_REG=0;scene_upload_bytes+=21;}
static void change(uint8_t n){uint8_t x=(field_change_index[n]&31)*2-FIELD_CAMERA_X,y=(field_change_index[n]>>5)*2-FIELD_CAMERA_Y,m=field_change_value[n],i;uint16_t address=0x9800+(uint16_t)y*32+x;if(x>=20||y>=16)return;for(i=0;i<4;i++){row[i]=((const uint8_t*)FIELD_METAS)[(uint16_t)m*4+i];attrs[i]=((const uint8_t*)FIELD_ATTRS)[m];}VBK_REG=1;safe_copy(address,attrs,2);safe_copy(address+32,attrs+2,2);VBK_REG=0;safe_copy(address,row,2);safe_copy(address+32,row+2,2);scene_upload_bytes+=8;}
void ff3_scene_render(void){uint16_t begin,elapsed,lag;uint32_t tick;uint8_t rev,shake,i,saved=CURRENT_BANK;scene_render_busy=1;begin=ff3_clock_now();SWITCH_ROM(7);
 CRITICAL{rev=scene_target_revision;shake=scene_target_shake;tick=(uint32_t)native_consumed[0]|((uint32_t)native_consumed[1]<<8)|((uint32_t)native_consumed[2]<<16)|((uint32_t)native_consumed[3]<<24);}
 if(!load_phase){SCX_REG=0;scene_rendered_shake=0;safe_palette(black);scene_rendered_revision=0;load_phase=1;}
 else if(load_phase==1){VBK_REG=0;safe_copy(0x9000+(uint16_t)load_tile*16,(const uint8_t*)(FIELD_GFX+(uint16_t)load_tile*16),16);scene_upload_bytes+=16;load_tile++;if(load_tile==112)load_phase=2;}
 else if(load_phase==2){upload_row(load_row,0);load_half^=1;if(!load_half)load_row++;if(load_row==16)load_phase=3;}
 else if(load_phase==3){safe_palette((const uint16_t*)FIELD_PALETTES);load_phase=4;scene_loaded=1;}
 else {for(i=scene_rendered_revision;i<rev;i++)change(i);scene_rendered_revision=rev;SCX_REG=shake;scene_rendered_shake=shake;}
 lag=(uint16_t)(tick-scene_render_tick);if(scene_loaded&&scene_render_tick&&lag>scene_max_render_lag)scene_max_render_lag=lag;scene_render_tick=tick;scene_render_calls++;SWITCH_ROM(saved);elapsed=ff3_clock_now()-begin;if(elapsed>scene_max_chunk_ticks)scene_max_chunk_ticks=elapsed;scene_render_busy=0;
}
