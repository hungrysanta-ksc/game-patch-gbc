#pragma bank 15
#include <string.h>
#include "battle-equipment.h"
extern const uint8_t equipment_properties[];
/* An ADC chain feeds carry into the next byte addition, rather than keeping
 * a mathematical wide sum. These quirks also apply to overflowing stats. */
static uint8_t adc(uint8_t a,uint8_t b,uint8_t *carry){uint16_t n=(uint16_t)a+b+*carry;*carry=n>255;return (uint8_t)n;}
static uint8_t cap(uint8_t n){return n>=99?99:n;}
void ff3_equipment_update(uint8_t *c,uint8_t *e,uint8_t *b) BANKED {
 uint8_t ids[5],p[40],v[20],stats[5],right=0,left=0,type=0,i,j,carry,x,y,z,level=c[1],joblevel=c[16],rh,lh;
 for(i=0;i<3;i++)ids[i]=e[i]?e[i]:0x57;ids[3]=rh=e[3];ids[4]=lh=e[5];
 if(rh||lh){type=2;
  if(!rh){if(lh<0x46)left=1;else if(lh<0x4a){left=8;type=4;}else if(lh<0x58)ids[4]=0;else left=128;}
  else if(rh<0x46){right=1;if(lh)left=lh<0x58?1:128;}
  else if(rh<0x4a){right=8;type=4;}
  else if(rh<0x4f){if(lh){right=2;left=4;type=6;}else ids[3]=0;}
  else if(rh<0x58){if(lh){right=4;left=2;type=6;}else ids[3]=0;}
  else{right=128;if(lh)left=lh<0x58?1:128;}
 }
 for(i=0;i<5;i++)memcpy(p+i*8,equipment_properties+(uint16_t)ids[i]*8,8);
 memset(v,0,20);for(i=0;i<5;i++){stats[i]=c[18+i];for(j=0;j<5;j++)if(p[j*8+6]&(128>>i))stats[i]+=5;stats[i]=cap(stats[i]);c[23+i]=stats[i];}
 v[4]=(p[31]&128)?0:p[24];v[9]=(p[39]&128)?0:p[32];
 v[5]=v[10]=(level>>4)+(stats[1]>>4)+1;
 x=joblevel>>2;y=stats[1]>>2;carry=0;
 if(type==6){z=(right&2)?p[25]:p[33];z=adc(z,y,&carry);v[6]=cap(adc(z,x,&carry));}
 else{if(!(right&128)){z=adc(p[25],y,&carry);v[6]=cap(adc(z,x,&carry));}carry=0;if(!(left&128)){z=adc(p[33],y,&carry);v[11]=cap(adc(z,x,&carry));}}
 b[56]=p[29]&127;b[57]=p[37]&127;
 carry=0;
 if((c[0]==2||c[0]==13)&&!type){y=(uint8_t)((level>>1)+level);z=adc(joblevel>>2,stats[0]>>2,&carry);z=adc(z,y,&carry);v[7]=v[12]=adc(z,2,&carry);}
 else if(type==6){x=(right&4)?p[26]:p[34];y=((right&4)?p[34]:p[26])>>1;z=adc(stats[0]>>2,x,&carry);v[7]=adc(z,y,&carry);}
 else if(!(right|left)){z=adc(stats[0]>>2,p[26],&carry);v[7]=v[12]=adc(z,x,&carry);}
 else{
  if((right&128)||(!(left&128)&&!right)){v[5]=v[6]=v[7]=0;}
  else{z=adc(stats[0]>>2,x,&carry);v[7]=adc(z,p[26],&carry);}
  carry=0;if((left&128)||(!(right&128)&&!left)){v[10]=v[11]=v[12]=0;}
  else{z=adc(stats[0]>>2,x,&carry);v[12]=adc(z,p[34],&carry);}
 }
 if(!(v[5]|v[6]|v[7])){memcpy(v+5,v+10,3);memset(v+10,0,3);}
 if(!(right&128))v[8]=p[27];if(!(left&128)){v[13]=p[35];if(left&8)v[8]=v[13];}
 if(type==6){v[4]|=v[9];v[8]|=v[13];}
 /* AD89..ADE8 scratch arithmetic is overwritten before any persistent use;
  * its one live effect is zeroing the left attack multiplier at ADCA. */
 if((right|left)&&(type==6||(right&128)||!right||(left&128)||!left))v[10]=0;
 v[14]=p[0]|p[8]|p[16]|((right&128)?p[24]:0)|((left&128)?p[32]:0);
 v[15]=(stats[1]>>4)+((level>>4)+1)*((right>>7)+(left>>7));
 carry=0;z=adc(stats[1]>>2,(right&128)?p[25]:0,&carry);z=adc(z,(left&128)?p[33]:0,&carry);z=adc(z,p[1],&carry);z=adc(z,p[9],&carry);v[16]=cap(adc(z,p[17],&carry));
 carry=0;z=adc(stats[2]>>1,(right&128)?p[26]:0,&carry);z=adc(z,(left&128)?p[34]:0,&carry);z=adc(z,p[2],&carry);z=adc(z,p[10],&carry);v[17]=adc(z,p[18],&carry);
 v[18]=p[3]|p[11]|p[19]|((right&128)?p[27]:0)|((left&128)?p[35]:0);
 v[0]=((v[14]>>1&0x28)|(v[14]<<1&0x50))&~v[14];
 z=stats[3]+stats[4];v[1]=(stats[1]>>5)+(z>>5);v[2]=z>>1;
 carry=0;z=adc(p[4],p[12],&carry);v[3]=adc(z,p[20],&carry);if(right&128)v[3]+=p[28];if(left&128)v[3]+=p[36];
 /* Original AF18 clears elemental boost flags; preserve rather than fix. */
 e[15]=(e[15]&1)|type;b[51]=e[15];memcpy(b+18,v,20);memcpy(c+28,v,20);
 b[16]=stats[3];b[17]=stats[4];b[49]=right;b[50]=left;
}
