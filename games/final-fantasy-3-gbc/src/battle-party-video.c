#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "battle-party-oam.h"
#include "battle-entry.h"
#include "platform.h"
#include "memory.h"
#include "text-vblank.h"
#include "party-video-assets.h"
#ifdef FF3_STATUS_VIDEO
#include "battle-status-video.h"
#endif
#ifdef FF3_RESIDENT_BG
#include "battle-resident-bg.h"
#endif
#ifdef FF3_TERRAIN
#include "battle-terrain.h"
#endif
void ff3_native_begin(void) NONBANKED;
void ff3_native_service(void) NONBANKED;
extern volatile uint16_t native_clock;
extern volatile uint8_t native_done;
volatile uint8_t party_ready,party_request,party_profile,party_pause=1,party_step,party_error,party_pending,party_visible,party_page;
volatile uint8_t party_work;
volatile uint8_t party_load_stage;
volatile uint16_t party_serial,party_prepared,party_max_prepare,party_missed,party_max_gap;
uint8_t __at(0xdc00) party_oam0[160];
uint8_t __at(0xdd00) party_oam1[160];
Ff3EntryDisplay __at(0xd000) party_motion;
Ff3PartyOam __at(0xd040) party_state;
uint8_t __at(0xd060) party_source[96];
static uint16_t last_vblank;
static uint8_t next_page,loaded;
uint8_t party_frame;
void ff3_party_copy(uint8_t bank,const void*source,void*dest,uint16_t n) NONBANKED {uint8_t saved=CURRENT_BANK;SWITCH_ROM(bank);memcpy(dest,source,n);SWITCH_ROM(saved);}
void ff3_party_palette(uint8_t bg,uint8_t first,uint8_t count,const uint8_t*data) NONBANKED {uint8_t ly;
 while(count--){
  for(;;){ly=LY_REG;if(ly>=144&&ly<=146&&(STAT_REG&3)==1)break;ff3_native_service();__asm halt __endasm;}
  if(bg)set_bkg_palette(first,1,(const palette_color_t*)data);else set_sprite_palette(first,1,(const palette_color_t*)data);
  first++;data+=8;ff3_native_service();
 }
}
static void refresh(void) __naked {__asm
 .globl .refresh_OAM
 jp .refresh_OAM
 __endasm;
}
static void publish(void) NONBANKED {uint16_t gap;uint8_t ly=LY_REG;
#ifdef FF3_TERRAIN
 SCX_REG=0;
#endif
 if(!party_pending||ly<144||ly>145||(STAT_REG&3)!=1)return;
#ifdef FF3_RESIDENT_BG
#ifdef FF3_TERRAIN
 terrain_scroll=resident_scroll;ff3_terrain_publish();
 if(terrain_fault){party_error=20+terrain_fault;party_pending=0;return;}
 LCDC_REG=(LCDC_REG&0xf7)|(resident_page?8:0);
#else
 SCX_REG=resident_scroll;LCDC_REG=(LCDC_REG&0xf7)|(resident_page?8:0);
#endif
#endif
 _shadow_OAM_base=next_page?0xdd:0xdc;
 __asm di __endasm;
 refresh();DISABLE_OAM_DMA;
 /* Only HRAM DMA needs the masked interval. Counters/diagnostics below
  * must allow TIMA service or its 4096 Hz clock loses overflows. */
 __asm ei __endasm;
 party_page=next_page;party_pending=0;party_serial++;party_visible=party_frame;
 if(!party_pause){gap=sys_time-last_vblank;if(last_vblank&&gap>1){party_missed++;if(gap>party_max_gap)party_max_gap=gap;}last_vblank=sys_time;}
 __asm di __endasm;
}
static void present(void){uint8_t i;uint16_t begin=ff3_clock_now(),elapsed;uint8_t *target;
 next_page=party_page^1;target=next_page?party_oam1:party_oam0;
 for(i=0;i<4;i++){party_state.x[i]=party_motion.x[i];party_state.y[i]=party_motion.y[i];party_state.pose[i]=party_motion.pose[i];}
 party_state.mirror=0; /* B46E keeps $98 clear throughout this prefix. */
#ifdef FF3_STATUS_VIDEO
 party_state.mirror=status_stage!=0;
 if(ff3_status_video_hold())goto party_ready_oam;
#endif
 /* AD53's first two waits precede the first AEE8 draw: retain reset-hidden
  * OAM even though logical positions/poses are already initialized. */
 if(party_motion.ticket<2)memset(party_source,0xf0,96);
 else if(!ff3_party_oam(&party_state,party_source)){party_error=1;return;}
#ifdef FF3_STATUS_VIDEO
 party_ready_oam:
#endif
 if(!ff3_party_oam_v6(party_source,party_state.battle_type==0x88,target)){party_error=1;return;}
#ifdef FF3_RESIDENT_BG
 ff3_resident_prepare(&party_motion,next_page,target);if(resident_error){party_error=10+resident_error;return;}
#endif
 #ifdef FF3_TERRAIN
 ff3_terrain_prepare(resident_page);
#endif
#ifdef FF3_STATUS_VIDEO
 if(!ff3_status_video_objects(target)){party_error=35;return;}
#endif
 elapsed=ff3_clock_now()-begin;if(elapsed>party_max_prepare)party_max_prepare=elapsed;party_prepared++;party_pending=1;
 while(party_pending){ff3_native_service();__asm halt __endasm;}
}
static void reset_motion(void){const PartyVideoAsset*a=party_assets+party_profile;
#ifdef FF3_TERRAIN
 ff3_terrain_reset();
#endif
 ff3_party_copy(a->bank,a->seed,&party_motion,sizeof(party_motion));ff3_party_copy(a->bank,a->input,&party_state,sizeof(party_state));
 party_frame=0;
#ifdef FF3_STATUS_VIDEO
 ff3_status_video_reset(party_profile);
#endif
 if(!ff3_entry_start(&party_motion)){party_error=2;return;}present();
}
static void load(void){const PartyVideoAsset*a;uint16_t off;uint8_t page;
 if(party_profile>=PARTY_PROFILES){party_error=3;return;}a=party_assets+party_profile;
 /* Hide objects at VBlank before replacing their resident patterns. */
 page=party_page^1;memset(page?party_oam1:party_oam0,0,160);next_page=page;party_pending=1;
 while(party_pending){ff3_native_service();__asm halt __endasm;}
#ifdef FF3_RESIDENT_BG
 party_load_stage=1;ff3_resident_load(party_profile);if(resident_error){party_error=10+resident_error;return;}
#ifdef FF3_TERRAIN
 party_load_stage=2;ff3_terrain_load(party_profile);if(terrain_fault){party_error=20+terrain_fault;return;}
#endif
#endif
 party_load_stage=3;for(off=0;off<4096;off+=256){ff3_party_copy(a->bank,a->tiles+off,text_staging,256);ff3_text_copy(0,0x8000+off,text_staging,256);ff3_native_service();}
 ff3_party_copy(a->bank,a->palette,text_staging,32);ff3_party_palette(0,0,4,text_staging);
 loaded=1;party_work=1;party_load_stage=4;reset_motion();party_request=0;party_load_stage=0;
}
void main(void){uint8_t i;
 ff3_platform_init();ff3_memory_init();cpu_fast();DISPLAY_OFF;
 memset((void*)0xddf0,0xa7,16);
 memset(&party_motion,0,sizeof(party_motion));
 memset(party_oam0,0,160);memset(party_oam1,0,160);_shadow_OAM_base=0xdc;
 memset(text_staging,0,256);set_bkg_data(0,1,text_staging);for(i=0;i<32;i++)set_bkg_tiles(0,i,20,1,text_staging);
 set_bkg_palette(0,1,(const palette_color_t*)text_staging);SCX_REG=SCY_REG=0;WX_REG=167;*(volatile uint8_t*)0xff6c=0;
 /* Explicit HRAM DMA publishes the selected immutable shadow in this
  * VBlank. Disable the default extra copy, preserving timer IRQ budget. */
 add_VBL(publish);ff3_text_video_init();text_idle=ff3_native_service;LCDC_REG=0x93;ff3_native_begin();
#ifdef FF3_TERRAIN
 ff3_terrain_init();
#endif
 party_ready=0xa5;
 while(1){ff3_native_service();
  if(party_request)load();
  else if(loaded&&!party_error&&(party_step||(!party_pause&&!native_done))){
   if(party_motion.phase==FF3_ENTRY_TAIL){
#ifdef FF3_STATUS_VIDEO
    uint8_t error=ff3_status_video_advance();if(error){party_error=30+error;continue;}party_frame++;present();
#else
    reset_motion();
#endif
   }
   else {
#ifdef FF3_TERRAIN
    ff3_terrain_step(&party_motion);if(terrain_fault){party_error=20+terrain_fault;continue;}
#endif
    if(!ff3_entry_ack(&party_motion,party_motion.ticket)){party_error=4;continue;}if(party_motion.phase!=FF3_ENTRY_TAIL){party_frame++;present();}
#ifdef FF3_STATUS_VIDEO
    else {uint8_t error=ff3_status_video_advance();if(error){party_error=30+error;continue;}party_frame++;present();}
#endif
   }
   party_step=0;
  }else {__asm halt __endasm;}
 }
}
