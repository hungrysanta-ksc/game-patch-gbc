#ifndef STATE_HOST
#pragma bank 16
#endif
#include "battle-party-oam.h"
#include "battle-party-oam-assets.h"
typedef char party_oam_abi[(sizeof(Ff3PartyOam)==26)?1:-1];
#ifdef FF3_EFFECTS
uint8_t ff3_party_actor_oam(const Ff3PartyOam*s,uint8_t i,uint8_t*out) FF3_STATE_BANKED {
 uint8_t j,p,id,t,a,x;const uint8_t*shape,*tiles;
 if(i>=4||(s->pose[i]&127)>=21)return 0;
 p=s->hidden[i]?0:s->pose[i]&127;id=ff3_po_ids[p+((s->pose[i]&128)?21:0)];
 shape=ff3_po_shapes+(uint16_t)id*24;tiles=ff3_po_tiles+(uint16_t)p*6;
 for(j=0;j<6;j++){
  t=tiles[j];t=(t&128)?t&127:t+ff3_po_offsets[i];
  a=shape[2]|s->palette[i]|s->override[i];x=shape[3]+s->x[i];
  if(s->mirror&&s->battle_type==0x88){x=248-x;a^=64;}
  *out++=shape[0]+s->y[i];*out++=t;*out++=a;*out++=x;shape+=4;
 }return 1;
}
#endif
uint8_t ff3_party_oam(const Ff3PartyOam*s,uint8_t*out) FF3_STATE_BANKED {
 uint8_t i,j,p,id,t,a,x;const uint8_t*shape,*tiles;
 for(i=0;i<4;i++)if((s->pose[i]&127)>=21)return 0;
 for(i=0;i<4;i++){
  p=s->hidden[i]?0:s->pose[i]&127;
  id=ff3_po_ids[p+((s->pose[i]&128)?21:0)];
  shape=ff3_po_shapes+(uint16_t)id*24;tiles=ff3_po_tiles+(uint16_t)p*6;
  for(j=0;j<6;j++){
   t=tiles[j];t=(t&128)?t&127:t+ff3_po_offsets[i];
   a=shape[2]|s->palette[i]|s->override[i];x=shape[3]+s->x[i];
   if(s->mirror&&s->battle_type==0x88){x=248-x;a^=64;}
   *out++=shape[0]+s->y[i];*out++=t;*out++=a;*out++=x;shape+=4;
  }
 }return 1;
}
uint8_t ff3_party_oam_v6(const uint8_t*source,uint8_t back,uint8_t*out) FF3_STATE_BANKED {
 uint8_t i,j,a,x,y,dy=17,dx=back?8:72;const uint8_t*q=source;
 for(i=0;i<24;i++,q+=4)if(q[0]<239&&(q[2]&0x3c))return 0; /* Hidden OAM may contain reset fill. */
 /* Native OAM coordinates include +8/+16. The V6 anchors make the
  * Y subtraction 17,21,25,29. Wrapped negative coordinates land outside
  * these visible intervals, so 16-bit per-object arithmetic is unnecessary. */
 for(i=0;i<4;i++,dy+=4)for(j=0;j<6;j++){
  x=source[3]-dx;y=source[0]-dy;a=source[2];
  *out++=(!x||x>=168||y<=8||y>=160)?0:y;
  *out++=x;*out++=source[1];*out++=(a&3)|((a&64)>>1)|((a&128)>>1);source+=4;
 }return 1;
}
