#ifndef STATE_HOST
#pragma bank 52
#endif
#include "battle-motion-sprites.h"
#include "battle-motion-sprites-assets.h"
/* 33/A44F -> 3F/FBEF with range 0..255 returns the table byte exactly
 * (including the original rounded multiply). Only counter 0 advances. */
uint8_t ff3_motion_impact(uint8_t frame,uint8_t x,uint8_t y,uint8_t hand,uint8_t back,FF3BattleRng*rng,uint8_t*point,uint8_t*out) FF3_STATE_BANKED {
 if(hand>1||back>1)return 0;
 if(!(frame&1)){point[0]=x+(rng->table[rng->counter[0]++]&31);point[1]=y+(rng->table[rng->counter[0]++]&31);}
 return ff3_motion_sprite(16+hand,point[0],point[1],0,back,3,out);
}
/* 32/9357..943C. Keep byte wrap, original shape order and zero tile IDs;
 * clipping and OAM allocation belong to the target renderer. */
uint8_t ff3_motion_sprite(uint8_t frame,uint8_t x,uint8_t y,uint8_t flip,uint8_t back,uint8_t palette,uint8_t*out) FF3_STATE_BANKED {
 const uint8_t*f,*s,*t;uint8_t shape,i,a,xx;uint16_t at;
 if(frame>=95||flip>1||back>1)return 0;
 f=motion_sprite_data+(0x950e-0x943d)+(uint16_t)frame*4;
 shape=f[1];if(flip)shape=motion_sprite_data[0x9503-0x943d+shape];
 at=motion_sprite_data[shape*2]|((uint16_t)motion_sprite_data[shape*2+1]<<8);
 s=motion_sprite_data+at-0x943d;t=motion_sprite_data+(0x968a-0x943d)+(uint16_t)f[0]*4;
 x+=flip?-f[2]:f[2];y+=f[3];if(frame!=4&&frame!=13)palette=3;
 for(i=0;i<4;i++,s+=4){a=s[2]|palette;xx=s[3]+x;if(back){xx=248-xx;a^=64;}
  *out++=s[0]+y;*out++=t[i];*out++=a;*out++=xx;
 }return 1;
}
/* 32/991F..99F4: 12 source records, including masked/blank glyphs. */
uint8_t ff3_motion_slice(uint8_t frame,uint8_t x,uint8_t y,uint8_t hand,uint8_t back,uint8_t*out) FF3_STATE_BANKED {
 uint8_t i,t,xx,mask;if(frame>=4||hand>1||back>1)return 0;mask=motion_slice_data[frame];y+=8;
 for(i=0;i<12;i++){
  xx=x+motion_slice_data[0x99d1-0x9968+i*2];t=motion_slice_data[0x99e9-0x9968+i];if(t&&hand)t+=8;
  if(mask&(128>>(i/2)))t=0;
  *out++=y+motion_slice_data[0x99d2-0x9968+i*2];*out++=t;*out++=back?67:3;*out++=back?248-xx:xx;
 }return 1;
}
