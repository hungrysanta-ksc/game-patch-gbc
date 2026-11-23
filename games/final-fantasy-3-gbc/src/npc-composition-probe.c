/* R2 asset feasibility only. Frames are compiled from original source states
 * by the host; this is not a GBC runtime compositor or an audio load test. */
#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "composition-assets.h"
volatile uint8_t render_ready,render_request,render_page;
static void show(void){Scene s;
 DISPLAY_OFF;SWITCH_ROM(1);memcpy(&s,&scenes[render_page],sizeof(Scene));SWITCH_ROM(s.bank);
 VBK_REG=0;set_bkg_data(0,s.bgTiles,s.background);set_bkg_tiles(0,0,20,18,s.map);
 VBK_REG=1;set_bkg_tiles(0,0,20,18,s.attributes);if(s.objTiles)set_sprite_data(0,s.objTiles,s.graphics);VBK_REG=0;
 set_bkg_palette(0,8,s.bgPalette);set_sprite_palette(0,2,s.objPalette);memcpy(shadow_OAM,s.oam,160);
 SCX_REG=SCY_REG=0;WX_REG=167;*(volatile uint8_t*)0xff6c=0;LCDC_REG=0x93;render_request=0;render_ready=0xa5;
}
void main(void){uint8_t previous=0,k;cpu_fast();NR52_REG=0;SVBK_REG=1;DISPLAY_OFF;LCDC_REG=0x13;render_page=0;show();
 while(1){wait_vbl_done();k=joypad();if((k&J_A)&&!(previous&J_A)){render_page=(render_page+1)%SCENE_COUNT;render_request=1;}if((k&J_B)&&!(previous&J_B)){render_page=render_page?render_page-1:SCENE_COUNT-1;render_request=1;}previous=k;if(render_request){if(render_page>=SCENE_COUNT)render_page=0;show();}}
}
