#include "inventory.h"
void ff3_inventory_pack(const uint8_t *bag,uint8_t *pairs){uint8_t i;for(i=0;i<32;i++){pairs[i*2]=bag[i];pairs[i*2+1]=bag[i+32];}}
void ff3_inventory_unpack(const uint8_t *pairs,uint8_t *bag){uint8_t i;for(i=0;i<32;i++){bag[i]=pairs[i*2];bag[i+32]=pairs[i*2+1];}}
/* 35/B5C6..B5F6, inventory-only branch; canonical address adaptation. */
uint8_t ff3_inventory_reserve(uint8_t *bag,uint8_t slot,uint8_t *used){
 if(slot>=32||!bag[slot]||*used)return 0;
 *used=bag[slot];if(!--bag[slot+32])bag[slot]=0;return 1;
}
/* 34/9AE7..9B20. Do not cap the returned quantity to 99: INC is 8-bit. */
uint8_t ff3_inventory_return(uint8_t *bag,uint8_t *used,uint8_t *equipped){uint8_t i,empty=255;
 if(!*used)return 1;
 if(!*equipped){for(i=0;i<32;i++){if(bag[i]==*used)break;if(!bag[i]&&empty==255)empty=i;}
  if(i==32){if(empty==255)return 0;i=empty;bag[i]=*used;}
  bag[i+32]++;
 }
 *used=0;*equipped=0;return 1;
}
