#include <gb/gb.h>
#include <string.h>
#include "battle-action-oam.h"
uint8_t __at(0xd740) animation_lines[144];
uint8_t __at(0xd7d0) animation_linework[144];
static uint8_t base[160],out[160];
void ff3_native_service(void) NONBANKED {}
static void objects(uint8_t*b,uint8_t count,uint8_t y){uint8_t i;memset(b,0,160);for(i=0;i<count;i++){b[i*4]=y;b[i*4+1]=8+i*8;b[i*4+2]=i+1;}}
uint8_t ff3_action_oam_test(void){uint8_t i,j;
 /* Retained/dynamic overlap must allow ten but reject eleven on a line. */
 objects(base,9,40);if(!ff3_action_oam_begin(base,39,1))return 10;
 objects(out,1,40);if(!ff3_action_oam_finish(out,0,1,1)||memcmp(out+4,base,36))return 11;
 for(i=40;i<160;i++)if(out[i])return 12;
 objects(out,2,40);if(ff3_action_oam_finish(out,0,2,1))return 13;
 /* A rejected page is not published. Next attempt starts from base counts. */
 objects(out,1,40);if(!ff3_action_oam_finish(out,0,1,1))return 14;
 /* A new owner must rebuild the retained cache, not inherit old occupancy. */
 objects(base,9,80);if(!ff3_action_oam_begin(base,39,1))return 15;
 objects(out,10,40);if(!ff3_action_oam_finish(out,0,10,1)||memcmp(out+40,base,36))return 16;
 objects(base,11,40);if(ff3_action_oam_begin(base,39,1))return 17;
 /* Excluding the changed slot permits exactly ten; fixed slots stay intact. */
 if(!ff3_action_oam_begin(base,0,1))return 18;memcpy(out,base,160);out[0]=64;
 if(!ff3_action_oam_finish(out,0,1,0)||memcmp(out+4,base+4,156))return 19;
 /* Count capacity and screen-edge coverage are independent limits. */
 objects(base,32,16);for(i=0;i<32;i++)base[i*4]=16+(i/8)*24;
 if(!ff3_action_oam_begin(base,32,8))return 20;
 objects(out,8,128);if(!ff3_action_oam_finish(out,0,8,1))return 21;
 objects(out,9,128);if(ff3_action_oam_finish(out,0,9,1))return 22;
 objects(base,1,9);if(!ff3_action_oam_begin(base,39,1))return 23;
 objects(out,10,16);if(ff3_action_oam_finish(out,0,10,1))return 24;
 objects(base,1,159);if(!ff3_action_oam_begin(base,39,1))return 25;
 objects(out,10,152);if(ff3_action_oam_finish(out,0,10,1))return 26;
 objects(out,1,15);if(ff3_action_oam_finish(out,0,1,1))return 27;
 objects(out,1,153);if(ff3_action_oam_finish(out,0,1,1))return 28;
 if(ff3_action_oam_begin(base,41,0)||ff3_action_oam_finish(out,39,2,0))return 29;
 /* Make each of the eight rows the first overflowing row. Earlier rows
  * increment, the failing row reaches eleven, later rows stay untouched. */
 for(i=0;i<8;i++){
  objects(base,10,40+i);if(!ff3_action_oam_begin(base,39,1))return 30;
  objects(out,1,40);if(ff3_action_oam_finish(out,0,1,1))return 31;
  for(j=0;j<8;j++)if(animation_linework[24+j]!=(j<i?1:j==i?11:10))return 32;
  objects(out,1,64);if(!ff3_action_oam_finish(out,0,1,1))return 33;
  objects(base,9,40+i);if(!ff3_action_oam_begin(base,39,1))return 34;
  objects(out,1,40);if(!ff3_action_oam_finish(out,0,1,1))return 35;
  for(j=0;j<8;j++)if(animation_linework[24+j]!=(j<i?1:10))return 36;
 }
 return 0;
}
