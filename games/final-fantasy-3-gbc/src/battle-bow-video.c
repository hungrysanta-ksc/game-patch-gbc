#pragma bank 57
#include <string.h>
#include "battle-bow-video.h"
#include "battle-motion-sprites.h"
static uint8_t actor_id,x,y,hand,back,hits,angle,center[4];
static uint8_t stage,picture_stage,frame,distance,last_distance,draw_distance,arrows,wait,probe_distance;
uint8_t bow_sound;
void ff3_native_service(void) NONBANKED;
uint8_t ff3_bow_begin(uint8_t a,uint8_t ax,uint8_t ay,uint8_t h,uint8_t b,uint8_t count,uint8_t aim,const uint8_t*c) BANKED {
 if(a>3||h>1||b>1||count>6)return 0;
 actor_id=a;x=ax;y=ay;hand=h;back=b;hits=count;angle=aim;memcpy(center,c,4);
 distance=probe_distance=16;last_distance=stage=frame=arrows=wait=0;return 1;
}
static uint8_t sprite(uint8_t f,uint8_t px,uint8_t py,uint8_t*out){return ff3_motion_sprite(f,px,py,0,back,3,out);}
static void body(const uint8_t*a,uint8_t*s,uint8_t with_arrow,uint8_t bow,uint8_t arrow,uint8_t px,uint8_t py){
 memset(s,240,160);
 if(hand){memcpy(s,a,24);if(with_arrow)sprite(arrow,px,py,s+24);sprite(bow,x,y,s+(with_arrow?40:24));}
 else{sprite(bow,x,y,s);if(with_arrow)sprite(arrow,px,py,s+16);memcpy(s+(with_arrow?32:16),a,24);}
}
uint8_t ff3_bow_next(const uint8_t*a,Ff3BattleRngCursor*rng,uint8_t*s) BANKED {
 uint8_t point[2],*q;bow_sound=0;
 if(stage==0){picture_stage=0;
  /* Native endpoint planning needs the final source distance, not a movie.
   * Spread one source vector probe across each charge wait; do not add a
   * burst to the original shared resource load before the first picture. */
  if(!last_distance&&probe_distance){if(center[0]>=(uint8_t)(x-16+ff3_motion_vector(angle+64,probe_distance)))last_distance=probe_distance;else probe_distance+=16;}
  if(frame!=0&&frame!=8){frame++;if(frame==16){stage=1;frame=0;}return 2;}
  body(a,s,1,(hand?7:5)+(frame?1:0),(hand?11:9)+(frame?1:0),x,y);
  if(!frame)bow_sound=0xaf;frame++;return 1;
 }
 if(stage==1){if(!last_distance)return 255;picture_stage=1;draw_distance=distance;
  body(a,s,1,hand?8:6,(hand?22:20)+((frame>>2)&1),x+ff3_motion_vector(angle+64,distance),y+ff3_motion_vector(angle,distance));
  frame++;if(distance==last_distance)stage=2;else distance+=16;return 1;
 }
 if(stage==2){picture_stage=2;
  if(wait){wait--;return 2;}
  if(arrows==hits&&arrows){stage=3;return 0;}
  if(!arrows){body(a,s,0,hand?8:6,0,0,0);if(!hits){stage=3;return 1;}
   point[0]=x-16+ff3_motion_vector(angle+64,distance);point[1]=y+8+ff3_motion_vector(angle,distance);wait=6; /* six waits plus A798 */
  }else{if(!ff3_motion_arrow_point(center[0],center[1],rng,point))return 255;wait=5;}
  q=s+40+arrows*4;q[0]=point[1];q[1]=hand?0x4a:0x52;q[2]=back?67:3;q[3]=back?248-point[0]:point[0];arrows++;bow_sound=0xda;return 1;
 }
 return 0;
}
/* Only target geometry changes. Preserve source waits, original raw OAM,
 * full glyphs, hand ordering and every accumulated arrow. The source angle
 * table remains the authority for the flight's distance and frame count. */
uint8_t ff3_bow_project(const uint8_t*s,uint8_t*out) BANKED {
 uint8_t i,n=0,limit=picture_stage==2?10+arrows:14,first=hand?6:4,a,px,py;int16_t gx,gy,startx,starty,endx,endy,dx,dy,xx,yy;
 endx=(int16_t)center[2]-(back?7:0);endy=center[3];
 startx=back?248-x:(int16_t)x-96;starty=(int16_t)y-25-actor_id*4;
 if(picture_stage==1){gx=startx+(endx-startx)*draw_distance/last_distance;gy=starty+(endy-starty)*draw_distance/last_distance;
  px=x-16+ff3_motion_vector(angle+64,draw_distance);py=y+8+ff3_motion_vector(angle,draw_distance);if(back)px=248-px;
 }
 for(i=0;i<limit;i++,s+=4){
  if(!(i&7))ff3_native_service();if(!s[1])continue;
  xx=(int16_t)s[3]+(back?-16:-80);yy=(int16_t)s[0]-33-actor_id*4;
  if(picture_stage==1&&i>=first&&i<first+4){
   xx=gx+(int8_t)(s[3]-px);yy=gy+(int8_t)(s[0]-py);
  }else if(picture_stage==2&&i>=10){
   if(i==10){xx=endx;yy=endy;}
   else{px=back?248-s[3]:s[3];dx=(int8_t)(px-center[0]);dy=(int8_t)(s[0]-center[1]);xx=endx+(back?-dx:dx)*7/8;yy=endy+dy*7/8;}
  }
  if(n==40||xx<0||xx>152||yy<0||yy>136)return 255;
  a=s[2];*out++=yy+16;*out++=xx+8;*out++=s[1];*out++=(a&3)|((a&64)>>1)|((a&128)>>1);n++;
 }return n;
}
