#pragma bank 9
#include "exploration.h"
#include "npc-motion-data.h"
/* AF97 can change just one object's physical position/pose after drawing.
 * Preserve those six bytes so catch-up can defer the GBC picture as a whole. */
uint8_t npc_draw[7],npc_draw_valid;

/* 3B/B17C..B1EE. One call per original field frame, regardless of whether the
 * GBC can publish a picture. Contact bypasses the speed mask. */
void ff3_npc_pixels(void) BANKED {
 uint8_t i,*a,*b,axis;
 for(i=0;i<192;i+=16){a=object_part1+i;b=object_part2+i;if(!a[0])continue;
  if(a[13]||!(field.frame&b[2])){
   axis=a[8]?0:1;
   if(a[8+axis]){a[6+axis]=(a[6+axis]+a[8+axis])&15;
    if(!a[6+axis]){a[8+axis]=a[12]=a[13]=0;a[4+axis]=a[2+axis];}
    field.render_dirty=1;
   }
  }
  if((a[6]|a[7])==8)b[1]=((b[0]&4)&&(b[6]&1))?0:b[0];
  /* Time-based poses and alternating source OAM priority run even at rest. */
  field.render_dirty=1;
 }
}
/* 3B/B0C5/B110, separate normal and event collision contracts. Preserve the stale
 * $67 behavior outside the 32x32 map: the fill tile does not overwrite it. */
static uint8_t destination(uint8_t slot,uint8_t x,uint8_t y,uint8_t z,uint8_t event){
 uint8_t i,t,p,k,*a,*b;
 if(!event&&(!z||!field.z||z==field.z)&&x==field.reserved_x&&y==field.reserved_y)return 0;
 if((x|y)&32)t=map_workspace.properties[3];
 else{t=map_workspace.tiles[(uint16_t)y*32+x];field.npc_tile=t;}
 if(t>=128||field.npc_tile>=128){field.error=1;return 0;}
 p=map_workspace.collision[(uint16_t)t*2];k=p&7;
 /* B114 deliberately ignores B0C5's carry, retaining its z side effects. */
 if(!(p&128)&&(!k||(k!=3&&(k>=4||(k|z)!=3)))){if(!k)z=0;else if(k<4)z|=k;}
 else if(!event)return 0;
 for(i=0;!event&&i<192;i+=16){if(i==slot)continue;a=object_part1+i;b=object_part2+i;
  if(a[0]&&(!z||!b[6]||z==b[6])&&x==a[2]&&y==a[3])return 0;
 }
 object_part2[slot]=map_workspace.collision[(uint16_t)field.npc_tile*2]&0x37;
 object_part2[slot+6]=z;return 1;
}
/* 3B/AF97..B0C4. Reserve after the frame pixels, retaining the source
 * pre-reservation picture in npc_draw. Skipped pictures still run this step. */
void ff3_npc_schedule(void) BANKED {
 uint8_t i,d,x,y,j,*a,*b;npc_draw_valid=0;
 i=(field.npc_cursor+16)&0xf0;if(i>=192)i=0;field.npc_cursor=i;
 a=object_part1+i;b=object_part2+i;
 if(!a[0]||(a[1]&128)||a[12])return;
 if(a[11]){a[11]--;return;}
 x=a[2];y=a[3];field.npc_rng++;d=npc_random[field.npc_rng]&3;
 if(d<2)x=(x+(d?255:1))&63;else y=(y+(d==3?255:1))&63;
 if(!destination(i,x,y,b[6],0))return;
 npc_draw[0]=i;for(j=0;j<4;j++)npc_draw[j+1]=a[j+4];npc_draw[5]=a[14];npc_draw[6]=a[15];npc_draw_valid=1;
 if(d<2){a[2]=x;a[8]=d?255:1;a[12]=d?2:1;if(d){a[4]=x;a[6]=15;}}
 else{a[3]=y;a[9]=d==3?255:1;a[12]=d==3?4:8;if(d==3){a[5]=y;a[7]=15;}}
 if(!(a[1]&0x50)){a[14]=0x1a+d*16;a[15]=0xb4;}
 a[11]=b[3];
}
/* ACD1..AD4A. Return 1 when ACCE asks D219 to retry the same command.
 * Jumps/circles have separate blocking consumers and fail preflight. */
uint8_t ff3_npc_command(uint8_t op) BANKED {
 uint8_t i=op&0xf0,d=op&15,x,y,*a=object_part1+i,*b=object_part2+i;
 if(i>=192){field.error=11;return 0;}
 if(a[12])return 1;
 if(d<4){x=a[2];y=a[3];
  if(d<2)x=(x+(d?255:1))&63;else y=(y+(d==3?255:1))&63;
  if(!destination(i,x,y,b[6],1))return 0;
  if(d<2){a[2]=x;a[8]=d?255:1;a[12]=d?2:1;if(d){a[4]=x;a[6]=15;}}
  else{a[3]=y;a[9]=d==3?255:1;a[12]=d==3?4:8;if(d==3){a[5]=y;a[7]=15;}}
  if(!(a[1]&0x50)){a[14]=0x1a+d*16;a[15]=0xb4;}a[11]=b[3];
 }else if(d<8){a[14]=0x1a+(d&3)*16;a[15]=0xb4;}
 else if(d==8)a[0]=a[10];else if(d==9)a[0]=0;
 else if(d==12)a[1]|=0x40;else if(d==13)a[1]&=0xb0;
 else field.error=11;
 field.render_dirty=1;return 0;
}
