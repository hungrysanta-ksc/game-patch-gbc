#ifndef STATE_HOST
#pragma bank 48
#endif
#include "battle-numerals.h"
#include "battle-numerals-assets.h"
#include <string.h>
typedef char numeral_abi[(sizeof(Ff3Numerals)==96)?1:-1];
/* ADF4: 3FFF hides even when miss/recovery flags are present. Keep the
 * original quotient (including 10..16); do not clamp display inputs. */
static void decimal(Ff3Numerals*s,uint8_t slot){uint16_t value=(s->values[slot*2]|((uint16_t)s->values[slot*2+1]<<8))&16383,divisor;
 uint8_t flags=s->values[slot*2+1],i,first=0,base=(flags&128)?0x66:0x56,*d=s->digits+slot*4;
 memset(d,0,4);s->palettes[slot]=0;if(value==16383)return;s->palettes[slot]=3;
 if(flags&64){d[1]=0x64;d[2]=0x65;return;}
 divisor=1000;for(i=0;i<4;i++){
  /* At most 16 subtractions: avoids the permanently mapped divide helper. */
  while(value>=divisor){value-=divisor;d[i]++;}
  if(d[i]||i==3)first=1;if(first)d[i]+=base;
  divisor=i==0?100:i==1?10:1;
 }
}
static void draw(Ff3Numerals*s,uint8_t*out){uint8_t i,j,x,y,amplitude=s->frame<16?64:16,dy,any,*d,*o=out;
 dy=((uint16_t)ff3_number_sine[((s->frame+1)*8)&127]*amplitude)>>8;
 s->count=0;
 for(i=0;i<(s->enemy?8:4);i++){
  if(s->enemy){if(s->types[i]==255)continue;x=s->center[i]-16;y=s->bottom[i]-(uint8_t)(ff3_number_stagger[i]+dy);}
  else{x=s->x[i]-16;y=s->y[i]-dy+16;}
  if(s->back)x=(uint8_t)(~x)+0xdf;
  d=s->digits+i*4;any=d[0]|d[1]|d[2]|d[3];
  for(j=0;j<4;j++,o+=4){o[0]=any?y:240;o[1]=d[j];o[2]=s->palettes[i];o[3]=x;x+=8;}
  s->count+=4;
 }
 s->ticket++;
}
uint8_t ff3_numerals_start(Ff3Numerals*s,uint8_t*out) FF3_STATE_BANKED {uint8_t i,any=0;
 if(s->ticket||s->done||s->error||s->enemy>1||s->back>1)return 0;
 for(i=0;i<16;i++)if(s->values[i]!=255)any=1;
 s->frame=s->count=0;if(!any){s->done=1;return 1;}
 for(i=0;i<8;i++)decimal(s,i);
 /* A42B increments X by one: all 160 bytes, not just the Y fields. */
 memset(out,240,160);draw(s,out);return 1;
}
uint8_t ff3_numerals_ack(Ff3Numerals*s,uint16_t ticket,uint8_t*out) FF3_STATE_BANKED {
 if(s->done||s->error||!s->ticket||ticket!=s->ticket)return 0;
 if(++s->frame==32){s->done=1;return 1;}
 draw(s,out);return 1;
}
