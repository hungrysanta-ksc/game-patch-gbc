#ifndef STATE_HOST
#pragma bank 16
#endif
#include "battle-status-oam.h"
#include "battle-status-oam-assets.h"
typedef char status_oam_abi[(sizeof(Ff3StatusOam)==35)?1:-1];
uint8_t ff3_status_oam(Ff3StatusOam*s,uint8_t*out) FF3_STATE_BANKED {
 uint8_t i,j,x,y,t,a,slot,mask;const uint8_t*shape;
 for(i=0;i<4;i++)if(s->status[i]!=255&&s->status[i]>=8)return 0;
 if(!s->enabled)return 1;
 shape=ff3_so_shapes+(s->battle_type==0x88?8:0);
 for(i=0;i<4;i++){
  x=s->battle_type==0x88?240-s->x[i]:s->x[i];
  t=ff3_so_tiles[i]+((s->counter&8)>>2);
  for(j=0;j<2;j++){
   y=s->y[i]+shape[j*4];a=shape[j*4+2];
   if(s->status[i]!=255){y+=ff3_so_y[s->status[i]];a=(a&252)|ff3_so_palette[s->status[i]];}
   *out++=y;*out++=s->status[i]==255?0:t+j;*out++=a;*out++=x+shape[j*4+3];
  }
 }
 for(i=0;i<32;i++)out[i]=240;
 slot=(s->counter&24)>>3;mask=s->targets[slot];
 for(i=0;i<8;i++,mask<<=1)if(mask&128){
  x=s->anchors[i*2]+slot*8;x=s->battle_type==0x88?240-x:x+8;
  out[i*4]=s->anchors[i*2+1];out[i*4+1]=FF3_STATUS_DIGIT+slot;out[i*4+2]=3;out[i*4+3]=x;
 }
 s->counter++;return 1;
}
