#pragma bank 56
#include <string.h>
#include "battle-action-oam.h"
extern uint8_t __at(0xd740) animation_lines[144];
extern uint8_t __at(0xd7d0) animation_linework[144];
static uint8_t retained[128],retained_count,valid;
void ff3_native_service(void) NONBANKED;
/* Eight visible rows per 8x8 object. Preserve the exact per-row increment,
 * early rejection and order; avoid the compiler's stack-held loop counter. */
static uint8_t reserve8(uint8_t*line){
 return ++line[0]<=10&&++line[1]<=10&&++line[2]<=10&&++line[3]<=10&&
        ++line[4]<=10&&++line[5]<=10&&++line[6]<=10&&++line[7]<=10;
}
uint8_t ff3_action_oam_begin(const uint8_t*base,uint8_t first,uint8_t count) FF3_STATE_BANKED {
 uint8_t i,j;int16_t y;const uint8_t*q;
 valid=0;if(first>40||count>40-first)return 0;
 retained_count=0;memset(animation_lines,0,144);
 for(i=0;i<40;i++){
  if(!(i&7))ff3_native_service();if(i>=first&&i<first+count)continue;
  q=base+i*4;if(!q[0])continue;if(retained_count==32)return 0;
  memcpy(retained+retained_count*4,q,4);retained_count++;y=(int16_t)q[0]-16;
  for(j=0;j<8;j++,y++)if(y>=0&&y<144&&++animation_lines[y]>10)return 0;
 }valid=1;return 1;
}
uint8_t ff3_action_oam_finish(uint8_t*out,uint8_t first,uint8_t count,uint8_t ordered) FF3_STATE_BANKED {
 uint8_t i,y,*line;const uint8_t*q=out+first*4;
 if(!valid||count>40-retained_count||first>40||count>40-first||(ordered&&first))return 0;
 memcpy(animation_linework,animation_lines,144);
 for(i=0;i<count;i++,q+=4){
  if(!(i&7))ff3_native_service();if(!q[0])continue;
  if(q[0]<16||q[0]>152)return 0;y=q[0]-16;line=animation_linework+y;
  if(!reserve8(line))return 0;
 }
 if(ordered){memcpy(out+count*4,retained,retained_count*4);memset(out+(count+retained_count)*4,0,(40-count-retained_count)*4);}
 return 1;
}
