/* R2 negative feasibility probe. Static original assets, no gameplay/audio.
 * The candidate deliberately demonstrates the 10-OBJ scanline limit.
 * Never used by exploration or battle product builds. */
#include <gb/gb.h>
#include <gb/cgb.h>
#include <string.h>
#include "render-probe-assets.h"
volatile uint8_t render_ready,render_request,render_page;
static void show(void){const Scene *s;
 DISPLAY_OFF;SWITCH_ROM(1);s=&scenes[render_page];VBK_REG=0;
 set_bkg_data(128,128,s->background);set_bkg_tiles(0,0,20,18,s->map);
 VBK_REG=1;set_bkg_tiles(0,0,20,18,s->attributes);set_sprite_data(0,s->objTiles,s->graphics);VBK_REG=0;
 set_bkg_palette(0,4,s->bgPalette);set_sprite_palette(0,2,s->objPalette);
 memcpy(shadow_OAM,s->oam,160);SCX_REG=SCY_REG=0;WX_REG=167;*(volatile uint8_t*)0xff6c=0;
 LCDC_REG=0x87;render_request=0;render_ready=0xa5;
}
void main(void){uint8_t previous=0,k;cpu_fast();NR52_REG=0;SVBK_REG=1;DISPLAY_OFF;LCDC_REG=0x07;render_page=0;show();while(1){wait_vbl_done();k=joypad();if((k&J_A)&&!(previous&J_A)){render_page^=1;render_request=1;}previous=k;if(render_request){if(render_page>1)render_page=0;show();}}}
