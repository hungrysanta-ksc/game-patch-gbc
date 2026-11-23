#include <gb/cgb.h>
#include <string.h>
#include "map-display.h"
volatile uint8_t map_ready,map_request,map_error,map_world,map_id=0x16,map_x,map_y,map_negative;
volatile uint16_t map_loads;
static void negative(void){FF3Asset a;uint8_t v=0x5c;
 if(!ff3_asset_open(255,0,&a)&&asset_error)map_negative++;asset_error=0;
 if(!ff3_asset_open(FF3_PROPERTIES,512,&a)&&asset_error)map_negative++;asset_error=0;
 if(!ff3_asset_open(FF3_PROPERTIES,0,&a))return;
 if(!ff3_asset_read(&a,16,&v,1)&&v==0x5c&&asset_error)map_negative++;asset_error=0;
 if(!ff3_asset_read(&a,15,&v,2)&&v==0x5c&&asset_error)map_negative++;asset_error=0;
 a.bank=11;if(!ff3_asset_read(&a,0,&v,1)&&v==0x5c&&asset_error)map_negative++;asset_error=0;
 if(CURRENT_BANK!=1)asset_error=7;
}
void main(void){uint8_t previous=0,keys,pressed,i;
 cpu_fast();NR52_REG=0;SVBK_REG=1;rROMB1=0;SWITCH_ROM(1);memset((void*)0xd7f0,0xa7,16);negative();map_ready=0xa5;map_request=1;
 while(1){
  if(map_request){asset_error=0;map_error=0;if(!ff3_map_display(map_world,map_id,map_x,map_y))map_error=asset_error?asset_error:8;else map_loads++;if(CURRENT_BANK!=1)map_error=7;for(i=0;i<16;i++)if(((volatile uint8_t*)0xd7f0)[i]!=0xa7)map_error=9;map_request=0;}
  wait_vbl_done();keys=joypad();pressed=keys&~previous;previous=keys;
  if(pressed&J_A){map_id++;map_request=1;}if(pressed&J_B){map_id--;map_request=1;}
  if(pressed&J_SELECT){map_world=(map_world+1)%3;map_request=1;}
  if((pressed&J_LEFT)&&map_x){map_x--;map_request=1;}if((pressed&J_RIGHT)&&map_x<44){map_x++;map_request=1;}
  if((pressed&J_UP)&&map_y){map_y--;map_request=1;}if((pressed&J_DOWN)&&map_y<46){map_y++;map_request=1;}
 }
}
