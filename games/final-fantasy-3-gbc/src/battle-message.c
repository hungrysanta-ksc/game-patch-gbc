#pragma bank 44
#include <string.h>
#include "battle-message.h"
#include "battle-live-ui.h"
#include "live-ui-assets.h"
void ff3_party_copy(uint8_t bank,const void*source,void*dest,uint16_t n) NONBANKED;
volatile uint8_t message_request;
uint8_t message_input[10],message_names[24],message_monsters[12];
uint8_t message_error,message_wait,message_rewind;
uint16_t message_source;
static uint8_t packet[18];
/* 95E1..9647: preserve leading blanks, the zero digit, and the original
 * four-position HP slice even when a supplied 16-bit value exceeds 9999. */
static void decimal(uint16_t value,uint8_t*out){uint16_t divisor=10000;uint8_t i,d,seen=0;
 for(i=0;i<5;i++){d=0;while(value>=divisor){value-=divisor;d++;}if(d||i==4)seen=1;out[i]=seen?LIVE_MESSAGE_DIGIT+d:0;divisor/=10;}
}
void ff3_message_reset(void) BANKED {uint8_t i;message_request=message_error=message_wait=message_rewind=0;message_source=65535;for(i=0;i<4;i++)ff3_party_copy(43,live_ui_seed+i*15,message_names+i*6,6);memset(message_monsters,255,12);}
void ff3_message_update(void) BANKED {uint8_t op=message_input[0],v=message_input[1],i,n=0,party=255,hits=0,t,record[5],digits[5],width=0,advance;uint16_t id=65535,at;
 message_error=message_wait=message_rewind=0;message_source=65535;
 memset(packet,0,sizeof(packet));packet[0]=1;
 if(op<5){
  if(op==3&&message_input[3]!=255){message_rewind=message_input[4]?5:4;goto done;}
  if(v==255)goto done;packet[0]=2;packet[1]=op;
 }else if(op==5||op==7){
  if(v==255)goto done;packet[1]=op==5?0:2;
  if(v<128){if(v>=4)goto invalid;party=v;}
  else {v&=127;if(op==7&&v==8)id=0x636;else {if(v>=8||message_monsters[v]>=4)goto invalid;v=message_monsters[8+message_monsters[v]];if(op==7&&v==255)goto done;id=0x520+v;}}
 }else if(op==6){packet[1]=1;
  if(message_input[2])id=0x400+v;
  else if(v==255)goto done;
  else if(v>=128)id=0x4c8+v-128;
  else if(!v)id=0x629;
  else if(v<0x21){id=0x633;hits=v;}
  else if(v<0x39)id=0x520+(uint8_t)(v+0xc6);
  else if(v<0x52)id=0x620+v-0x39;
  else id=0x100+v-0x46;
 }else if(op==8){if(v==255)goto done;packet[1]=3;id=0x100+(uint8_t)(v+12);
 }else if(op==9){if(v==255)goto done;if(v>=144)goto invalid;ff3_party_copy(43,live_ui_message_types+(v>>1),&t,1);t=v&1?t&15:t>>4;if(t>1){message_error=2;goto done;}message_wait=t;packet[1]=4;id=0x620+v;
 }else if(op==15){if(v>=4)goto invalid;if(message_input[9]!=255){message_error=2;goto done;}packet[0]=3;packet[1]=v;party=v;
 }else goto invalid;
 message_source=id;
 if(party!=255){memcpy(packet+3,message_names+party*6,6);n=6;
  if(op==15){decimal(message_input[5]|((uint16_t)message_input[6]<<8),digits);memcpy(packet+9,digits+1,4);packet[13]=LIVE_MESSAGE_SLASH;decimal(message_input[7]|((uint16_t)message_input[8]<<8),digits);memcpy(packet+14,digits+1,4);n=15;}
 }else if(id!=65535){
  for(i=0;i<LIVE_MESSAGE_COUNT;i++){ff3_party_copy(43,live_ui_message_index+(uint16_t)i*5,record,5);if((record[0]|((uint16_t)record[1]<<8))==id)break;}
  if(i==LIVE_MESSAGE_COUNT){message_error=3;goto done;}n=record[4];at=record[2]|((uint16_t)record[3]<<8);
  if(hits){decimal(hits,digits);packet[3]=digits[3];packet[4]=digits[4];}
  if(n+(hits?2:0)>14){message_error=4;goto done;}ff3_party_copy(43,live_ui_message_words+at,packet+3+(hits?2:0),n);n+=hits?2:0;
 }
 packet[2]=n;
 for(i=0;i<n;i++){if(packet[3+i]>=LIVE_UI_GLYPHS)goto invalid;ff3_party_copy(43,live_ui_advances+packet[3+i],&advance,1);width+=advance;}
 if(packet[0]==1){ff3_party_copy(43,live_ui_rect+(uint16_t)(packet[1]+1)*6+2,&advance,1);if(width>advance-7){message_error=4;goto done;}}
 memcpy(live_ui_input,packet,18);live_ui_request=1;ff3_live_ui_update();goto done;
invalid:message_error=1;
done:message_request=0;
}
