#pragma bank 58
#include <string.h>
#include "battle-thrown-video.h"
#include "battle-motion-sprites.h"
#include "battle-party-oam.h"
extern Ff3PartyOam party_state;
void ff3_native_service(void) NONBANKED;
static uint8_t actor_id,x,y,hand,back,kind,hits,angle,center[4];
static uint8_t stage,picture_stage,frame,distance,arc,velocity,midpoint,left,wait,embedded,limit;
static uint8_t pivot_x,pivot_y,draw_arc;
uint8_t thrown_sound;
uint8_t ff3_thrown_begin(uint8_t a,uint8_t ax,uint8_t ay,uint8_t h,uint8_t b,uint8_t k,uint8_t count,uint8_t aim,const uint8_t*c) BANKED {
 if(a>3||h>1||b>1||k<5||k>7||count>6)return 0;
 actor_id=a;x=ax;y=ay;hand=h;back=b;kind=k;hits=count;angle=aim;memcpy(center,c,4);
 stage=frame=arc=wait=embedded=0;distance=k==7?8:16;velocity=16;midpoint=(uint8_t)(x+22-center[0])>>1;left=count<<3;return 1;
}
static void sprite(uint8_t f,uint8_t px,uint8_t py,uint8_t*out){ff3_motion_sprite(f,px,py,0,back,3,out);}
uint8_t ff3_thrown_next(uint8_t*a,Ff3BattleRngCursor*rng,uint8_t*s) BANKED {
 uint8_t f,vx,vy,point[2],*q;thrown_sound=0;
 if(stage==0){picture_stage=0;
  if(frame!=0&&frame!=8){if(++frame==16){stage=1;frame=0;}return 2;}
  party_state.pose[actor_id]=hand?(frame?6:7):(frame?1:5);
  if(!ff3_party_actor_oam(&party_state,actor_id,a))return 255;
  memset(s,240,160);f=(kind==7?(hand?30:24):(hand?34:32)+(kind==6?20:0))+(frame?1:0);
  if(hand&&kind!=7){sprite(f,x,y,s);memcpy(s+16,a,24);}else{memcpy(s,a,24);sprite(f,x,y,s+24);}
  limit=10;if(!frame)thrown_sound=kind==7?0xaf:0xbb;frame++;return 1;
 }
 if(stage==1||stage==2){picture_stage=1;draw_arc=arc;
  vx=ff3_motion_vector(angle+64,distance);vy=ff3_motion_vector(angle,distance);
  pivot_x=x-16+vx;pivot_y=y+8+vy+arc;
  memset(s,240,160);memcpy(s,a,24);
  f=kind==7?(hand?28:26)+((frame>>2)&1):(hand?44:36)+(kind==6?4:0)+((frame>>1)&3);
  sprite(f,x+vx,y+vy+arc,s+24);limit=10;
  if(stage==2){
   if(left){sprite(hand?17:16,center[0]+16,center[1]+16,s+40);left--;limit=14;}
  }
  frame++;
  if(stage==1){if(center[0]>=pivot_x){stage=kind==7?3:2;arc=0;wait=kind==7?0:255;}
   else if(kind==7)distance+=16;
   else {if(distance>=midpoint){velocity--;arc+=2;}else{velocity++;arc-=2;}distance+=velocity>>2;if(kind==6)arc=0;}
  }else{if(wait==255){thrown_sound=0xdb;wait=0;}
   if(distance<8)stage=4;else{if(distance>=midpoint){velocity++;arc+=2;}else{velocity--;arc-=2;}distance-=velocity>>2;if(kind==6)arc=0;}
  }
  return 1;
 }
 if(stage==3){picture_stage=2;
  if(wait){wait--;return 2;}
  if(embedded==hits&&embedded){stage=4;return 0;}
  if(!embedded){memset(s,240,160);memcpy(s,a,24);limit=6;if(!hits){stage=4;return 1;}
   point[0]=pivot_x;point[1]=pivot_y;wait=6;
  }else{if(!ff3_motion_arrow_point(center[0],center[1],rng,point))return 255;wait=5;}
  q=s+24+embedded*4;q[0]=point[1];q[1]=hand?0x53:0x4b;q[2]=back?67:3;q[3]=back?248-point[0]:point[0];embedded++;limit=6+embedded;thrown_sound=0xda;return 1;
 }
 return 0;
}
/* Keep every original glyph and wait. Only travel endpoints and target-local
 * offsets change for the 160x144 field. No stored trajectory or extra source
 * simulation is needed: source x progress drives the native travel corridor. */
uint8_t ff3_thrown_project(const uint8_t*s,uint8_t*out) BANKED {
 uint8_t i,n=0,a,px;int16_t endx,endy,startx,starty,span,progress,gx=0,gy=0,xx,yy,dx,dy;
 endx=(int16_t)center[2]-(back?7:0);endy=center[3];startx=back?248-x:(int16_t)x-96;starty=(int16_t)y-25-actor_id*4;
 if(picture_stage==1){span=(int16_t)x-16-center[0];progress=(int16_t)x-16-pivot_x;if(span<=0)return 255;if(progress<0)progress=0;if(progress>span)progress=span;
  gx=startx+(endx-startx)*progress/span;gy=starty+(endy-starty)*progress/span+(int8_t)draw_arc*7/8;
 }
 for(i=0;i<limit;i++,s+=4){if(!(i&7))ff3_native_service();if(!s[1])continue;
  xx=(int16_t)s[3]+(back?-16:-80);yy=(int16_t)s[0]-33-actor_id*4;
  if(picture_stage==1&&i>=6&&i<10){px=back?248-pivot_x:pivot_x;xx=gx+(int8_t)(s[3]-px);yy=gy+(int8_t)(s[0]-pivot_y);}
  else if(picture_stage==1&&i>=10){px=back?248-s[3]:s[3];dx=(int8_t)(px-center[0]);dy=(int8_t)(s[0]-center[1]);xx=endx+(back?-dx:dx);yy=endy+dy;}
  else if(picture_stage==2&&i>=6){px=back?248-s[3]:s[3];dx=(int8_t)(px-center[0]);dy=(int8_t)(s[0]-center[1]);xx=endx+(i==6?0:(back?-dx:dx)*7/8);yy=endy+(i==6?0:dy*7/8);}
  if(n==40||xx<0||xx>152||yy<0||yy>136)return 255;
  a=s[2];*out++=yy+16;*out++=xx+8;*out++=s[1];*out++=(a&3)|((a&64)>>1)|((a&128)>>1);n++;
 }return n;
}
