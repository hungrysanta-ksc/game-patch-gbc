#pragma bank 12
#include <string.h>
#include "composition-kernel.h"
/* Main-thread only. Fixed scratch avoids SDCC's costly SP-relative accesses;
 * IRQ/audio code does not call this kernel or own these bytes. */
static uint8_t y,n,k,yy,value,lo,hi,covered,draw,bg,masks[12];
static int8_t dx;static const uint8_t *s;
uint8_t ff3_compose_cell(const uint8_t *input,uint16_t size,uint8_t *output) BANKED {
 if(size<29u||input[0]>16u||size!=29u+(uint16_t)input[0]*19u)return 1;
 memset(output,0,48);
 for(y=0;y<8;y++){
  memset(masks,0,12);lo=input[13+y*2];hi=input[14+y*2];bg=lo|hi;
  masks[0]=~bg;masks[1]=lo&~hi;masks[2]=~lo&hi;masks[3]=lo&hi;covered=0;s=input+29;
  for(k=0;k<input[0];k++,s+=19){
   yy=y-s[1];if(yy>=8)continue;dx=(int8_t)s[0];if(dx<=-8||dx>=8)continue;
   lo=s[3+yy*2];hi=s[4+yy*2];if(dx<0){lo<<=-dx;hi<<=-dx;}else{lo>>=dx;hi>>=dx;}
   draw=(lo|hi)&~covered;covered|=lo|hi;
   /* A behind-BG winner still prevents later OBJs from becoming visible. */
   if(s[2]&128)draw&=~bg;if(!draw)continue;
   masks[0]&=~draw;masks[1]&=~draw;masks[2]&=~draw;masks[3]&=~draw;
   n=4+(s[2]&1)*4;masks[n+1]|=lo&~hi&draw;masks[n+2]|=~lo&hi&draw;masks[n+3]|=lo&hi&draw;
  }
  for(k=0;k<12;k++){if(!masks[k])continue;value=input[1+k];if(value>=12)return 2;
   n=(value>>2)*16+y*2;if(value&1)output[n]|=masks[k];if(value&2)output[n+1]|=masks[k];
  }
 }
 return 0;
}
