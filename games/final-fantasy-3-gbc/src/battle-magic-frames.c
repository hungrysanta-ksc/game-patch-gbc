#ifndef STATE_HOST
#ifdef FF3_EFFECTS
#pragma bank 64
#else
#pragma bank 8
#endif
#endif
#include "battle-magic-frames.h"
#include "battle-magic-frames-assets.h"
/* 33/B7CF..B90E, B711. Immutable compressed cells, not frame movies.
 * Keep all 36 slots including blank attributes/coordinates and byte wrapping.
 * Bank 8 is the standalone test placement, not an allocation in the live ROM. */
uint8_t ff3_magic_frame(const Ff3MagicFrame*p,uint8_t*out) FF3_STATE_BANKED {
 const uint8_t*src;uint8_t flip,x0,y,x,dx,dy,ox,oy,n=0,col=0,value,count,tile,attr;
 if(p->vertical>1||p->enemy>1||p->back>1)return 0;
 flip=(p->code>>7)|(p->vertical<<1);if(!p->enemy)flip^=1;
 x0=(flip&1)?40:0;y=(flip&2)?40:0;dx=(flip&1)?248:8;dy=(flip&2)?248:8;x=x0;
 ox=p->x-(p->enemy?24:16);oy=p->y-(p->enemy?16:12);
 if(!p->enemy){if(p->properties&32)oy-=12;if(p->magic==5)ox-=8;}
 src=magic_frames+(uint16_t)(p->code&127)*36;
 while(n<144){
  value=*src++;count=(value&128)?*src++:1;
  tile=(value&127)==127?0:(value&31)+73;attr=3|(((value<<1)&192)^(flip<<6));
  do{out[n]=tile?y+oy:240;out[n+1]=tile;out[n+2]=attr;out[n+3]=x+ox;
   if(p->back){out[n+3]=247-out[n+3];out[n+2]^=64;}
   n+=4;x+=dx;if(++col==6){col=0;x=x0;y+=dy;}
  }while(--count);
 }
 while(n<160)out[n++]=240;
 return 1;
}
void ff3_magic_priority(uint8_t*out) FF3_STATE_BANKED {
 uint8_t i,v;for(i=0;i<96;i++){v=out[i];out[i]=out[160+i];out[160+i]=v;}
}
uint8_t ff3_magic_begin(Ff3MagicSequence*s,uint8_t spell,uint8_t trim) FF3_STATE_BANKED {
 const uint8_t*p;uint8_t i=1,length;
 if(spell>=88||(trim!=0&&trim!=16))return 0;
 p=magic_programs+magic_offsets[spell];if(p[0]<=trim)return 0;length=p[0]-trim;
 while(i<=length){if(p[i++]==255)i++;}if(i!=length+1)return 0;
 s->spell=spell;s->index=1;s->length=length;return 1;
}
uint8_t ff3_magic_next(Ff3MagicSequence*s,uint8_t*out) FF3_STATE_BANKED {
 const uint8_t*p;uint8_t i,code,vertical=0;
 if(s->spell>=88||!s->index||!s->length)return 255;
 p=magic_programs+magic_offsets[s->spell];
 if(s->length>p[0]||(s->length!=p[0]&&s->length+16!=p[0])||s->index>s->length+1)return 255;
 /* Reject a forged cursor inside a prefix, preserving state/output atomically. */
 i=1;while(i<s->index){if(p[i++]==255)i++;}if(i!=s->index)return 255;
 if(s->index==s->length+1)return 0;
 i=s->index;code=p[i++];if(code==255){if(i>s->length)return 255;vertical=1;code=p[i++];}
 out[0]=code;out[1]=vertical;s->index=i;return 1;
}
